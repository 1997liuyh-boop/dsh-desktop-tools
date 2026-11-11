/** 桌面工具统一配置及原子持久化。 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  DesktopModelSelection,
  DesktopRecordingFormat,
  DesktopRecordingQuality,
  DesktopToolsConfig,
} from './desktop-tools-types.ts'

export type {
  DesktopCoordinateMode, DesktopModelSelection, DesktopPermissionPreset, DesktopRecordingFormat, DesktopRecordingQuality, DesktopToolsConfig,
} from './desktop-tools-types.ts'

/** 截图默认全局快捷键。 */
export const DEFAULT_SCREENSHOT_SHORTCUT = 'CommandOrControl+Shift+S'
/** 录屏默认全局快捷键。 */
export const DEFAULT_RECORDING_SHORTCUT = 'CommandOrControl+Shift+R'
const RECORDING_FORMATS: readonly DesktopRecordingFormat[] = ['mp4', 'webm', 'gif']
const RECORDING_QUALITIES: readonly DesktopRecordingQuality[] = ['sd', 'hd', 'original']
const ACCELERATOR_KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|PrintScreen|Plus|[-=[\];',./`\\])$/u
const ACCELERATOR_MODIFIER = /^(?:Command|Cmd|Control|Ctrl|CommandOrControl|CmdOrCtrl|Alt|Option|AltGr|Shift|Super|Meta)$/u

/**
 * 校验 Electron 全局快捷键字符串。
 * @param value 用户录制或配置文件中的快捷键。
 * @returns 是否为「至少一个修饰键 + 一个主键」或空字符串（不注册）。
 */
export function isDesktopAccelerator(value: string): boolean {
  if (value === '') return true
  const parts = value.split('+')
  const key = parts.pop()
  if (key === undefined || !ACCELERATOR_KEY.test(key)) return false
  // PrintScreen 允许单独使用；其余主键必须带修饰键，避免吞掉普通输入。
  if (parts.length === 0) return key === 'PrintScreen'
  return parts.every(part => ACCELERATOR_MODIFIER.test(part)) && new Set(parts).size === parts.length
}

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
    screenshot: { enabled: false, shortcut: DEFAULT_SCREENSHOT_SHORTCUT, longShortcut: '' },
    recording: {
      enabled: false, shortcut: DEFAULT_RECORDING_SHORTCUT, format: 'mp4', quality: 'hd',
      systemAudio: platform !== 'linux', microphone: false, knowledgeGraph: false,
    },
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

/** 新增字段缺省时回落默认值，兼容 0.3.x 写入的配置文件。 */
function optionalBoolean(record: Record<string, unknown>, name: string, fallback: boolean): boolean {
  return record[name] === undefined ? fallback : booleanField(record, name)
}

function shortcutField(record: Record<string, unknown>, name: string, fallback: string): string {
  const value = record[name]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.length > 80 || !isDesktopAccelerator(value)) throw new Error(`桌面工具快捷键无效: ${name}`)
  return value
}

function choiceField<T extends string>(record: Record<string, unknown>, name: string, choices: readonly T[], fallback: T): T {
  const value = record[name]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !(choices as readonly string[]).includes(value)) throw new Error(`桌面工具配置取值无效: ${name}`)
  return value as T
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
    screenshot: {
      enabled: booleanField(screenshot, 'enabled'),
      shortcut: shortcutField(screenshot, 'shortcut', DEFAULT_SCREENSHOT_SHORTCUT),
      longShortcut: shortcutField(screenshot, 'longShortcut', ''),
    },
    recording: {
      enabled: booleanField(recording, 'enabled'),
      shortcut: shortcutField(recording, 'shortcut', DEFAULT_RECORDING_SHORTCUT),
      format: choiceField(recording, 'format', RECORDING_FORMATS, 'mp4'),
      quality: choiceField(recording, 'quality', RECORDING_QUALITIES, 'hd'),
      systemAudio: optionalBoolean(recording, 'systemAudio', process.platform !== 'linux'),
      microphone: optionalBoolean(recording, 'microphone', false),
      knowledgeGraph: optionalBoolean(recording, 'knowledgeGraph', false),
    },
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
