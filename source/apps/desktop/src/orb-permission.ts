

import { readDesktopToolsConfig, writeDesktopToolsConfig } from './desktop-tools-config.ts'


export const ORB_PERMISSION_FILE = 'desktop-tools.json'


export const ORB_PERMISSION_PRESETS = ['read-only', 'workspace-write', 'danger-full-access'] as const


export type OrbPermissionPreset = (typeof ORB_PERMISSION_PRESETS)[number]


export const DEFAULT_ORB_PERMISSION: OrbPermissionPreset = 'danger-full-access'






export function isOrbPermissionPreset(value: unknown): value is OrbPermissionPreset {
  return typeof value === 'string'
    && (ORB_PERMISSION_PRESETS as readonly string[]).includes(value)
}






export function readOrbPermission(profileDir: string): OrbPermissionPreset {
  const preset = readDesktopToolsConfig(profileDir).floatingBall.permissionPreset
  return isOrbPermissionPreset(preset) ? preset : DEFAULT_ORB_PERMISSION
}






export function writeOrbPermission(profileDir: string, preset: OrbPermissionPreset): void {
  const current = readDesktopToolsConfig(profileDir)
  writeDesktopToolsConfig(profileDir, {
    ...current,
    floatingBall: { ...current.floatingBall, permissionPreset: preset },
  })
}
