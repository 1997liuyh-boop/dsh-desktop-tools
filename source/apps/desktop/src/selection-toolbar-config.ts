import { isSelectionLanguage, type SelectionTranslateLanguage } from './selection-prompt.ts'
import { parseOrbAgentModelSelection, type OrbAgentModelSelection } from './orb-agent-models.ts'
import { readDesktopToolsConfig, writeDesktopToolsConfig } from './desktop-tools-config.ts'
import type { DesktopSelectionCustomAction } from './desktop-tools-types.ts'


export const SELECTION_TOOLBAR_FILE = 'desktop-tools.json'


export interface SelectionToolbarConfig {
  readonly enabled: boolean
  readonly translateTargetLanguage: SelectionTranslateLanguage
  readonly compatibilityCopy?: boolean
  /** 翻译与解读固定使用的模型；未设置时跟随主窗口当前会话。 */
  readonly model?: OrbAgentModelSelection
  /** 自定义划词动作（只读，由设置页维护）。 */
  readonly customActions: readonly DesktopSelectionCustomAction[]
  /** 工具栏上按顺序显示的按钮（只读，由设置页维护）。 */
  readonly toolbarItems: readonly string[]
}

function isLanguage(value: unknown): value is SelectionTranslateLanguage {
  return isSelectionLanguage(value)
}


export function readSelectionToolbarConfig(profileDir: string): SelectionToolbarConfig {
  const config = readDesktopToolsConfig(profileDir).selection
  if (!isLanguage(config.targetLanguage)) throw new Error('划词目标语言无效')
  const model = parseOrbAgentModelSelection(config.model)
  return {
    enabled: config.enabled,
    translateTargetLanguage: config.targetLanguage,
    compatibilityCopy: config.compatibilityCopy,
    ...(model === undefined ? {} : { model }),
    customActions: config.customActions,
    toolbarItems: config.toolbarItems,
  }
}


/**
 * 写入辅助进程可修改的划词字段（启用、语言、兼容取词、模型）。
 * 自定义动作与工具栏按钮只由设置页维护，这里始终保留磁盘上的现值，避免被旧快照覆盖。
 * @param profileDir 当前 DSH profile。
 * @param config 新的划词设置。
 */
export function writeSelectionToolbarConfig(profileDir: string, config: SelectionToolbarConfig): void {
  const current = readDesktopToolsConfig(profileDir)
  const { model: _previousModel, ...rest } = current.selection
  writeDesktopToolsConfig(profileDir, {
    ...current,
    selection: {
      ...rest,
      enabled: config.enabled,
      targetLanguage: config.translateTargetLanguage,
      compatibilityCopy: config.compatibilityCopy ?? true,
      ...(config.model === undefined ? {} : { model: config.model }),
    },
  })
}
