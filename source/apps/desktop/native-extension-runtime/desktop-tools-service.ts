/** Host 侧桌面工具配置、功能生命周期与 Remote 接口。 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { installOrbAvatarFromBytes, readCustomOrbAvatarDataUrl, restoreOrbAvatar } from '../src/orb-avatar.ts'
import {
  parseDesktopToolsConfig,
  readDesktopToolsConfig,
  writeDesktopToolsConfig,
} from '../src/desktop-tools-config.ts'
import { captureVisionStatus, installCaptureVision, type CaptureVisionContext } from './capture-vision.ts'
import type {
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

interface DesktopRuntime {
  activate(descriptor: DesktopFeatureDescriptor): Promise<() => Promise<void>>
  command(command: 'capture-open' | 'permissions-status' | 'permission-open' | 'avatar-refresh', input: {
    readonly mode?: 'image' | 'video' | 'long'
    readonly right?: 'screen' | 'accessibility'
  }): Promise<unknown>
  dispose(): Promise<void>
}

interface DesktopToolsControllerOptions {
  readonly ctx: Context
  readonly profileDir: string
  readonly root: string
  readonly createRuntime: (onFailure: (error: Error) => void) => DesktopRuntime
}

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

  /** @param input 完整的新配置。 @returns 保存与应用结果。 */
  async update(input: DesktopToolsConfig): Promise<DesktopToolsUpdateResult> {
    const config = parseDesktopToolsConfig(input)
    writeDesktopToolsConfig(this.options.profileDir, config)
    this.config = config
    try {
      const snapshot = await this.exclusive(() => this.reconcile())
      return { saved: true, applied: this.isApplied(snapshot), snapshot }
    } catch (error: unknown) {
      this.options.ctx.logger.error('桌面工具已保存但应用失败: %s', error instanceof Error ? error.message : String(error))
      return { saved: true, applied: false, snapshot: this.snapshot() }
    }
  }

  /** @returns 重新创建辅助进程后的状态。 */
  restart(): Promise<DesktopToolsSnapshot> { return this.exclusive(() => this.reconcile()) }

  /** @returns 重新读取前置视觉插件状态后的快照。 */
  async refreshedSnapshot(): Promise<DesktopToolsSnapshot> {
    this.vision = await captureVisionStatus(this.options.ctx as unknown as CaptureVisionContext)
    return this.snapshot()
  }

  /** @returns 安装或启用 dsh-vision-router 后的状态与是否需要重启。 */
  async installVision(): Promise<{ readonly snapshot: DesktopToolsSnapshot; readonly restartRequired: boolean }> {
    const result = await installCaptureVision(this.options.ctx as unknown as CaptureVisionContext)
    this.vision = result.status
    return { snapshot: this.snapshot(), restartRequired: result.restartRequired }
  }

  /** @param mode 截图、录屏或长截图。 */
  async openCapture(mode: 'image' | 'video' | 'long'): Promise<void> {
    const enabled = mode === 'video' ? this.config.recording.enabled : this.config.screenshot.enabled
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
  avatar(): { readonly dataUrl?: string } {
    const dataUrl = readCustomOrbAvatarDataUrl(this.options.profileDir)
    return dataUrl === undefined ? {} : { dataUrl }
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
        this.statuses.set(id, { phase: 'active' })
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
      if (id === 'selection') return this.config.selection.enabled
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
  'snapshot', 'installVision', 'update', 'restart', 'openCapture',
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

  /** @param mode 截图、录屏或长截图。 */
  async openCapture(mode: 'image' | 'video' | 'long'): Promise<{ readonly opened: true }> {
    await this.controller.openCapture(mode)
    return { opened: true }
  }

  /** @returns 当前自定义头像的 data URL，未设置时省略。 */
  avatar(): { readonly dataUrl?: string } { return this.controller.avatar() }

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
