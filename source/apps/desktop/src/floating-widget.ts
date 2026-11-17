/** 独立状态气泡不改变聊天窗口尺寸，也不抢占前台焦点。 */
import { BrowserWindow, Notification, screen } from 'electron'
import { DESKTOP_IPC, SCHEME } from './ipc.ts'
import type { DesktopFeatureContext } from './desktop-feature-host.ts'
import type { DesktopTaskState, DesktopWidgetSnapshot } from './desktop-tools-types.ts'
import { readDesktopToolsConfig } from './desktop-tools-config.ts'
import { floatingBallOrigin } from './floating-window.ts'

export async function attachFloatingWidget(context: DesktopFeatureContext, ball: BrowserWindow): Promise<BrowserWindow> {
  const bubble = context.own(new BrowserWindow({ width: 264, height: 116, show: false, frame: false, transparent: true, resizable: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, hasShadow: false,
    webPreferences: { preload: context.environment.preload, contextIsolation: true, nodeIntegration: false, sandbox: true } }))
  bubble.setAlwaysOnTop(true, 'screen-saver')
  let snapshot: DesktopWidgetSnapshot | undefined
  let selected: DesktopTaskState | undefined
  let stopped = false, initialized = false
  const completedTurns = new Map<string, number>()
  const notifications = new Set<Notification>()
  const control = new AbortController()
  let dismissed: string | undefined
  let lastBudgetDay: string | undefined
  const messages = () => context.environment.locale().messages
  const open = (id: string): void => {
    if (ball.isDestroyed()) return
    ball.webContents.send(DESKTOP_IPC.floatingWidgetOpen, id)
    ball.show()
  }
  const notify = (title: string, body: string, id?: string): void => {
    if (!Notification.isSupported()) return
    const item = new Notification({ title, body })
    notifications.add(item)
    item.once('close', () => notifications.delete(item))
    item.once('click', () => { if (id) open(id); else context.showMain() })
    item.show()
  }
  const position = (): void => {
    if (ball.isDestroyed() || bubble.isDestroyed()) return
    const origin = floatingBallOrigin(ball)
    const area = screen.getDisplayNearestPoint({ x: Math.round(origin.x), y: Math.round(origin.y) }).workArea
    const x = origin.x - area.x > area.width / 2 ? origin.x - 268 : origin.x + 76
    bubble.setPosition(Math.round(Math.max(area.x, Math.min(x, area.x + area.width - 264))),
      Math.round(Math.max(area.y, Math.min(origin.y - 16, area.y + area.height - 116))))
  }
  const view = (): object => ({ task: selected, today: snapshot?.today,
    labels: { running: messages().widgetRunning, waiting: messages().widgetWaiting, completed: messages().widgetCompleted,
      failed: messages().widgetFailed, open: messages().widgetOpen, dismiss: messages().widgetDismiss, cost: messages().widgetCost } })
  context.handle(DESKTOP_IPC.floatingWidgetState, event => { context.assertSender(event); return view() })
  context.handle(DESKTOP_IPC.floatingWidgetOpen, (event, action: unknown) => {
    context.assertSender(event)
    if (action === 'dismiss') { dismissed = selected ? `${selected.sessionId}:${selected.revision}` : undefined; bubble.hide(); return }
    if (selected) open(selected.sessionId)
  })
  const render = (): void => {
    if (stopped || bubble.isDestroyed()) return
    const preferences = readDesktopToolsConfig(context.environment.profile).floatingBall
    const tasks = snapshot?.tasks ?? []
    selected = tasks.find(task => task.state === 'waiting') ?? tasks.find(task => task.state === 'running')
      ?? tasks.find(task => Date.now() - task.updatedAt < 10_000)
    if (!preferences.taskBubbles || !selected || dismissed === `${selected.sessionId}:${selected.revision}` || !ball.isVisible()
      || ball.getBounds().width > 96) { bubble.hide(); return }
    position()
    bubble.webContents.send(DESKTOP_IPC.floatingWidgetState, view())
    bubble.showInactive()
  }
  const poll = async (): Promise<void> => {
    try {
      const response = await context.request('/.dsh/native-command', JSON.stringify({ command: 'widget-snapshot' }), AbortSignal.any([control.signal, AbortSignal.timeout(10_000)]))
      const result = await response.json() as { ok: boolean; value?: DesktopWidgetSnapshot }
      if (stopped) return
      if (!response.ok || !result.ok || !Array.isArray(result.value?.tasks)) throw new Error('任务状态不可用')
      snapshot = result.value
      const preferences = readDesktopToolsConfig(context.environment.profile)
      for (const task of snapshot.tasks) {
        if (task.state !== 'completed' && task.state !== 'failed') continue
        if (initialized && completedTurns.get(task.sessionId) !== task.turn && preferences.floatingBall.completionNotifications) {
          notify(task.state === 'failed' ? messages().widgetFailed : messages().widgetCompleted, task.title, task.sessionId)
        }
        completedTurns.set(task.sessionId, task.turn)
      }
      for (const id of completedTurns.keys()) if (!snapshot.tasks.some(task => task.sessionId === id)) completedTurns.delete(id)
      const today = new Date().toLocaleDateString()
      if (initialized && snapshot.budgetExceeded && preferences.floatingBall.completionNotifications && lastBudgetDay !== today) {
        lastBudgetDay = today; notify(messages().widgetBudget, `${messages().widgetCost} ¥${snapshot.today.cost.toFixed(4)}`)
      }
      initialized = true
      render()
    } catch { if (!stopped) { snapshot = undefined; selected = undefined; bubble.hide() } }
    finally { if (!stopped) timer = setTimeout(() => { void poll() }, 1500) }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const hide = (): void => { if (!bubble.isDestroyed()) bubble.hide() }
  ball.on('move', position)
  ball.on('resize', position)
  ball.on('hide', hide)
  context.onConfig(render)
  context.onLocale(render)
  context.onStop(() => {
    stopped = true; clearTimeout(timer); control.abort()
    ball.off('move', position); ball.off('resize', position); ball.off('hide', hide)
    for (const item of notifications) item.close()
    notifications.clear()
  })
  await bubble.loadURL(`${SCHEME}://shell/floating-status.html`)
  void poll()
  return bubble
}
