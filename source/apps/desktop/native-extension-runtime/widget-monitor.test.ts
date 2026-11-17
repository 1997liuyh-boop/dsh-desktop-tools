/** 验证真实事件记账、持久化去重和余额边界，测试不访问网络。 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { defaultDesktopToolsConfig } from '../src/desktop-tools-config.ts'
import { DesktopWidgetMonitor, accountWallets } from './widget-monitor.ts'

const day = new Date(2026, 10, 17, 12).getTime()
const priced = { ...defaultDesktopToolsConfig(), accounting: { enabled: true, dailyBudget: 1,
  rates: [{ provider: 'test', model: 'model', input: 2, cacheRead: 1, output: 4 }] } }
function fixture(config = priced, services: Record<string, unknown> = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-widget-'))
  const listeners = new Map<string, (...args: any[]) => void>()
  const ctx = { get: (name: string) => services[name], on: (name: string, listener: (...args: any[]) => void) => {
    listeners.set(name, listener); return () => { listeners.delete(name) }
  } }
  let now = day
  const monitor = new DesktopWidgetMonitor(ctx, profile, () => config, () => now)
  const event = (seq: number, type: string, data: object = {}, id = 'a') => listeners.get('session/event')?.({ id }, { seq, type, data })
  return { monitor, event, profile, ctx, config, setDay: (value: number) => { now = value },
    close() { monitor.dispose(); rmSync(profile, { recursive: true, force: true }) } }
}
const message = (usage: object = {}) => ({ turn: 1, usage: { inputTokens: 1_000_000, cacheReadTokens: 500_000, outputTokens: 100_000, reasoningTokens: 90_000, ...usage },
  message: { source: { provider: 'test', model: 'model' } } })

test('缓存与推理口径正确，重复及乱序事件不重复收费，重启后仍去重', async () => {
  const f = fixture()
  try {
    f.event(1, 'assistant/message', message())
    f.event(1, 'assistant/message', message())
    f.event(0, 'assistant/message', message())
    let snapshot = await f.monitor.snapshot()
    assert.equal(snapshot.today.cost, 2.9)
    assert.equal(snapshot.today.input, 1_000_000)
    assert.equal(snapshot.today.output, 100_000)
    assert.equal(snapshot.budgetExceeded, true)
    f.monitor.dispose()
    const restored = new DesktopWidgetMonitor(f.ctx, f.profile, () => f.config, () => day)
    restored.accept({ id: 'a' }, { seq: 1, type: 'assistant/message', data: message() })
    snapshot = await restored.snapshot()
    assert.equal(snapshot.total.cost, 2.9)
    restored.dispose()
  } finally { f.close() }
})

test('缓存创建未配置价格时计入未计价，未知服务商不会套用相同模型价格', async () => {
  const f = fixture()
  try {
    f.event(1, 'assistant/message', message({ cacheWriteTokens: 10 }))
    const unknown = message()
    unknown.message.source.provider = 'other'
    f.event(2, 'assistant/message', unknown)
    const snapshot = await f.monitor.snapshot()
    assert.equal(snapshot.total.cacheWrite, 10)
    assert.equal(snapshot.total.unpriced, 1_600_010)
    assert.equal(snapshot.total.cost, 2.9)
  } finally { f.close() }
})

test('关闭记账期间不累计，日期切换保留总计并重置当日预算', async () => {
  const f = fixture()
  try {
    f.config.accounting.enabled = false
    f.event(1, 'assistant/message', message())
    f.config.accounting.enabled = true
    f.event(2, 'assistant/message', message())
    f.setDay(day + 86_400_000)
    const snapshot = await f.monitor.snapshot()
    assert.equal(snapshot.today.cost, 0)
    assert.equal(snapshot.total.cost, 2.9)
    assert.equal(snapshot.budgetExceeded, false)
    assert.equal(snapshot.days[0]?.day, '2026-11-17')
  } finally { f.close() }
})

test('任务提问、工具结果、错误结束与改名按官方事件结构更新', async () => {
  const f = fixture()
  try {
    f.event(1, 'turn/end', { turn: 0, reason: { kind: 'completed' } })
    assert.equal((await f.monitor.snapshot()).tasks.length, 0)
    f.event(2, 'turn/start', { turn: 1 })
    f.event(3, 'tool/call', { turn: 1, callId: 'q', name: 'ask_user_question' })
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'waiting')
    f.event(4, 'tool/result', { turn: 1, message: { toolCallId: 'other' } })
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'waiting')
    f.event(5, 'tool/result', { turn: 1, message: { toolCallId: 'q' } })
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'running')
    f.event(6, 'turn/end', { turn: 1, reason: { kind: 'error' } })
    const task = (await f.monitor.snapshot()).tasks[0]
    assert.equal(task?.state, 'failed')
    f.event(7, 'session/title', { title: '新标题' })
    const renamed = (await f.monitor.snapshot()).tasks[0]
    assert.equal(renamed?.turn, task?.turn)
    assert.notEqual(renamed?.revision, task?.revision)
    assert.equal(renamed?.title, '新标题')
  } finally { f.close() }
})

test('损坏账本不会被覆盖或伪装为空账本', async () => {
  const f = fixture()
  try {
    f.monitor.dispose()
    const path = join(f.profile, 'desktop-tools', 'usage.json')
    mkdirSync(join(f.profile, 'desktop-tools'), { recursive: true })
    writeFileSync(path, '{broken')
    const monitor = new DesktopWidgetMonitor(f.ctx, f.profile, () => f.config, () => day)
    monitor.accept({ id: 'a' }, { seq: 1, type: 'assistant/message', data: message() })
    assert.equal((await monitor.snapshot()).storageError, true)
    monitor.dispose()
    assert.equal(readFileSync(path, 'utf8'), '{broken')
  } finally { rmSync(f.profile, { recursive: true, force: true }) }
})

test('并行授权和提问全部解决后才恢复运行，策略事件不会提前清除等待', async () => {
  const f = fixture()
  try {
    f.event(1, 'turn/start', { turn: 1 })
    f.event(2, 'approval/asked', { id: 'a' })
    f.event(3, 'approval/asked', { id: 'b' })
    f.event(4, 'approval/decided', { id: 'a' })
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'waiting')
    f.event(5, 'approval/policy', {})
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'waiting')
    f.event(6, 'tool/call', { callId: 'q', name: 'ask_user_question' })
    f.event(7, 'approval/decided', { id: 'b' })
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'waiting')
    f.event(8, 'tool/result', { message: { toolCallId: 'q' } })
    assert.equal((await f.monitor.snapshot()).tasks[0]?.state, 'running')
  } finally { f.close() }
})

test('余额保留零值，赠金按币种合计，缺失值不伪装成零', () => {
  assert.deepEqual(accountWallets({ status: 'ready', value: [{ currency: 'CNY', balance: '0' }], bonusWallets: [{ currency: 'CNY', balance: '2.5' }, { currency: 'USD', balance: '1' }] }),
    [{ currency: 'CNY', balance: 2.5 }, { currency: 'USD', balance: 1 }])
  assert.deepEqual(accountWallets({ status: 'ready', bonusWallets: [{ currency: 'CNY', balance: '0' }] }), [{ currency: 'CNY', balance: 0 }])
  assert.deepEqual(accountWallets({ status: 'ready', value: [{ currency: 'CNY', balance: '' }, { currency: 'CNY', balance: null }] }), [])
})

test('API 余额查询不把密钥投射到快照，合并并发刷新并缓存一分钟', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-widget-api-'))
  let requests = 0
  const monitor = new DesktopWidgetMonitor({ get: name => name === 'credentials' ? { resolve: async () => ({ value: 'test-secret' }) } : undefined,
    on: () => () => {} }, profile, () => priced, () => day, async (url, options) => {
      requests++
      assert.equal(url, 'https://api.deepseek.com/user/balance')
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-secret')
      return Response.json({ balance_infos: [{ currency: 'CNY', total_balance: '0' }] })
    })
  try {
    const snapshots = await Promise.all([monitor.snapshot(true), monitor.snapshot(true)])
    assert.equal(requests, 1)
    assert.equal(snapshots[0]?.balance.wallets?.[0]?.balance, 0)
    assert.equal(JSON.stringify(snapshots).includes('test-secret'), false)
    await monitor.snapshot()
    assert.equal(requests, 1)
  } finally { monitor.dispose(); rmSync(profile, { recursive: true, force: true }) }
})

test('API 失败回退账户余额，后续查询失败不保留过时的可用状态', async () => {
  let fail = false
  const f = fixture(priced, { deepseekAccount: { getBalance: async () => {
    if (fail) throw new Error('private failure')
    return { status: 'ready', bonusWallets: [{ currency: 'CNY', balance: '3' }] }
  } } })
  try {
    assert.equal((await f.monitor.snapshot()).balance.source, 'account')
    fail = true
    const snapshot = await f.monitor.snapshot(true)
    assert.equal(snapshot.balance.state, 'error')
    assert.equal(snapshot.balance.wallets, undefined)
    assert.equal(JSON.stringify(snapshot).includes('private failure'), false)
  } finally { f.close() }
})
