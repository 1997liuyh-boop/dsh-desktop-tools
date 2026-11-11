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
}
