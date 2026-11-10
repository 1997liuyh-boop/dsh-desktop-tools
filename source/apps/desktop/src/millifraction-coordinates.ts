

import { readDesktopToolsConfig, writeDesktopToolsConfig } from './desktop-tools-config.ts'


export const MILLIFRACTION_COORDINATES_FILE = 'desktop-tools.json'


export interface MillifractionCoordinatesConfig {
  readonly enabled: boolean
}







export function defaultMillifractionEnabled(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'win32'
}






export function readMillifractionCoordinates(profileDir: string): MillifractionCoordinatesConfig {
  return { enabled: readDesktopToolsConfig(profileDir).floatingBall.coordinateMode === 'millifraction' }
}






export function writeMillifractionCoordinates(
  profileDir: string,
  config: MillifractionCoordinatesConfig,
): void {
  const current = readDesktopToolsConfig(profileDir)
  writeDesktopToolsConfig(profileDir, {
    ...current,
    floatingBall: { ...current.floatingBall, coordinateMode: config.enabled ? 'millifraction' : 'pixel' },
  })
}

export type OrbCoordinateMode = 'millifraction' | 'pixel'






export function orbCoordinateModeFor(enabled: boolean): OrbCoordinateMode {
  return enabled ? 'millifraction' : 'pixel'
}
