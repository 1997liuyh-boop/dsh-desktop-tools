import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopMessages } from './locale.ts'
import { floatingAgentModelItems, floatingSelectionModelItems, type FloatingModelCatalog } from './floating-agent-menu.ts'
import type { OrbAgentModelSelection } from './orb-agent-models.ts'

export interface FloatingContextEditState {
  readonly isEditable: boolean
  readonly editFlags: {
    readonly canCut: boolean
    readonly canCopy: boolean
    readonly canPaste: boolean
  }
}

export interface FloatingAgentMenuState {
  readonly backgroundSupported?: boolean
  readonly catalog: FloatingModelCatalog | undefined
  readonly overlay: OrbAgentModelSelection
  readonly background: OrbAgentModelSelection
  readonly onSelectOverlay: (selection: OrbAgentModelSelection) => void
  readonly onSelectBackground: (selection: OrbAgentModelSelection) => void
  /** 划词翻译与解读固定使用的模型；未固定时为 undefined。 */
  readonly selection: OrbAgentModelSelection | undefined
  readonly onSelectSelection: (selection: OrbAgentModelSelection | undefined) => void
}

export interface FloatingAgentMenuSource {
  readonly backgroundSupported?: boolean
  readonly loadCatalog: () => Promise<FloatingModelCatalog | undefined>
  readonly overlay: () => OrbAgentModelSelection
  readonly background: () => OrbAgentModelSelection
  readonly onSelectOverlay: (selection: OrbAgentModelSelection) => void
  readonly onSelectBackground: (selection: OrbAgentModelSelection) => void
  readonly selection: () => OrbAgentModelSelection | undefined
  readonly onSelectSelection: (selection: OrbAgentModelSelection | undefined) => void
}

export interface FloatingMenuActions {
  readonly capture: () => void
  readonly wechat: () => void
  readonly disableSelection: () => void
  readonly disableFloating: () => void
  readonly disableCapture: () => void
  readonly selectionEnabled: () => boolean
  readonly captureEnabled: () => boolean
  readonly wechatEnabled: () => boolean
  /** 打开钉图管理窗；省略时菜单中不显示该项。 */
  readonly pins?: () => void
  /** 钉图管理是否可用（截图录屏功能正在运行）。 */
  readonly pinsEnabled?: () => boolean
}

/** 按快捷工具、主窗口、设置三组生成悬浮球原生菜单。 */
export function floatingContextMenuTemplate(
  params: FloatingContextEditState,
  messages: DesktopMessages,
  onOpenMain: () => void,
  actions: FloatingMenuActions,
  agents?: FloatingAgentMenuState,
  millifraction?: { readonly enabled: boolean; readonly onToggle: () => void },
): MenuItemConstructorOptions[] {
  const labels = { empty: messages.floatingNoModels, defaultEffort: messages.floatingEffortDefault }
  const floatingSettings: MenuItemConstructorOptions[] = agents === undefined ? [] : floatingAgentModelItems(
    agents.catalog, agents.overlay, agents.onSelectOverlay, labels,
  )
  if (agents !== undefined && agents.backgroundSupported !== false) {
    floatingSettings.push({ type: 'separator' }, {
      label: messages.floatingBackgroundAgentSettings,
      submenu: floatingAgentModelItems(agents.catalog, agents.background, agents.onSelectBackground, labels),
    })
  }
  if (millifraction !== undefined) {
    if (floatingSettings.length > 0) floatingSettings.push({ type: 'separator' })
    floatingSettings.push({
      label: millifraction.enabled ? messages.millifractionDisable : messages.millifractionEnable,
      click: millifraction.onToggle,
    })
  }
  const menu: MenuItemConstructorOptions[] = [
    { label: messages.captureTitle, enabled: actions.captureEnabled(), click: actions.capture },
    { label: messages.floatingWechat, enabled: actions.wechatEnabled(), click: actions.wechat },
    ...(actions.pins === undefined ? [] : [{ label: messages.capturePinsManage, enabled: actions.pinsEnabled?.() ?? true, click: actions.pins }]),
    { type: 'separator' },
    { label: messages.floatingOpenMain, click: onOpenMain },
    { type: 'separator' },
    {
      label: messages.floatingAgentMenu,
      submenu: [
        { label: messages.floatingAgentSettings, enabled: floatingSettings.length > 0, submenu: floatingSettings },
        {
          label: messages.floatingSelectionModelSettings,
          enabled: agents !== undefined,
          submenu: agents === undefined ? [] : floatingSelectionModelItems(
            agents.catalog, agents.selection, agents.onSelectSelection,
            { ...labels, follow: messages.selectionModelFollow },
          ),
        },
      ],
    },
    {
      label: messages.floatingBasicSettings,
      submenu: [
        { label: messages.floatingDisableSelection, enabled: actions.selectionEnabled(), click: actions.disableSelection },
        { label: messages.floatingDisableBall, click: actions.disableFloating },
        { label: messages.floatingDisableCapture, enabled: actions.captureEnabled(), click: actions.disableCapture },
      ],
    },
    { type: 'separator' },
    { label: messages.cancel },
  ]
  if (!params.isEditable) return menu
  return [
    { role: 'cut', enabled: params.editFlags.canCut },
    { role: 'copy', enabled: params.editFlags.canCopy },
    { role: 'paste', enabled: params.editFlags.canPaste },
    { type: 'separator' },
    ...menu,
  ]
}
