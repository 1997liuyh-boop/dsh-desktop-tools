/** 桌面工具统一配置及原子持久化。 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  DesktopModelSelection,
  DesktopToolsConfig,
} from './desktop-tools-types.ts'

export type { DesktopCoordinateMode, DesktopModelSelection, DesktopPermissionPreset, DesktopToolsConfig } from './desktop-tools-types.ts'

export const DESKTOP_TOOLS_CONFIG_FILE = 'desktop-tools.json'

const DEFAULT_MODEL: DesktopModelSelection = {
  provider: 'deepseek-official',
  model: 'deepseek-flash',
  reasoningEffort: 'max',
}

/** @param platform 当前桌面平台。 @returns 首次安装使用的完整配置。 */
export function defaultDesktopToolsConfig(platform: NodeJS.Platform = process.platform): DesktopToolsConfig {
  return {
    selection: {
      enabled: true,
      targetLanguage: 'en',
      compatibilityCopy: true,
    },
    floatingBall: {
      enabled: true,
      conversationModel: { ...DEFAULT_MODEL },
      backgroundModel: { ...DEFAULT_MODEL },
      permissionPreset: 'danger-full-access',
      coordinateMode: platform === 'win32' ? 'millifraction' : 'pixel',
    },
    screenshot: { enabled: false },
    recording: { enabled: false },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function booleanField(record: Record<string, unknown>, name: string): boolean {
  const value = record[name]
  if (typeof value !== 'boolean') throw new Error(`桌面工具配置字段必须为布尔值: ${name}`)
  return value
}

function objectField(record: Record<string, unknown>, name: string): Record<string, unknown> {
  const value = record[name]
  if (!isRecord(value)) throw new Error(`桌面工具配置字段必须为对象: ${name}`)
  return value
}

function modelField(value: unknown, name: string): DesktopModelSelection {
  if (!isRecord(value) || typeof value.provider !== 'string' || value.provider === ''
    || typeof value.model !== 'string' || value.model === ''
    || (value.reasoningEffort !== undefined && (typeof value.reasoningEffort !== 'string' || value.reasoningEffort === ''))) {
    throw new Error(`桌面工具模型配置无效: ${name}`)
  }
  return {
    provider: value.provider,
    model: value.model,
    ...(value.reasoningEffort === undefined ? {} : { reasoningEffort: value.reasoningEffort }),
  }
}

/** @param value 磁盘中的未知 JSON。 @returns 已校验的完整配置。 */
export function parseDesktopToolsConfig(value: unknown): DesktopToolsConfig {
  if (!isRecord(value)) throw new Error('桌面工具配置根节点必须为对象')
  const selection = objectField(value, 'selection')
  const floatingBall = objectField(value, 'floatingBall')
  const screenshot = objectField(value, 'screenshot')
  const recording = objectField(value, 'recording')
  const targetLanguage = selection.targetLanguage
  if (typeof targetLanguage !== 'string' || targetLanguage.trim() === '' || targetLanguage.length > 80
    || /[\x00-\x1f]/u.test(targetLanguage)) throw new Error('划词目标语言无效')
  const permissionPreset = floatingBall.permissionPreset
  if (permissionPreset !== 'read-only' && permissionPreset !== 'workspace-write' && permissionPreset !== 'danger-full-access') {
    throw new Error('悬浮球权限预设无效')
  }
  const coordinateMode = floatingBall.coordinateMode
  if (coordinateMode !== 'millifraction' && coordinateMode !== 'pixel') throw new Error('悬浮球坐标模式无效')
  return {
    selection: {
      enabled: booleanField(selection, 'enabled'),
      targetLanguage,
      compatibilityCopy: booleanField(selection, 'compatibilityCopy'),
      ...(selection.model === undefined ? {} : { model: modelField(selection.model, 'selection.model') }),
    },
    floatingBall: {
      enabled: booleanField(floatingBall, 'enabled'),
      conversationModel: modelField(floatingBall.conversationModel, 'floatingBall.conversationModel'),
      backgroundModel: modelField(floatingBall.backgroundModel, 'floatingBall.backgroundModel'),
      permissionPreset,
      coordinateMode,
    },
    screenshot: { enabled: booleanField(screenshot, 'enabled') },
    recording: { enabled: booleanField(recording, 'enabled') },
  }
}

/** @param profileDir 当前 DSH profile。 @returns 磁盘配置；文件不存在时返回首次安装默认值。 */
export function readDesktopToolsConfig(profileDir: string): DesktopToolsConfig {
  const path = join(profileDir, DESKTOP_TOOLS_CONFIG_FILE)
  if (!existsSync(path)) return defaultDesktopToolsConfig()
  try {
    return parseDesktopToolsConfig(JSON.parse(readFileSync(path, 'utf8')))
  } catch (error: unknown) {
    throw new Error(`无法读取桌面工具配置: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

/** @param profileDir 当前 DSH profile。 @param config 已校验配置。 */
export function writeDesktopToolsConfig(profileDir: string, config: DesktopToolsConfig): void {
  const validated = parseDesktopToolsConfig(config)
  const path = join(profileDir, DESKTOP_TOOLS_CONFIG_FILE)
  const temporary = `${path}.${String(process.pid)}.${String(Date.now())}.tmp`
  writeFileSync(temporary, `${JSON.stringify(validated, undefined, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  try {
    renameSync(temporary, path)
  } catch (error: unknown) {
    try { rmSync(temporary, { force: true }) } catch { /* 原始替换错误优先。 */ }
    throw error
  }
}
