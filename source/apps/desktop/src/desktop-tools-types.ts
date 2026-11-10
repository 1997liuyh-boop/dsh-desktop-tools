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
  readonly screenshot: { readonly enabled: boolean }
  readonly recording: { readonly enabled: boolean }
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
  readonly runtime: 'stopped' | 'running' | 'degraded'
  readonly features: Readonly<Record<DesktopFeatureId, DesktopFeatureStatus>>
}

export interface DesktopToolsUpdateResult {
  readonly saved: true
  readonly applied: boolean
  readonly snapshot: DesktopToolsSnapshot
}
