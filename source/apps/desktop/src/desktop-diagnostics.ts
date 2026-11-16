/** 桌面工具诊断：根据已采集的运行数据给出逐项结论（纯函数，Host 与 Client 共用）。 */
import type { CaptureShortcutStatus } from './capture-shortcuts.ts'
import type {
  DesktopDiagnosticItem,
  DesktopDiagnostics,
  DesktopFeatureId,
  DesktopToolsConfig,
  DesktopToolsSnapshot,
} from './desktop-tools-types.ts'

/** 辅助进程可执行文件的选取结果。 */
export type DiagnosticElectron =
  | { readonly kind: 'configured' | 'dev' | 'found'; readonly path: string; readonly exists: boolean }
  | { readonly kind: 'missing'; readonly candidates: readonly string[] }

/** 诊断所需的全部采集数据；某项无法采集时省略对应字段。 */
export interface DiagnosticInput {
  readonly platform: string
  /** 配置文件读取结果。 */
  readonly config: { readonly path: string; readonly error?: string }
  readonly electron: DiagnosticElectron
  readonly hostElectron?: string
  readonly helperElectron?: string
  /** Koffi 预编译包解析结果；packageName 缺省表示当前平台不提供。 */
  readonly koffi: { readonly packageName?: string; readonly path?: string; readonly error?: string }
  readonly snapshot: DesktopToolsSnapshot
  readonly runtimeError?: string
  /** 截图录屏运行时读取到的快捷键状态，或读取失败的原因；截图录屏未运行时省略。 */
  readonly shortcuts?: { readonly status?: CaptureShortcutStatus; readonly error?: string }
  /** macOS 系统权限；悬浮球未运行或非 macOS 时省略。 */
  readonly permissions?: { readonly screen?: boolean; readonly accessibility?: boolean }
}

const FEATURES: readonly [DesktopFeatureId, DesktopDiagnosticItem['id']][] = [
  ['selection', 'feature-selection'], ['floatingBall', 'feature-floatingBall'], ['capture', 'feature-capture'],
]

/** @param config 当前配置。 @param id 功能。 @returns 配置中是否要求启用该功能。 */
function featureWanted(config: DesktopToolsConfig, id: DesktopFeatureId): boolean {
  if (id === 'capture') return config.screenshot.enabled || config.recording.enabled
  return id === 'selection' ? config.selection.enabled : config.floatingBall.enabled
}

/** @param version Electron 版本号。 @returns 主版本号。 */
function major(version: string): string { return version.split('.')[0] ?? version }

function electronItem(electron: DiagnosticElectron): DesktopDiagnosticItem {
  if (electron.kind === 'missing') {
    return { id: 'electron', status: 'error', message: 'diagElectronMissing', values: { tried: electron.candidates.join('\n') } }
  }
  if (!electron.exists) return { id: 'electron', status: 'error', message: 'diagElectronNotFound', values: { path: electron.path } }
  const message = electron.kind === 'dev' ? 'diagElectronDev' : electron.kind === 'configured' ? 'diagElectronConfigured' : 'diagElectronFound'
  return { id: 'electron', status: 'ok', message, values: { path: electron.path } }
}

function versionItem(host: string | undefined, helper: string | undefined): DesktopDiagnosticItem {
  if (host === undefined || helper === undefined) return { id: 'electron-version', status: 'skip', message: 'diagElectronVersionUnknown' }
  const values = { host, helper }
  if (major(host) !== major(helper)) return { id: 'electron-version', status: 'warn', message: 'diagElectronVersionMismatch', values }
  return { id: 'electron-version', status: 'ok', message: 'diagElectronVersionMatch', values }
}

function koffiItem(koffi: DiagnosticInput['koffi'], platform: string): DesktopDiagnosticItem {
  if (koffi.packageName === undefined) return { id: 'native-module', status: 'skip', message: 'diagNativeUnsupported', values: { platform } }
  if (koffi.path === undefined) {
    return { id: 'native-module', status: 'error', message: 'diagNativeMissing', values: { name: koffi.packageName, error: koffi.error ?? '' } }
  }
  return { id: 'native-module', status: 'ok', message: 'diagNativeFound', values: { name: koffi.packageName } }
}

function runtimeItem(input: DiagnosticInput): DesktopDiagnosticItem {
  const { snapshot } = input
  const wanted = FEATURES.some(([id]) => featureWanted(snapshot.config, id))
  const firstError = input.runtimeError ?? FEATURES.map(([id]) => snapshot.features[id].error).find(item => item !== undefined) ?? ''
  if (snapshot.runtime === 'running') return { id: 'runtime', status: 'ok', message: 'diagRuntimeRunning' }
  if (snapshot.runtime === 'degraded') return { id: 'runtime', status: 'error', message: 'diagRuntimeDegraded', values: { error: firstError }, fix: 'restart' }
  if (!wanted) return { id: 'runtime', status: 'skip', message: 'diagRuntimeIdle' }
  return { id: 'runtime', status: 'error', message: 'diagRuntimeStopped', values: { error: firstError }, fix: 'restart' }
}

function featureItems(snapshot: DesktopToolsSnapshot): DesktopDiagnosticItem[] {
  return FEATURES.map(([feature, id]) => {
    const status = snapshot.features[feature]
    if (status.phase === 'error') return { id, status: 'error', message: 'diagFeatureError', values: { error: status.error ?? '' }, fix: 'restart' }
    if (status.phase === 'starting') return { id, status: 'warn', message: 'diagFeatureStarting' }
    if (status.phase === 'active') return { id, status: 'ok', message: 'diagFeatureActive' }
    // 悬浮球依赖划词服务时，关闭划词监听后划词模块仍处于运行状态，此处只看配置。
    return featureWanted(snapshot.config, feature)
      ? { id, status: 'error', message: 'diagFeatureNotRunning', fix: 'restart' }
      : { id, status: 'skip', message: 'diagFeatureDisabled' }
  })
}

function shortcutItem(input: DiagnosticInput): DesktopDiagnosticItem {
  const shortcuts = input.shortcuts
  if (shortcuts === undefined) return { id: 'shortcuts', status: 'skip', message: 'diagShortcutsInactive' }
  if (shortcuts.status === undefined) return { id: 'shortcuts', status: 'warn', message: 'diagShortcutsUnknown', values: { error: shortcuts.error ?? '' } }
  const { registered, failed } = shortcuts.status
  if (failed.length === 0) {
    return registered.length === 0
      ? { id: 'shortcuts', status: 'ok', message: 'diagShortcutsNone' }
      : { id: 'shortcuts', status: 'ok', message: 'diagShortcutsOk', values: { list: registered.join(', ') } }
  }
  const occupied = failed.filter(item => item.reason === 'occupied').map(item => item.accelerator)
  const invalid = failed.filter(item => item.reason === 'invalid').map(item => item.accelerator)
  const message = occupied.length > 0 && invalid.length > 0 ? 'diagShortcutsFailed' : occupied.length > 0 ? 'diagShortcutsOccupied' : 'diagShortcutsInvalid'
  return { id: 'shortcuts', status: 'warn', message, values: { occupied: occupied.join(', '), invalid: invalid.join(', ') } }
}

function visionItem(snapshot: DesktopToolsSnapshot): DesktopDiagnosticItem {
  if (!featureWanted(snapshot.config, 'capture')) return { id: 'vision', status: 'skip', message: 'diagVisionNotNeeded' }
  const { state, version } = snapshot.vision
  const values = { version: version ?? '' }
  if (state === 'ready') return { id: 'vision', status: 'ok', message: 'diagVisionReady' }
  if (state === 'missing') return { id: 'vision', status: 'warn', message: 'diagVisionMissing', fix: 'install-vision' }
  if (state === 'disabled') return { id: 'vision', status: 'warn', message: 'diagVisionDisabled', values, fix: 'install-vision' }
  if (state === 'tool-off') return { id: 'vision', status: 'warn', message: 'diagVisionToolOff', values }
  return { id: 'vision', status: 'skip', message: 'diagVisionUnknown' }
}

function permissionItems(input: DiagnosticInput): DesktopDiagnosticItem[] {
  const rights = [['screen', 'permission-screen', 'open-screen'], ['accessibility', 'permission-accessibility', 'open-accessibility']] as const
  return rights.map(([right, id, fix]): DesktopDiagnosticItem => {
    if (input.platform !== 'darwin') return { id, status: 'skip', message: 'diagPermissionNotNeeded' }
    const granted = input.permissions?.[right]
    if (granted === undefined) return { id, status: 'skip', message: 'diagPermissionUnknown' }
    return granted ? { id, status: 'ok', message: 'diagPermissionGranted' } : { id, status: 'warn', message: 'diagPermissionDenied', fix }
  })
}

/**
 * 根据采集到的数据生成诊断结论。
 * @param input 配置、可执行文件、原生模块、运行状态等采集结果。
 * @returns 按检查顺序排列的诊断项。
 */
export function buildDiagnostics(input: DiagnosticInput): DesktopDiagnosticItem[] {
  return [
    input.config.error === undefined
      ? { id: 'config', status: 'ok', message: 'diagConfigOk', values: { path: input.config.path } }
      : { id: 'config', status: 'error', message: 'diagConfigError', values: { path: input.config.path, error: input.config.error } },
    electronItem(input.electron),
    versionItem(input.hostElectron, input.helperElectron),
    koffiItem(input.koffi, input.platform),
    runtimeItem(input),
    ...featureItems(input.snapshot),
    shortcutItem(input),
    visionItem(input.snapshot),
    ...permissionItems(input),
  ]
}

/**
 * @param template 含 {name} 占位符的文案。
 * @param values 占位符取值；缺失的占位符替换为空字符串。
 * @returns 替换后的文本。
 */
export function fillDiagnosticText(template: string, values: Readonly<Record<string, string>> | undefined): string {
  return template.replace(/\{(\w+)\}/gu, (_, name: string) => values?.[name] ?? '')
}

/** 报告中使用的状态标记，不依赖界面语言。 */
const STATUS_MARK = { ok: '[OK]', warn: '[WARN]', error: '[ERROR]', skip: '[SKIP]' } as const

/**
 * 生成可直接粘贴到问题反馈中的纯文本诊断报告。
 * @param diagnostics Host 返回的诊断结果。
 * @param translate 文案键到当前语言文本的转换。
 * @returns 多行文本。
 */
export function formatDiagnosticReport(diagnostics: DesktopDiagnostics, translate: (key: string) => string): string {
  const env = diagnostics.environment
  const lines = [
    `dsh-desktop-tools ${env.plugin}`,
    `platform: ${env.platform}-${env.arch}${env.packaged ? ' (packaged DSH)' : ''}`,
    `electron: host ${env.hostElectron ?? '-'}, helper ${env.helperElectron ?? '-'}`,
    `generated: ${diagnostics.generatedAt}`,
    '',
  ]
  for (const item of diagnostics.items) {
    lines.push(`${STATUS_MARK[item.status]} ${item.id}: ${fillDiagnosticText(translate(item.message), item.values).replace(/\n/gu, ' | ')}`)
  }
  return lines.join('\n')
}
