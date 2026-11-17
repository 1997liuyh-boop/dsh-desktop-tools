/** Host 持有会话事件和记账数据，原生窗口只能读取脱敏快照。 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DesktopToolsConfig, DesktopUsageTotal, DesktopWidgetSnapshot } from '../src/desktop-tools-types.ts'

type Task = DesktopWidgetSnapshot['tasks'][number]
type Balance = DesktopWidgetSnapshot['balance']
type Total = { -readonly [K in keyof DesktopUsageTotal]: DesktopUsageTotal[K] }
type Ledger = { version: 1; days: Record<string, Total>; sequences: Record<string, number> }
const emptyTotal = (): Total => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0, cost: 0, unpriced: 0 })
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const tokens = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
function dayKey(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface WidgetMonitorContext {
  get(name: string): unknown
  on(event: string, listener: (...args: any[]) => void): () => void
}

/** 零余额和赠金钱包同样有效；不同币种绝不相加。 */
export function accountWallets(value: unknown): { currency: string; balance: number }[] {
  if (!record(value) || value.status !== 'ready') return []
  const wallets = new Map<string, number>()
  for (const item of [...(Array.isArray(value.value) ? value.value : []), ...(Array.isArray(value.bonusWallets) ? value.bonusWallets : [])]) {
    if (!record(item) || typeof item.currency !== 'string' || !item.currency) continue
    const amount = typeof item.balance === 'string' && item.balance.trim() !== '' ? Number(item.balance) : item.balance
    if (typeof amount !== 'number' || !Number.isFinite(amount)) continue
    wallets.set(item.currency, (wallets.get(item.currency) ?? 0) + amount)
  }
  return [...wallets].map(([currency, balance]) => ({ currency, balance }))
}

export class DesktopWidgetMonitor {
  private ledger: Ledger = { version: 1, days: {}, sequences: {} }
  private readonly tasks = new Map<string, Task>()
  private readonly questions = new Map<string, Set<string>>()
  private readonly approvals = new Map<string, Set<string>>()
  private revision = 0
  private storageError = false
  private balance: Balance = { state: 'unavailable' }
  private balanceChecked: number | undefined
  private balanceFlight: Promise<void> | undefined
  private closed = false
  private readonly releases: (() => void)[] = []
  private readonly path: string
  private readonly abort = new AbortController()

  constructor(private readonly ctx: WidgetMonitorContext, profile: string, private readonly config: () => DesktopToolsConfig,
    private readonly now: () => number = Date.now, private readonly fetcher: typeof fetch = fetch) {
    this.path = join(profile, 'desktop-tools', 'usage.json')
    if (existsSync(this.path)) {
      try {
        const value: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
        if (!record(value) || value.version !== 1 || !record(value.days) || !record(value.sequences)) throw new Error('账本格式无效')
        for (const [day, total] of Object.entries(value.days)) {
          if (!/^\d{4}-\d{2}-\d{2}$/u.test(day) || !record(total)
            || Object.keys(emptyTotal()).some(key => typeof total[key] !== 'number' || !Number.isFinite(total[key]) || total[key] < 0)) throw new Error('账本格式无效')
        }
        if (Object.values(value.sequences).some(seq => typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0)) throw new Error('账本序号无效')
        this.ledger = value as Ledger
      } catch { this.storageError = true }
    }
    this.releases.push(ctx.on('session/event', (session, event) => {
      try { this.accept(session, event) } catch { this.storageError = true }
    }))
    this.releases.push(ctx.on('session/disposed', session => {
      if (typeof session?.id === 'string') {
        const task = this.tasks.get(session.id)
        if (task?.state === 'running' || task?.state === 'waiting') this.tasks.delete(session.id)
        this.questions.delete(session.id)
        this.approvals.delete(session.id)
      }
    }))
  }

  /** 只消费新追加事件，持久化序号防止重放重复记账。 */
  accept(session: unknown, event: unknown): void {
    if (this.closed || !record(session) || typeof session.id !== 'string' || !record(event) || !record(event.data)
      || typeof event.seq !== 'number' || !Number.isSafeInteger(event.seq) || event.seq < 0) return
    const id = session.id, seq = event.seq, data = event.data
    const sequenceKey = `session:${id}`
    if (seq <= (this.ledger.sequences[sequenceKey] ?? -1)) return
    this.ledger.sequences[sequenceKey] = seq
    const previous = this.tasks.get(id)
    const title = event.type === 'session/title' && typeof data.title === 'string' ? data.title.slice(0, 120)
      : previous?.title ?? (typeof session.title === 'string' ? session.title.slice(0, 120) : id.slice(0, 12))
    let state = previous?.state
    if (event.type === 'turn/start') { state = 'running'; this.questions.delete(id); this.approvals.delete(id) }
    if (event.type === 'approval/asked' && typeof data.id === 'string') {
      const pending = this.approvals.get(id) ?? new Set<string>()
      pending.add(data.id); this.approvals.set(id, pending); state = 'waiting'
    }
    if (event.type === 'approval/decided' && typeof data.id === 'string') this.approvals.get(id)?.delete(data.id)
    if (event.type === 'tool/call' && (data.name === 'ask_user_question' || data.toolName === 'ask_user_question')) {
      const pending = this.questions.get(id) ?? new Set<string>()
      pending.add(typeof data.callId === 'string' ? data.callId : '')
      this.questions.set(id, pending); state = 'waiting'
    }
    if (event.type === 'tool/result' && record(data.message)) {
      const callId = data.message.toolCallId ?? data.message.callId
      if (typeof callId === 'string') this.questions.get(id)?.delete(callId)
    }
    if (state === 'running' || state === 'waiting') state = this.questions.get(id)?.size || this.approvals.get(id)?.size ? 'waiting' : 'running'
    if (event.type === 'turn/end') {
      // 只有本次启动后观察到运行的轮次才生成完成事件，避免历史结束事件弹通知。
      state = previous && (previous.state === 'running' || previous.state === 'waiting')
        ? ((record(data.reason) ? data.reason.kind : data.reason) === 'error' ? 'failed' : 'completed') : undefined
      this.questions.delete(id)
      this.approvals.delete(id)
    }
    if (state !== undefined && (state !== previous?.state || title !== previous?.title)) {
      this.tasks.set(id, { sessionId: id, title, state, updatedAt: this.now(), revision: ++this.revision,
        turn: typeof data.turn === 'number' ? data.turn : previous?.turn ?? -1 })
      // 长时间运行时仅保留最近的已结束任务，运行中的任务继续显示。
      const finished = [...this.tasks.values()].filter(task => task.state === 'completed' || task.state === 'failed').sort((a, b) => b.updatedAt - a.updatedAt)
      for (const task of finished.slice(20)) this.tasks.delete(task.sessionId)
    }
    if (event.type === 'assistant/message' && !this.storageError && this.config().accounting.enabled && record(data.usage)) {
      const input = tokens(data.usage.inputTokens), cacheRead = tokens(data.usage.cacheReadTokens), output = tokens(data.usage.outputTokens)
      const cacheWrite = tokens(data.usage.cacheWriteTokens)
      const source = record(data.message) && record(data.message.source) ? data.message.source : {}
      const rate = this.config().accounting.rates.find(item => item.model === source.model && item.provider === source.provider)
      // reasoningTokens 已包含在 outputTokens，缓存输入由 DSH 单独报告。
      const cost = rate ? (input * rate.input + cacheRead * rate.cacheRead + cacheWrite * (rate.cacheWrite ?? 0) + output * rate.output) / 1_000_000 : 0
      const key = dayKey(this.now()), before = this.ledger.days[key] ?? emptyTotal()
      this.ledger.days[key] = { input: before.input + input, cacheRead: before.cacheRead + cacheRead,
        cacheWrite: before.cacheWrite + cacheWrite, output: before.output + output, cost: before.cost + cost,
        unpriced: before.unpriced + (rate ? (rate.cacheWrite === undefined ? cacheWrite : 0) : input + cacheRead + cacheWrite + output) }
      this.save()
    } else if (event.type === 'turn/end') this.save()
  }

  private save(): void {
    if (this.storageError) return
    try {
      mkdirSync(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.${process.pid}.tmp`
      writeFileSync(temporary, JSON.stringify(this.ledger), 'utf8')
      renameSync(temporary, this.path)
    } catch { this.storageError = true }
  }

  /** 可选账户服务没有 AbortSignal 参数，用有界等待避免挂住刷新。 */
  private async bounded<T>(pending: Promise<T>): Promise<T> {
    const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(10_000)])
    let rejectWait: () => void = () => {}
    try {
      return await Promise.race([pending, new Promise<never>((_, reject) => {
        rejectWait = () => { reject(new Error('余额查询已取消或超时')) }
        if (signal.aborted) rejectWait()
        else signal.addEventListener('abort', rejectWait, { once: true })
      })])
    } finally { signal.removeEventListener('abort', rejectWait) }
  }

  private async refreshBalance(): Promise<void> {
    let failed = false
    try {
      const credentials = this.ctx.get('credentials') as { resolve(name: string): Promise<{ value: string } | undefined> } | undefined
      const credential = credentials ? await this.bounded(credentials.resolve('DEEPSEEK_API_KEY')) : undefined
      if (credential?.value) {
        const response = await this.fetcher('https://api.deepseek.com/user/balance', {
          headers: { Authorization: `Bearer ${credential.value}` }, signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(8000)]),
        })
        if (!response.ok) throw new Error('余额请求失败')
        const body: unknown = await response.json()
        const wallets = record(body) && Array.isArray(body.balance_infos) ? body.balance_infos.flatMap(item => {
          if (!record(item) || typeof item.currency !== 'string' || !['number', 'string'].includes(typeof item.total_balance)
            || item.total_balance === '') return []
          const balance = Number(item.total_balance)
          return Number.isFinite(balance) ? [{ currency: item.currency, balance }] : []
        }) : []
        if (!wallets.length) throw new Error('余额格式无效')
        this.balance = { state: 'ready', source: 'api', wallets, updatedAt: this.now() }
        return
      }
    } catch { failed = true }
    try {
      const account = this.ctx.get('deepseekAccount') as { getBalance(client: object): Promise<unknown> } | undefined
      const wallets = accountWallets(account ? await this.bounded(account.getBalance({ version: process.env.DSH_CLIENT_VERSION || process.env.DSH_VERSION || 'unknown',
        locale: 'zh_CN', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 })) : undefined)
      this.balance = wallets.length ? { state: 'ready', source: 'account', wallets, updatedAt: this.now() }
        : { state: failed ? 'error' : 'unavailable' }
    } catch { this.balance = { state: 'error' } }
  }

  async snapshot(force = false, waitBalance = true): Promise<DesktopWidgetSnapshot> {
    if (!this.closed && this.config().accounting.enabled && (force || this.balanceChecked === undefined || this.now() - this.balanceChecked >= 60_000)) {
      this.balanceFlight ??= this.refreshBalance().finally(() => { this.balanceChecked = this.now(); this.balanceFlight = undefined })
      if (waitBalance) await this.balanceFlight
    }
    const total = emptyTotal()
    const days = Object.entries(this.ledger.days).sort(([a], [b]) => b.localeCompare(a)).map(([day, value]) => ({ day, ...value }))
    for (const day of days) for (const key of Object.keys(total) as (keyof Total)[]) total[key] += day[key]
    const today = this.ledger.days[dayKey(this.now())] ?? emptyTotal()
    const budget = this.config().accounting.dailyBudget
    return { tasks: [...this.tasks.values()].sort((a, b) => b.updatedAt - a.updatedAt), today, total, days: days.slice(0, 30),
      balance: this.config().accounting.enabled ? this.balance : { state: 'unavailable' },
      budgetExceeded: this.config().accounting.enabled && budget > 0 && today.cost >= budget, storageError: this.storageError }
  }

  dispose(): void { this.closed = true; this.abort.abort(); for (const release of this.releases) release(); this.save() }
}
