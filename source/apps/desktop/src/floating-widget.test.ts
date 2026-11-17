/** 运行真实模块，验证 Host 请求契约、提醒去重和窗口生命周期。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

async function fixture() {
  const source = readFileSync(new URL('./floating-widget.ts', import.meta.url), 'utf8')
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const timers = new Map<number, () => void>()
  let timerId = 0, shown = 0, error = false
  const task = { sessionId: 'a', title: '任务', state: 'running', updatedAt: Date.now(), revision: 1, turn: 1 }
  const stops: (() => void)[] = [], commands = new Map<string, Function>()
  class FakeWindow {
    visible = false
    webContents = { send() {} }
    setAlwaysOnTop() {}
    setPosition() {}
    getBounds() { return { width: 96 } }
    on() {}
    off() {}
    isDestroyed() { return false }
    isVisible() { return this.visible }
    showInactive() { this.visible = true }
    hide() { this.visible = false }
    async loadURL() {}
  }
  const windows: FakeWindow[] = []
  class FakeNotification {
    static isSupported() { return true }
    once() {}
    show() { shown++ }
    close() {}
  }
  const config = { floatingBall: { taskBubbles: true, completionNotifications: true } }
  const module = { exports: {} as { attachFloatingWidget: Function } }
  runInNewContext(javascript, { exports: module.exports, module, require: (name: string) => {
    if (name === 'electron') return { BrowserWindow: FakeWindow, Notification: FakeNotification,
      screen: { getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) } }
    if (name === './ipc.ts') return { DESKTOP_IPC: { floatingWidgetState: 'state', floatingWidgetOpen: 'open' }, SCHEME: 'dsh' }
    if (name === './desktop-tools-config.ts') return { readDesktopToolsConfig: () => config }
    if (name === './floating-window.ts') return { floatingBallOrigin: () => ({ x: 1000, y: 400 }) }
    throw new Error(name)
  }, Date, AbortSignal, AbortController, JSON, setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId },
  clearTimeout: (id: number) => { timers.delete(id) } })
  const ball = new FakeWindow(); ball.visible = true
  const context = {
    environment: { profile: 'test', preload: 'test', locale: () => ({ messages: {} }) },
    own: (window: FakeWindow) => { windows.push(window); return window },
    handle: (name: string, action: Function) => { commands.set(name, action) },
    assertSender() {}, onConfig() {}, onLocale() {}, onStop: (action: () => void) => stops.push(action),
    async request(path: string, body: string) {
      assert.equal(path, '/.dsh/native-command')
      assert.equal(typeof body, 'string')
      assert.equal(JSON.parse(body).command, 'widget-snapshot')
      return { ok: !error, json: async () => ({ ok: !error, value: { tasks: [task], today: { cost: 1 }, budgetExceeded: false } }) }
    },
  }
  await module.exports.attachFloatingWidget(context, ball)
  await new Promise(resolve => setImmediate(resolve))
  return { task, windows, shown: () => shown, timers, config, commands,
    fail: () => { error = true },
    async tick() {
      const entry = timers.entries().next().value
      assert.ok(entry)
      const [id, callback] = entry
      timers.delete(id); callback()
      await new Promise(resolve => setImmediate(resolve))
    },
    stop() { for (const stop of stops) stop() },
  }
}

test('状态请求遵守字符串请求体契约，完成改名不重复提醒，新轮次会提醒', async () => {
  const f = await fixture()
  assert.equal(f.windows[0]?.visible, true)
  f.task.state = 'completed'; f.task.revision++
  await f.tick()
  assert.equal(f.shown(), 1)
  f.task.title = '新标题'; f.task.revision++
  await f.tick()
  assert.equal(f.shown(), 1)
  f.task.turn++; f.task.revision++
  await f.tick()
  assert.equal(f.shown(), 2)
  f.stop()
  assert.equal(f.timers.size, 0)
})

test('HTTP 失败隐藏过时气泡，停用停止轮询', async () => {
  const f = await fixture()
  f.fail()
  await f.tick()
  assert.equal(f.windows[0]?.visible, false)
  f.stop()
  assert.equal(f.timers.size, 0)
})
