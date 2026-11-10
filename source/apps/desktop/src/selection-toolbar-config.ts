

import { isSelectionLanguage, type SelectionTranslateLanguage } from './selection-prompt.ts'
import { parseOrbAgentModelSelection, type OrbAgentModelSelection } from './orb-agent-models.ts'
import { readDesktopToolsConfig, writeDesktopToolsConfig } from './desktop-tools-config.ts'


export const SELECTION_TOOLBAR_FILE = 'desktop-tools.json'


export interface SelectionToolbarConfig {
  readonly enabled: boolean
  readonly translateTargetLanguage: SelectionTranslateLanguage
  readonly compatibilityCopy?: boolean
  /** 翻译与解读固定使用的模型；未设置时跟随主窗口当前会话。 */
  readonly model?: OrbAgentModelSelection
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
  }
}






export function writeSelectionToolbarConfig(profileDir: string, config: SelectionToolbarConfig): void {
  const current = readDesktopToolsConfig(profileDir)
  writeDesktopToolsConfig(profileDir, {
    ...current,
    selection: {
      enabled: config.enabled,
      targetLanguage: config.translateTargetLanguage,
      compatibilityCopy: config.compatibilityCopy ?? true,
      ...(config.model === undefined ? {} : { model: config.model }),
    },
  })
}
