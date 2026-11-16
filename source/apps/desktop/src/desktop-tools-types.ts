/** 桌面工具 Host 与 Client 共用的无运行时类型。 */

export type DesktopPermissionPreset = 'read-only' | 'workspace-write' | 'danger-full-access'
export type DesktopCoordinateMode = 'millifraction' | 'pixel'

export interface DesktopModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

export interface DesktopToolsConfig {
  readonly selection: {
    readonly enabled: boolean
    readonly targetLanguage: string
    readonly model?: DesktopModelSelection
    readonly compatibilityCopy: boolean
    /** 用户自定义的划词动作。 */
    readonly customActions: readonly DesktopSelectionCustomAction[]
    /** 工具栏上按顺序显示的按钮：内置按钮 id 或 `custom:<自定义动作 id>`；不在列表中的按钮隐藏。 */
    readonly toolbarItems: readonly string[]
  }
  readonly floatingBall: {
    readonly enabled: boolean
    readonly conversationModel: DesktopModelSelection
    readonly backgroundModel: DesktopModelSelection
    readonly permissionPreset: DesktopPermissionPreset
    readonly coordinateMode: DesktopCoordinateMode
  }
  readonly screenshot: {
    readonly enabled: boolean
    /** 截图全局快捷键（Electron Accelerator），空字符串表示不注册。 */
    readonly shortcut: string
    /** 长截图全局快捷键，空字符串表示不注册。 */
    readonly longShortcut: string
    /** 显示 / 隐藏全部钉图的全局快捷键，空字符串表示不注册。 */
    readonly pinsShortcut: string
  }
  readonly recording: {
    readonly enabled: boolean
    /** 录屏全局快捷键，空字符串表示不注册。 */
    readonly shortcut: string
    /** 默认输出格式。 */
    readonly format: DesktopRecordingFormat
    /** 默认清晰度。 */
    readonly quality: DesktopRecordingQuality
    /** 默认是否录制系统声音。 */
    readonly systemAudio: boolean
    /** 默认是否录制麦克风。 */
    readonly microphone: boolean
    /** 默认是否在录制结束后生成知识图谱。 */
    readonly knowledgeGraph: boolean
  }
}

/** 划词工具栏的内置按钮。 */
export type DesktopSelectionBuiltinItem = 'search' | 'translate' | 'note' | 'wechat' | 'explain' | 'send-to-agent'

/** 用户自定义的划词动作：名称显示在工具栏上，提示词中 {text} 为选中文字、{language} 为目标语言。 */
export interface DesktopSelectionCustomAction {
  readonly id: string
  readonly name: string
  readonly prompt: string
}

/** 录屏输出格式。 */
export type DesktopRecordingFormat = 'mp4' | 'webm' | 'gif'
/** 录屏清晰度档位：标清 720p、高清 1080p、原画。 */
export type DesktopRecordingQuality = 'sd' | 'hd' | 'original'

/** 前置插件 dsh-vision-router 的可用状态。 */
export interface DesktopVisionStatus {
  /** ready：可调用 OCR；missing：未安装；disabled：已安装但未启用；tool-off：已启用但视觉工具关闭；unknown：无法判断。 */
  readonly state: 'ready' | 'missing' | 'disabled' | 'tool-off' | 'unknown'
  readonly version?: string
}

export type DesktopFeatureId = 'capture' | 'selection' | 'floatingBall'
export type DesktopFeaturePhase = 'disabled' | 'starting' | 'active' | 'error'

export interface DesktopFeatureStatus {
  readonly phase: DesktopFeaturePhase
  readonly error?: string
}

export interface DesktopToolsSnapshot {
  readonly config: DesktopToolsConfig
  readonly platform: string
  /** 提取文字、翻译与知识图谱依赖的视觉插件状态。 */
  readonly vision: DesktopVisionStatus
  readonly runtime: 'stopped' | 'running' | 'degraded'
  readonly features: Readonly<Record<DesktopFeatureId, DesktopFeatureStatus>>
}

export interface DesktopToolsUpdateResult {
  readonly saved: true
  readonly applied: boolean
  readonly snapshot: DesktopToolsSnapshot
  /** 功能已应用但未能注册的全局快捷键；全部注册成功或截图录屏未运行时省略。 */
  readonly shortcutFailures?: readonly DesktopShortcutFailure[]
}

/** 未能注册的全局快捷键：occupied 为被其他程序占用，invalid 为组合无效。 */
export interface DesktopShortcutFailure {
  readonly accelerator: string
  readonly reason: 'occupied' | 'invalid'
}

/** 诊断检查项标识。 */
export type DesktopDiagnosticId =
  | 'config' | 'electron' | 'electron-version' | 'native-module' | 'runtime'
  | 'feature-selection' | 'feature-floatingBall' | 'feature-capture'
  | 'shortcuts' | 'vision' | 'permission-screen' | 'permission-accessibility'

/** 诊断结论：ok 正常、warn 可用但需要注意、error 不可用、skip 不适用或暂时无法检查。 */
export type DesktopDiagnosticStatus = 'ok' | 'warn' | 'error' | 'skip'

/** 设置页可直接执行的修复动作。 */
export type DesktopDiagnosticFix = 'restart' | 'install-vision' | 'open-screen' | 'open-accessibility'

/** 单条诊断结果；message 为设置页文案键，values 为文案中 {name} 占位符的取值。 */
export interface DesktopDiagnosticItem {
  readonly id: DesktopDiagnosticId
  readonly status: DesktopDiagnosticStatus
  readonly message: string
  readonly values?: Readonly<Record<string, string>>
  readonly fix?: DesktopDiagnosticFix
}

/** 诊断报告的运行环境摘要。 */
export interface DesktopDiagnosticEnvironment {
  readonly plugin: string
  readonly platform: string
  readonly arch: string
  /** DSH 宿主进程的 Electron 版本。 */
  readonly hostElectron?: string
  /** 辅助进程实际运行的 Electron 版本。 */
  readonly helperElectron?: string
  readonly packaged: boolean
}

/** 一次完整诊断。 */
export interface DesktopDiagnostics {
  readonly generatedAt: string
  readonly environment: DesktopDiagnosticEnvironment
  readonly items: readonly DesktopDiagnosticItem[]
}
