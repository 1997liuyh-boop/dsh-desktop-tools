import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { DesktopToolsController } from './desktop-tools-service.ts'
import { defaultDesktopToolsConfig, DESKTOP_TOOLS_CONFIG_FILE } from '../src/desktop-tools-config.ts'
import type { DesktopToolsConfig } from '../src/desktop-tools-types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

/** 可控的假辅助进程：记录激活与停用，可指定激活失败的功能。 */
class FakeRuntime {
  readonly activated: string[] = []
  readonly released: string[] = []
  /** 收到的命令与参数，按顺序。 */
  readonly received: [string, unknown][] = []
  disposed = 0
  constructor(readonly onFailure: (error: Error) => void, private readonly failing: ReadonlySet<string>,
    private readonly commands: Record<string, unknown>) {}

  async activate(descriptor: { readonly id: string }): Promise<() => Promise<void>> {
    if (this.failing.has(descriptor.id)) throw new Error(`${descriptor.id} 启动失败`)
    this.activated.push(descriptor.id)
    return async () => { this.released.push(descriptor.id) }
  }

  async command(command: string, input: unknown = {}): Promise<unknown> {
    this.received.push([command, input])
    // 通知类命令没有返回值，默认成功。
    if (['config-changed', 'locale-changed', 'history-changed'].includes(command) && !(command in this.commands)) return undefined
    if (!(command in this.commands)) throw new Error(`未模拟的命令 ${command}`)
    const value = this.commands[command]
    if (value instanceof Error) throw value
    return value
  }

  helperElectronVersion(): string { return '39.2.0' }

  async dispose(): Promise<void> { this.disposed += 1 }
}

function setup(options: { readonly failing?: readonly string[]; readonly commands?: Record<string, unknown>; readonly config?: DesktopToolsConfig } = {}) {
  const profileDir = mkdtempSync(join(tmpdir(), 'dsh-desktop-tools-'))
  if (options.config !== undefined) writeFileSync(join(profileDir, DESKTOP_TOOLS_CONFIG_FILE), JSON.stringify(options.config))
  const runtimes: FakeRuntime[] = []
  const errors: string[] = []
  const ctx = {
    logger: { info() {}, warn() {}, error(format: string, ...args: unknown[]) { errors.push([format, ...args].join(' ')) } },
    get() { return undefined },
  } as unknown as Context
  const controller = new DesktopToolsController({
    ctx, profileDir, root: ROOT,
    createRuntime: (onFailure) => {
      const runtime = new FakeRuntime(onFailure, new Set(options.failing ?? []), options.commands ?? {})
      runtimes.push(runtime)
      return runtime
    },
    host: { execPath: 'D:/dsh/DeepSeek Harness.exe', env: { DSH_HOME: 'C:/home/.dsh' }, platform: 'win32', exists: () => false },
  })
  const cleanup = (): void => { rmSync(profileDir, { recursive: true, force: true }) }
  return { controller, runtimes, errors, profileDir, cleanup }
}

const withCapture = (config: DesktopToolsConfig): DesktopToolsConfig => ({
  ...config,
  screenshot: { ...config.screenshot, enabled: true },
  recording: { ...config.recording, enabled: true },
})

test('首次启动按默认配置启用划词与悬浮球', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  const snapshot = await controller.start()
  assert.equal(snapshot.runtime, 'running')
  assert.deepEqual(snapshot.features, { capture: { phase: 'disabled' }, selection: { phase: 'active' }, floatingBall: { phase: 'active' } })
  assert.deepEqual(runtimes[0]?.activated, ['dsh-selection-toolbar', 'dsh-floating-ball'])
})

test('单个功能启动失败不影响其他功能，保存结果分开报告', async (t) => {
  const { controller, cleanup } = setup({ failing: ['dsh-floating-ball'] })
  t.after(cleanup)
  const snapshot = await controller.start()
  assert.equal(snapshot.runtime, 'degraded')
  assert.equal(snapshot.features.selection.phase, 'active')
  assert.deepEqual(snapshot.features.floatingBall, { phase: 'error', error: 'dsh-floating-ball 启动失败' })
  const result = await controller.update(snapshot.config)
  assert.equal(result.saved, true)
  assert.equal(result.applied, false)
})

test('启用新功能时只启动这一个功能，其余功能就地重读配置，辅助进程不重建', async (t) => {
  const { controller, runtimes, profileDir, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  const result = await controller.update(withCapture(defaultDesktopToolsConfig()))
  assert.equal(result.applied, true)
  assert.equal(result.snapshot.features.capture.phase, 'active')
  assert.equal(runtimes.length, 1)
  assert.equal(runtimes[0]?.disposed, 0)
  assert.deepEqual(runtimes[0]?.released, [])
  assert.deepEqual(runtimes[0]?.activated, ['dsh-selection-toolbar', 'dsh-floating-ball', 'dsh-capture'])
  assert.deepEqual(runtimes[0]?.received.map(([name]) => name).filter(name => name === 'config-changed'), ['config-changed'])
  const saved = JSON.parse(readFileSync(join(profileDir, DESKTOP_TOOLS_CONFIG_FILE), 'utf8')) as DesktopToolsConfig
  assert.equal(saved.screenshot.enabled, true)
})

test('只改参数时不启停任何功能，只通知辅助进程重读配置', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  const config = defaultDesktopToolsConfig()
  const result = await controller.update({ ...config, selection: { ...config.selection, targetLanguage: '日本語' } })
  assert.equal(result.applied, true)
  assert.equal(runtimes.length, 1)
  assert.deepEqual(runtimes[0]?.released, [])
  assert.deepEqual(runtimes[0]?.activated, ['dsh-selection-toolbar', 'dsh-floating-ball'])
  assert.deepEqual(runtimes[0]?.received, [['config-changed', {}]])
})

test('关闭某个功能时只停这一个功能', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  const config = defaultDesktopToolsConfig()
  // 只关悬浮球：划词仍启用，划词插件保持运行。
  const result = await controller.update({ ...config, floatingBall: { ...config.floatingBall, enabled: false } })
  assert.equal(result.applied, true)
  assert.equal(runtimes.length, 1)
  assert.deepEqual(runtimes[0]?.released, ['dsh-floating-ball'])
  assert.equal(result.snapshot.features.floatingBall.phase, 'disabled')
  assert.equal(result.snapshot.features.selection.phase, 'active')
})

test('全部功能关闭时停止辅助进程', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  const config = defaultDesktopToolsConfig()
  const snapshot = (await controller.update({ ...config, selection: { ...config.selection, enabled: false }, floatingBall: { ...config.floatingBall, enabled: false } })).snapshot
  assert.equal(snapshot.runtime, 'stopped')
  assert.equal(runtimes[0]?.disposed, 1)
})

test('辅助进程状态异常或通知失败时回退为整体重建', async (t) => {
  const degraded = setup({ failing: ['dsh-floating-ball'] })
  t.after(degraded.cleanup)
  const snapshot = await degraded.controller.start()
  await degraded.controller.update(snapshot.config)
  assert.equal(degraded.runtimes.length, 2)

  const broken = setup({ commands: { 'config-changed': new Error('helper busy') } })
  t.after(broken.cleanup)
  await broken.controller.start()
  const config = defaultDesktopToolsConfig()
  const result = await broken.controller.update({ ...config, selection: { ...config.selection, targetLanguage: '日本語' } })
  assert.equal(result.applied, true)
  assert.equal(broken.runtimes.length, 2)
  assert.equal(broken.runtimes[0]?.disposed, 1)
})

test('语言切换转发给运行中的辅助进程，未运行时忽略', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  await controller.localeChanged('en')
  assert.equal(runtimes.length, 0)
  await controller.start()
  await controller.localeChanged('ja')
  assert.deepEqual(runtimes[0]?.received, [['locale-changed', { preference: 'ja' }]])
})

test('清空历史直接删除目录，截图录屏运行时通知历史窗刷新', async (t) => {
  const { controller, runtimes, profileDir, cleanup } = setup({ config: withCapture(defaultDesktopToolsConfig()) })
  t.after(cleanup)
  const directory = join(profileDir, 'desktop-tools', 'history')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'history.json'), '[]')
  await controller.clearHistory()
  assert.equal(existsSync(directory), false)
  assert.deepEqual(runtimes, [])
  await controller.start()
  await controller.clearHistory()
  assert.deepEqual(runtimes[0]?.received.map(([name]) => name), ['history-changed'])
})

test('保存时附带未能注册的快捷键，全部成功时省略', async (t) => {
  const failed = [{ accelerator: 'CommandOrControl+Shift+S', reason: 'occupied' }]
  const occupied = setup({ commands: { 'shortcuts-status': { registered: [], failed } } })
  t.after(occupied.cleanup)
  await occupied.controller.start()
  const result = await occupied.controller.update(withCapture(defaultDesktopToolsConfig()))
  assert.equal(result.applied, true)
  assert.deepEqual(result.shortcutFailures, failed)

  const clean = setup({ commands: { 'shortcuts-status': { registered: ['CommandOrControl+Shift+S'], failed: [] } } })
  t.after(clean.cleanup)
  await clean.controller.start()
  const ok = await clean.controller.update(withCapture(defaultDesktopToolsConfig()))
  assert.equal(ok.applied, true)
  assert.equal('shortcutFailures' in ok, false)

  // 截图录屏未启用时不查询快捷键。
  const off = await clean.controller.update(defaultDesktopToolsConfig())
  assert.equal('shortcutFailures' in off, false)
})

test('设置页读取时以磁盘为准，看得到辅助进程写入的字段', async (t) => {
  const { controller, profileDir, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  // 模拟辅助进程在结果窗里改了目标语言。
  const config = defaultDesktopToolsConfig()
  writeFileSync(join(profileDir, DESKTOP_TOOLS_CONFIG_FILE), JSON.stringify({ ...config, selection: { ...config.selection, targetLanguage: '日本語' } }))
  assert.equal(controller.snapshot().config.selection.targetLanguage, 'en')
  const snapshot = await controller.refreshedSnapshot()
  assert.equal(snapshot.config.selection.targetLanguage, '日本語')
})

test('只启用录屏时也能打开钉图管理，但不能截图', async (t) => {
  const base = defaultDesktopToolsConfig()
  const { controller, runtimes, cleanup } = setup({ config: { ...base, recording: { ...base.recording, enabled: true } }, commands: { 'capture-open': undefined } })
  t.after(cleanup)
  await controller.start()
  await controller.openCapture('pins')
  await assert.rejects(controller.openCapture('image'), /截图功能未启用/u)
  assert.equal(runtimes.length, 1)
})

test('停用截图录屏会同时关闭截图和录屏并写盘', async (t) => {
  const { controller, profileDir, cleanup } = setup({ config: withCapture(defaultDesktopToolsConfig()) })
  t.after(cleanup)
  await controller.start()
  const snapshot = await controller.disableFeature('capture')
  assert.equal(snapshot.features.capture.phase, 'disabled')
  const saved = JSON.parse(readFileSync(join(profileDir, DESKTOP_TOOLS_CONFIG_FILE), 'utf8')) as DesktopToolsConfig
  assert.deepEqual([saved.screenshot.enabled, saved.recording.enabled], [false, false])
  assert.equal(saved.selection.enabled, true)
})

test('辅助进程异常退出后，运行中的功能标为错误', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  runtimes[0]?.onFailure(new Error('Native desktop helper exited (1)'))
  const snapshot = controller.snapshot()
  assert.equal(snapshot.runtime, 'degraded')
  assert.deepEqual(snapshot.features.selection, { phase: 'error', error: 'Native desktop helper exited (1)' })
})

test('关闭后拒绝再次启动', async (t) => {
  const { controller, runtimes, cleanup } = setup()
  t.after(cleanup)
  await controller.start()
  await controller.dispose()
  assert.equal(runtimes[0]?.disposed, 1)
  await assert.rejects(controller.start(), /已关闭/u)
})

test('诊断汇总可执行文件、辅助进程版本与快捷键状态', async (t) => {
  const { controller, cleanup } = setup({
    config: withCapture(defaultDesktopToolsConfig()),
    commands: { 'shortcuts-status': { registered: ['CommandOrControl+Shift+S'], failed: [{ accelerator: 'CommandOrControl+Shift+R', reason: 'occupied' }] } },
  })
  t.after(cleanup)
  await controller.start()
  const diagnostics = await controller.diagnose()
  const byId = new Map(diagnostics.items.map(item => [item.id, item]))
  assert.equal(diagnostics.environment.packaged, false)
  assert.equal(diagnostics.environment.helperElectron, '39.2.0')
  assert.notEqual(diagnostics.environment.plugin, 'unknown')
  assert.equal(byId.get('config')?.status, 'ok')
  assert.equal(byId.get('electron')?.message, 'diagElectronDev')
  assert.equal(byId.get('runtime')?.status, 'ok')
  assert.deepEqual([byId.get('shortcuts')?.status, byId.get('shortcuts')?.values?.occupied], ['warn', 'CommandOrControl+Shift+R'])
})

test('诊断能识别打包版缺少独立 Electron 与损坏的配置文件', async (t) => {
  const profileDir = mkdtempSync(join(tmpdir(), 'dsh-desktop-tools-'))
  t.after(() => { rmSync(profileDir, { recursive: true, force: true }) })
  const execPath = join('D:', 'dsh', 'DeepSeek Harness.exe')
  const asar = join('D:', 'dsh', 'resources', 'app.asar')
  const controller = new DesktopToolsController({
    ctx: { logger: { info() {}, warn() {}, error() {} }, get() { return undefined } } as unknown as Context,
    profileDir, root: ROOT,
    createRuntime: onFailure => new FakeRuntime(onFailure, new Set(), {}),
    host: { execPath, env: { DSH_HOME: join('C:', 'home', '.dsh') }, platform: 'win32', exists: path => path === asar },
  })
  // 控制器已按默认配置载入后，配置文件被外部改坏。
  writeFileSync(join(profileDir, DESKTOP_TOOLS_CONFIG_FILE), '{ broken')
  const diagnostics = await controller.diagnose()
  const byId = new Map(diagnostics.items.map(item => [item.id, item]))
  assert.equal(diagnostics.environment.packaged, true)
  assert.equal(byId.get('electron')?.status, 'error')
  assert.match(byId.get('electron')?.values?.tried ?? '', /\.dsh/u)
  assert.equal(byId.get('config')?.status, 'error')
})
