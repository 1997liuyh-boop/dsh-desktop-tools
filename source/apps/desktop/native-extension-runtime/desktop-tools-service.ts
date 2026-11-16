/** Host 侧桌面工具配置、功能生命周期与 Remote 接口。 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { installOrbAvatarFromBytes, readCustomOrbAvatarDataUrl, restoreOrbAvatar } from '../src/orb-avatar.ts'
import {
  DESKTOP_TOOLS_CONFIG_FILE,
  parseDesktopToolsConfig,
  readDesktopToolsConfig,
  writeDesktopToolsConfig,
} from '../src/desktop-tools-config.ts'
import { buildDiagnostics, type DiagnosticElectron, type DiagnosticInput } from '../src/desktop-diagnostics.ts'
import { locateKoffiPlatform } from '../src/koffi-platform.ts'
import { HistoryStore } from '../src/capture-history-store.ts'
import type { CaptureShortcutStatus } from '../src/capture-shortcuts.ts'
import { captureVisionStatus, installCaptureVision, type CaptureVisionContext } from './capture-vision.ts'
import { helperExecutableCandidates, isPackagedHost } from './helper-executable.ts'
import type {
  DesktopDiagnostics,
  DesktopFeatureId,
  DesktopFeatureStatus,
  DesktopToolsConfig,
  DesktopToolsSnapshot,
  DesktopToolsUpdateResult,
  DesktopVisionStatus,
} from '../src/desktop-tools-types.ts'
export type { DesktopFeatureStatus, DesktopToolsSnapshot, DesktopToolsUpdateResult } from '../src/desktop-tools-types.ts'

interface DesktopFeatureDescriptor {
  readonly id: string
  readonly root: string
  readonly entry: string
  readonly assets: string
}

/** Host 发给辅助进程的命令。 */
export type DesktopRuntimeCommand = 'capture-open' | 'permissions-status' | 'permission-open' | 'avatar-refresh' | 'shortcuts-status'
  | 'config-changed' | 'locale-changed' | 'history-changed'

interface DesktopRuntime {
  activate(descriptor: DesktopFeatureDescriptor): Promise<() => Promise<void>>
  command(command: DesktopRuntimeCommand, input: {
    readonly mode?: 'image' | 'video' | 'long' | 'pins' | 'history'
    readonly right?: 'screen' | 'accessibility'
    /** locale-changed：DSH 的语言偏好，null 表示跟随系统。 */
    readonly preference?: string | null
  }): Promise<unknown>
  /** 辅助进程上报的 Electron 版本；未启动时为 undefined。 */
  helperElectronVersion?(): string | undefined
  dispose(): Promise<void>
}

interface DesktopToolsControllerOptions {
  readonly ctx: Context
  readonly profileDir: string
  readonly root: string
  readonly createRuntime: (onFailure: (error: Error) => void) => DesktopRuntime
  /** 插件设置中显式指定的独立 Electron 路径。 */
  readonly electronExecutable?: string
  /** 诊断时使用的宿主信息，测试可替换。 */
  readonly host?: {
    readonly execPath?: string
    readonly env?: NodeJS.ProcessEnv
    readonly platform?: string
    readonly exists?: (path: string) => boolean
  }
}

/** @param value 辅助进程返回值。 @returns 是否为快捷键注册状态。 */
function isShortcutStatus(value: unknown): value is CaptureShortcutStatus {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.registered) && Array.isArray(record.failed)
}

/** @param error 任意异常。 @returns 可展示的错误信息。 */
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error) }

const FEATURE_ORDER: readonly DesktopFeatureId[] = ['capture', 'selection', 'floatingBall']

/** 配置写入成功与原生功能应用成功分别报告，单项启动失败不会阻止其他功能。 */
export class DesktopToolsController {
  private config: DesktopToolsConfig
  private runtime: DesktopRuntime | undefined
  private releases = new Map<DesktopFeatureId, () => Promise<void>>()
  private readonly statuses = new Map<DesktopFeatureId, DesktopFeatureStatus>()
  private queue: Promise<void> = Promise.resolve()
  private runtimeError: string | undefined
  private closed = false
  private vision: DesktopVisionStatus = { state: 'unknown' }

  /** @param options profile、包目录和辅助进程工厂。 */
  constructor(private readonly options: DesktopToolsControllerOptions) {
    this.config = readDesktopToolsConfig(options.profileDir)
    for (const id of FEATURE_ORDER) this.statuses.set(id, { phase: 'disabled' })
  }

  /** @returns 当前配置与实际运行状态。 */
  snapshot(): DesktopToolsSnapshot {
    const features = Object.fromEntries(FEATURE_ORDER.map(id => [id, this.statuses.get(id) ?? { phase: 'disabled' }])) as
      Record<DesktopFeatureId, DesktopFeatureStatus>
    const states = Object.values(features)
    return {
      config: parseDesktopToolsConfig(this.config),
      platform: process.platform,
      vision: this.vision,
      runtime: this.runtime === undefined ? 'stopped' : this.runtimeError !== undefined || states.some(item => item.phase === 'error') ? 'degraded' : 'running',
      features,
    }
  }

  /** @returns 首次后台应用完成后的状态。 */
  start(): Promise<DesktopToolsSnapshot> { return this.exclusive(() => this.reconcile()) }

  /** 从最新配置停用指定功能，保留辅助进程刚保存的模型等设置。 */
  disableFeature(feature: DesktopFeatureId): Promise<DesktopToolsSnapshot> {
    return this.exclusive(async () => {
      const current = readDesktopToolsConfig(this.options.profileDir)
      this.config = feature === 'capture' ? {
        ...current,
        screenshot: { ...current.screenshot, enabled: false },
        recording: { ...current.recording, enabled: false },
      } : { ...current, [feature]: { ...current[feature], enabled: false } }
      writeDesktopToolsConfig(this.options.profileDir, this.config)
      return this.apply()
    })
  }

  /** @param input 完整的新配置。 @returns 保存与应用结果。 */
  async update(input: DesktopToolsConfig): Promise<DesktopToolsUpdateResult> {
    const config = parseDesktopToolsConfig(input)
    writeDesktopToolsConfig(this.options.profileDir, config)
    this.config = config
    try {
      const snapshot = await this.exclusive(() => this.apply())
      const applied = this.isApplied(snapshot)
      // 功能启动成功不代表快捷键可用：被其他程序占用时只能从辅助进程读到。
      const failed = applied ? (await this.readShortcuts())?.status?.failed ?? [] : []
      return { saved: true, applied, snapshot, ...(failed.length === 0 ? {} : { shortcutFailures: failed }) }
    } catch (error: unknown) {
      this.options.ctx.logger.error('桌面工具已保存但应用失败: %s', error instanceof Error ? error.message : String(error))
      return { saved: true, applied: false, snapshot: this.snapshot() }
    }
  }

  /** @returns 重新创建辅助进程后的状态。 */
  restart(): Promise<DesktopToolsSnapshot> { return this.exclusive(() => this.reconcile()) }

  /**
   * 清空截图历史。直接在 Host 中删除目录，截图录屏未运行时也能清空；之后通知已打开的历史窗刷新。
   * @returns 清空结果。
   */
  async clearHistory(): Promise<{ readonly cleared: true }> {
    new HistoryStore(join(this.options.profileDir, 'desktop-tools', 'history')).clear()
    if (this.runtime !== undefined && this.statuses.get('capture')?.phase === 'active') {
      await this.runtime.command('history-changed', {}).catch((error: unknown) => {
        this.options.ctx.logger.warn('通知历史窗刷新失败: %s', errorText(error))
      })
    }
    return { cleared: true }
  }

  /** @param preference DSH 新的语言偏好；辅助进程未运行时忽略，下次启动会读取最新值。 */
  async localeChanged(preference: string | null): Promise<void> {
    if (this.runtime === undefined || this.releases.size === 0) return
    await this.runtime.command('locale-changed', { preference })
  }

  /** @returns 重新读取前置视觉插件状态后的快照。 */
  async refreshedSnapshot(): Promise<DesktopToolsSnapshot> {
    // 辅助进程会直接写入模型、语言等字段；设置页读取时以磁盘为准，避免保存时用旧值覆盖。
    try { this.config = readDesktopToolsConfig(this.options.profileDir) }
    catch (error: unknown) { this.options.ctx.logger.warn('桌面工具配置重新读取失败，沿用缓存: %s', errorText(error)) }
    this.vision = await captureVisionStatus(this.options.ctx as unknown as CaptureVisionContext)
    return this.snapshot()
  }

  /** @returns 安装或启用 dsh-vision-router 后的状态与是否需要重启。 */
  async installVision(): Promise<{ readonly snapshot: DesktopToolsSnapshot; readonly restartRequired: boolean }> {
    const result = await installCaptureVision(this.options.ctx as unknown as CaptureVisionContext)
    this.vision = result.status
    return { snapshot: this.snapshot(), restartRequired: result.restartRequired }
  }

  /** @returns 逐项诊断结果与运行环境摘要。 */
  async diagnose(): Promise<DesktopDiagnostics> {
    const snapshot = await this.refreshedSnapshot()
    const host = this.options.host ?? {}
    const exists = host.exists ?? existsSync
    const execPath = host.execPath ?? process.execPath
    const platform = host.platform ?? process.platform
    const packaged = isPackagedHost(execPath, exists)
    let configError: string | undefined
    try { readDesktopToolsConfig(this.options.profileDir) } catch (error: unknown) { configError = errorText(error) }
    const configured = this.options.electronExecutable
    let electron: DiagnosticElectron
    if (configured) electron = { kind: 'configured', path: configured, exists: exists(configured) }
    else if (!packaged) electron = { kind: 'dev', path: execPath, exists: true }
    else {
      const candidates = helperExecutableCandidates(host.env ?? process.env)
      const found = candidates.find(item => exists(item))
      electron = found === undefined ? { kind: 'missing', candidates } : { kind: 'found', path: found, exists: true }
    }
    const runtime = this.runtime
    const shortcuts = await this.readShortcuts()
    let permissions: DiagnosticInput['permissions']
    if (platform === 'darwin' && runtime !== undefined && this.statuses.get('floatingBall')?.phase === 'active') {
      try {
        const value = await runtime.command('permissions-status', {})
        if (typeof value === 'object' && value !== null) {
          const record = value as Record<string, unknown>
          permissions = {
            ...(typeof record.screen === 'boolean' ? { screen: record.screen } : {}),
            ...(typeof record.accessibility === 'boolean' ? { accessibility: record.accessibility } : {}),
          }
        }
      } catch { /* 无法读取时对应诊断项标为暂时无法检查。 */ }
    }
    const hostElectron = process.versions.electron
    const helperElectron = runtime?.helperElectronVersion?.()
    const items = buildDiagnostics({
      platform,
      config: { path: join(this.options.profileDir, DESKTOP_TOOLS_CONFIG_FILE), ...(configError === undefined ? {} : { error: configError }) },
      electron,
      ...(hostElectron === undefined ? {} : { hostElectron }),
      ...(helperElectron === undefined ? {} : { helperElectron }),
      koffi: locateKoffiPlatform(),
      snapshot,
      ...(this.runtimeError === undefined ? {} : { runtimeError: this.runtimeError }),
      ...(shortcuts === undefined ? {} : { shortcuts }),
      ...(permissions === undefined ? {} : { permissions }),
    })
    return {
      generatedAt: new Date().toISOString(),
      environment: {
        plugin: this.pluginVersion(), platform, arch: process.arch, packaged,
        ...(hostElectron === undefined ? {} : { hostElectron }),
        ...(helperElectron === undefined ? {} : { helperElectron }),
      },
      items,
    }
  }

  /** @returns 截图录屏运行时的快捷键注册状态或读取失败原因；未运行时为 undefined。 */
  private async readShortcuts(): Promise<DiagnosticInput['shortcuts']> {
    const runtime = this.runtime
    if (runtime === undefined || this.statuses.get('capture')?.phase !== 'active') return undefined
    try {
      const value = await runtime.command('shortcuts-status', {})
      return isShortcutStatus(value) ? { status: value } : { error: '辅助进程返回的快捷键状态无效' }
    } catch (error: unknown) { return { error: errorText(error) } }
  }

  /** @returns 安装包 package.json 中的版本号；读取失败时为 unknown。 */
  private pluginVersion(): string {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(this.options.root, 'package.json'), 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { version?: unknown }).version === 'string') {
        return (parsed as { version: string }).version
      }
    } catch { /* 版本号只用于报告，读取失败不影响诊断。 */ }
    return 'unknown'
  }

  /** @param mode 截图、录屏或长截图。 */
  async openCapture(mode: 'image' | 'video' | 'long' | 'pins' | 'history'): Promise<void> {
    // 钉图随截图录屏功能恢复，只开录屏时也能管理已有钉图。
    const enabled = mode === 'pins' || mode === 'history' ? this.config.screenshot.enabled || this.config.recording.enabled
      : mode === 'video' ? this.config.recording.enabled : this.config.screenshot.enabled
    if (!enabled) throw new Error(mode === 'video' ? '录屏功能未启用' : '截图功能未启用')
    if (this.statuses.get('capture')?.phase !== 'active' || this.runtime === undefined) throw new Error('截图录屏功能尚未就绪')
    await this.runtime.command('capture-open', { mode })
  }

  /** @returns 当前系统权限状态。 @throws 悬浮球或辅助进程尚未运行时拒绝。 */
  async systemPermissions(): Promise<unknown> {
    if (this.runtime === undefined || this.statuses.get('floatingBall')?.phase !== 'active') throw new Error('悬浮球功能尚未就绪')
    return this.runtime.command('permissions-status', {})
  }

  /** @param right 要打开的系统权限类别。 @returns 更新后的系统权限状态。 */
  async openSystemPermission(right: 'screen' | 'accessibility'): Promise<unknown> {
    if (this.runtime === undefined || this.statuses.get('floatingBall')?.phase !== 'active') throw new Error('悬浮球功能尚未就绪')
    return this.runtime.command('permission-open', { right })
  }

  /** @returns 当前自定义头像的 data URL，未设置时省略。 */
  avatar(): { readonly dataUrl?: string; readonly defaultDataUrl?: string } {
    const dataUrl = readCustomOrbAvatarDataUrl(this.options.profileDir)
    if (dataUrl !== undefined) return { dataUrl }
    // 默认头像 GIF 约 7.7 MB，设置页只需预览，改用打包时生成的 128px 静态缩略图。
    try {
      const preview = readFileSync(join(this.options.root, 'assets', 'deepseek-avatar-preview.png'))
      return { defaultDataUrl: `data:image/png;base64,${preview.toString('base64')}` }
    } catch {
      return {}
    }
  }

  /** @param bytes 图片字节。 @param fileName 用户选择的文件名。 @returns 保存和 Helper 刷新状态。 */
  async setAvatar(bytes: Uint8Array, fileName: string): Promise<{ readonly saved: boolean; readonly applied: boolean; readonly error?: string }> {
    const result = installOrbAvatarFromBytes(this.options.profileDir, bytes, fileName)
    if (!result.ok) throw new Error(result.error === 'too-large' ? '头像图片不能超过 2 MB' : '头像必须是有效的 GIF、PNG 或 WebP 图片')
    if (this.runtime === undefined || this.statuses.get('floatingBall')?.phase !== 'active') return { saved: true, applied: false }
    try {
      await this.runtime.command('avatar-refresh', {})
      return { saved: true, applied: true }
    } catch (error: unknown) {
      return { saved: true, applied: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** @returns 恢复内置头像后的 Helper 刷新状态。 */
  async restoreAvatar(): Promise<{ readonly saved: boolean; readonly applied: boolean; readonly error?: string }> {
    restoreOrbAvatar(this.options.profileDir)
    if (this.runtime === undefined || this.statuses.get('floatingBall')?.phase !== 'active') return { saved: true, applied: false }
    try {
      await this.runtime.command('avatar-refresh', {})
      return { saved: true, applied: true }
    } catch (error: unknown) {
      return { saved: true, applied: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** @returns 所有功能和辅助进程已停止。 */
  dispose(): Promise<void> {
    this.closed = true
    return this.exclusive(async () => { await this.stopCurrent(); return this.snapshot() }).then(() => undefined)
  }

  private exclusive(operation: () => Promise<DesktopToolsSnapshot>): Promise<DesktopToolsSnapshot> {
    const result = this.queue.then(operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  /**
   * 按配置差异更新：只启停开关发生变化的功能，仍在运行的功能就地重读配置，不关闭已打开的窗口。
   * 辅助进程未运行、状态异常或任一步失败时，回退为整体重建。
   */
  private async apply(): Promise<DesktopToolsSnapshot> {
    if (this.closed) throw new Error('桌面工具控制器已关闭')
    const runtime = this.runtime
    const healthy = runtime !== undefined && this.runtimeError === undefined
      && FEATURE_ORDER.every(id => this.statuses.get(id)?.phase !== 'error' && this.statuses.get(id)?.phase !== 'starting')
    const wanted = new Set(this.enabledFeatures())
    if (!healthy || wanted.size === 0) return this.reconcile()
    try {
      for (const id of [...FEATURE_ORDER].reverse()) {
        const release = this.releases.get(id)
        if (release === undefined || wanted.has(id)) continue
        await release()
        this.releases.delete(id)
        this.statuses.set(id, { phase: 'disabled' })
      }
      // 先让仍在运行的功能重读配置，再启动新增功能（新功能启动时自然读取最新配置）。
      if (this.releases.size > 0) await runtime.command('config-changed', {})
      for (const id of FEATURE_ORDER) {
        if (!wanted.has(id) || this.releases.has(id)) continue
        this.statuses.set(id, { phase: 'starting' })
        this.releases.set(id, await runtime.activate(this.descriptor(id)))
      }
      for (const id of this.releases.keys()) {
        this.statuses.set(id, { phase: id === 'selection' && !this.config.selection.enabled ? 'disabled' : 'active' })
      }
      return this.snapshot()
    } catch (error: unknown) {
      this.options.ctx.logger.warn('桌面工具按需更新失败，改为整体重建: %s', errorText(error))
      return this.reconcile()
    }
  }

  private async reconcile(): Promise<DesktopToolsSnapshot> {
    if (this.closed) throw new Error('桌面工具控制器已关闭')
    await this.stopCurrent()
    const enabled = this.enabledFeatures()
    if (enabled.length === 0) return this.snapshot()
    const runtime = this.options.createRuntime(error => { this.runtimeFailed(error) })
    this.runtime = runtime
    this.runtimeError = undefined
    for (const id of enabled) {
      this.statuses.set(id, { phase: 'starting' })
      try {
        const release = await runtime.activate(this.descriptor(id))
        this.releases.set(id, release)
        this.statuses.set(id, { phase: id === 'selection' && !this.config.selection.enabled ? 'disabled' : 'active' })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        this.statuses.set(id, { phase: 'error', error: message })
        this.options.ctx.logger.error('桌面工具功能启动失败 (%s): %s', id, message)
      }
    }
    if (this.releases.size === 0) {
      try {
        await runtime.dispose()
        if (this.runtime === runtime) this.runtime = undefined
      } catch (error: unknown) {
        this.runtimeError = error instanceof Error ? error.message : String(error)
        this.options.ctx.logger.error('桌面工具辅助进程清理失败: %s', this.runtimeError)
      }
    }
    return this.snapshot()
  }

  private async stopCurrent(): Promise<void> {
    const runtime = this.runtime
    const failures: unknown[] = []
    for (const id of [...FEATURE_ORDER].reverse()) {
      const release = this.releases.get(id)
      if (release === undefined) continue
      try {
        await release()
        this.releases.delete(id)
        this.statuses.set(id, { phase: 'disabled' })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        this.statuses.set(id, { phase: 'error', error: message })
        failures.push(error)
      }
    }
    if (failures.length > 0) throw new AggregateError(failures, '桌面工具停止失败，未启动新的辅助进程')
    if (runtime !== undefined) {
      try {
        await runtime.dispose()
        if (this.runtime === runtime) this.runtime = undefined
        this.runtimeError = undefined
      } catch (error: unknown) {
        this.runtimeError = error instanceof Error ? error.message : String(error)
        throw new AggregateError([error], '桌面工具辅助进程清理失败，未启动新的辅助进程')
      }
    }
    for (const id of FEATURE_ORDER) this.statuses.set(id, { phase: 'disabled' })
  }

  private enabledFeatures(): DesktopFeatureId[] {
    return FEATURE_ORDER.filter(id => {
      if (id === 'capture') return this.config.screenshot.enabled || this.config.recording.enabled
      // 关闭取词监听后，悬浮球仍需复用公众号窗口和划词模型设置服务。
      if (id === 'selection') return this.config.selection.enabled || this.config.floatingBall.enabled
      return this.config.floatingBall.enabled
    })
  }

  private descriptor(id: DesktopFeatureId): DesktopFeatureDescriptor {
    const entry = id === 'capture' ? 'dist/capture.js' : id === 'selection' ? 'dist/selection.js' : 'dist/floating.js'
    const pluginId = id === 'capture' ? 'dsh-capture' : id === 'selection' ? 'dsh-selection-toolbar' : 'dsh-floating-ball'
    return { id: pluginId, root: this.options.root, entry, assets: 'assets' }
  }

  private runtimeFailed(error: Error): void {
    if (this.runtime === undefined) return
    for (const id of FEATURE_ORDER) {
      if (this.statuses.get(id)?.phase === 'active' || this.statuses.get(id)?.phase === 'starting') {
        this.statuses.set(id, { phase: 'error', error: error.message })
      }
    }
  }

  private isApplied(snapshot: DesktopToolsSnapshot): boolean {
    return FEATURE_ORDER.every(id => {
      const expected = id === 'capture' ? snapshot.config.screenshot.enabled || snapshot.config.recording.enabled
        : id === 'selection' ? snapshot.config.selection.enabled : snapshot.config.floatingBall.enabled
      return snapshot.features[id].phase === (expected ? 'active' : 'disabled')
    })
  }
}

/** 通过 Gateway 公开给设置客户端的方法。 */
const REMOTE_METHODS = [
  'snapshot', 'installVision', 'update', 'restart', 'openCapture', 'diagnose', 'clearHistory',
  'avatar', 'setAvatar', 'restoreAvatar', 'systemPermissions', 'openSystemPermission',
] as const

/**
 * 按 TC39 标准装饰器语义为实例方法应用 Remote 标记。
 * 打包器只会把装饰器语法降级为旧式 `(target, key, descriptor)` 调用，
 * 而 typert-protocol 的 Remote 只接受标准 `(method, context)` 形式，因此不使用装饰器语法。
 * @param instance 刚完成 super() 的服务实例。
 * @param names 需要公开的公共实例方法名。
 */
function markRemoteMethods(instance: object, names: readonly string[]): void {
  const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>
  for (const name of names) {
    const method = prototype[name]
    if (typeof method !== 'function') throw new TypeError(`桌面工具 Remote 方法不存在: ${name}`)
    const initializers: ((this: object) => void)[] = []
    const context = {
      kind: 'method', name, static: false, private: false, metadata: {},
      access: { has: (target: object) => name in target, get: (target: object) => (target as Record<string, unknown>)[name] },
      addInitializer: (initializer: (this: object) => void) => { initializers.push(initializer) },
    } as unknown as ClassMethodDecoratorContext<object, (this: object, ...args: unknown[]) => unknown>
    ;(Remote as (method: (this: object, ...args: unknown[]) => unknown, context: ClassMethodDecoratorContext<object, (this: object, ...args: unknown[]) => unknown>) => void)(
      method as (this: object, ...args: unknown[]) => unknown, context)
    for (const initializer of initializers) initializer.call(instance)
  }
}

/** 设置客户端使用的桌面工具 Remote 服务。 */
export class DesktopToolsService extends TypertRemoteService {
  /** @param ctx Cordis Host。 @param controller 桌面工具控制器。 */
  constructor(ctx: Context, private readonly controller: DesktopToolsController) {
    super(ctx, 'desktopTools')
    markRemoteMethods(this, REMOTE_METHODS)
  }

  /** @returns 当前配置与实际运行状态。 */
  snapshot(): Promise<DesktopToolsSnapshot> { return this.controller.refreshedSnapshot() }

  /** @returns 安装或启用前置插件 dsh-vision-router 的结果。 */
  installVision(): Promise<{ readonly snapshot: DesktopToolsSnapshot; readonly restartRequired: boolean }> { return this.controller.installVision() }

  /** @param config 完整的新配置。 @returns 保存与应用结果。 */
  update(config: DesktopToolsConfig): Promise<DesktopToolsUpdateResult> { return this.controller.update(config) }

  /** @returns 重新创建辅助进程后的状态。 */
  restart(): Promise<DesktopToolsSnapshot> { return this.controller.restart() }

  /** @returns 逐项诊断结果与运行环境摘要。 */
  diagnose(): Promise<DesktopDiagnostics> { return this.controller.diagnose() }

  /** @returns 清空截图历史的结果。 */
  clearHistory(): Promise<{ readonly cleared: true }> { return this.controller.clearHistory() }

  /** @param mode 截图、录屏或长截图。 */
  async openCapture(mode: 'image' | 'video' | 'long' | 'pins' | 'history'): Promise<{ readonly opened: true }> {
    await this.controller.openCapture(mode)
    return { opened: true }
  }

  /** @returns 当前自定义头像的 data URL，未设置时省略。 */
  avatar(): { readonly dataUrl?: string; readonly defaultDataUrl?: string } { return this.controller.avatar() }

  /** @param bytes 图片内容。 @param fileName 用户选择的文件名。 */
  setAvatar(dataUrl: string, fileName: string) {
    const match = /^data:image\/(?:gif|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(dataUrl)
    if (match === null || dataUrl.length > 2_800_000) throw new Error('头像图片数据无效或超过 2 MB')
    const encoded = match[1]
    if (encoded === undefined) throw new Error('头像图片数据无效')
    const bytes = Buffer.from(encoded, 'base64')
    if (bytes.toString('base64') !== encoded) throw new Error('头像图片数据无效')
    return this.controller.setAvatar(bytes, fileName)
  }

  /** @returns 恢复头像后的持久化与 Helper 应用状态。 */
  restoreAvatar() { return this.controller.restoreAvatar() }

  /** @returns 系统权限状态。 */
  systemPermissions() { return this.controller.systemPermissions() }

  /** @param right 要打开的系统权限类别。 */
  openSystemPermission(right: 'screen' | 'accessibility') { return this.controller.openSystemPermission(right) }
}
