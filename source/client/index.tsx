/** 桌面工具 Client 插件和设置入口注册。 */
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ShortcutBinding } from '@deepseek-ai/dsh-client-shortcuts/client'
import { DesktopToolsSettings, type DesktopToolsSettingsServices } from './DesktopToolsSettings.tsx'
import { en, zh } from './locales.ts'
import desktopToolsCss from './desktop-tools.tw.css?inline'
import type { DesktopToolsConfig, DesktopToolsSnapshot, DesktopToolsUpdateResult } from '../apps/desktop/src/desktop-tools-types.ts'
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import remote from '../apps/desktop/native-extension-runtime/remote.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { desktopTools: keyof typeof zh }
}

interface DesktopToolsRemote {
  snapshot(): Promise<RemoteResult<DesktopToolsSnapshot>>
  update(config: DesktopToolsConfig): Promise<RemoteResult<DesktopToolsUpdateResult>>
  restart(): Promise<RemoteResult<DesktopToolsSnapshot>>
  openCapture(mode: 'image' | 'video'): Promise<RemoteResult<{ readonly opened: true }>>
  avatar(): Promise<RemoteResult<{ readonly dataUrl?: string }>>
  setAvatar(dataUrl: string, fileName: string): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean; readonly error?: string }>>
  restoreAvatar(): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean; readonly error?: string }>>
  systemPermissions(): Promise<RemoteResult<{ readonly screen?: boolean; readonly accessibility?: boolean }>>
  openSystemPermission(right: 'screen' | 'accessibility'): Promise<RemoteResult<unknown>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap { desktopTools: DesktopToolsRemote }
}

export const inject = ['slots', 'locale', 'shortcuts', 'remote', 'remote.desktopTools']

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const style = document.createElement('style')
  style.dataset.dshDesktopTools = ''
  style.textContent = desktopToolsCss
  document.head.append(style)
  const namespace = 'desktopTools'
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }), 'desktop-tools: dictionaries')
  const t = ctx.locale.bind(namespace)
  const profiles = (code: 'KeyS' | 'KeyR'): Record<'desktop:macos' | 'desktop:windows' | 'desktop:linux' | 'web:macos' | 'web:windows' | 'web:linux', ShortcutBinding> => ({
    'desktop:macos': { code, modifiers: ['primary', 'shift'] },
    'desktop:windows': { code, modifiers: ['primary', 'shift'] },
    'desktop:linux': { code, modifiers: ['primary', 'shift'] },
    'web:macos': { code, modifiers: ['primary', 'shift'] },
    'web:windows': { code, modifiers: ['primary', 'shift'] },
    'web:linux': { code, modifiers: ['primary', 'shift'] },
  })
  const disposeScreenshot = ctx.shortcuts.register({
    id: 'desktop-tools.screenshot' as ShortcutCommandId, label: () => t('screenshot'), aliases: [],
    defaults: profiles('KeyS'), regions: ['page', 'editable', 'terminal'], modals: ['settings'],
    resolve: () => ({ status: 'handled', run: () => { void ctx.remote.desktopTools.openCapture('image') } }),
  })
  const disposeRecording = ctx.shortcuts.register({
    id: 'desktop-tools.recording' as ShortcutCommandId, label: () => t('recording'), aliases: [],
    defaults: profiles('KeyR'), regions: ['page', 'editable', 'terminal'], modals: ['settings'],
    resolve: () => ({ status: 'handled', run: () => { void ctx.remote.desktopTools.openCapture('video') } }),
  })
  const services: DesktopToolsSettingsServices = {
    snapshot: () => ctx.remote.desktopTools.snapshot(), update: config => ctx.remote.desktopTools.update(config),
    restart: () => ctx.remote.desktopTools.restart(), avatar: () => ctx.remote.desktopTools.avatar(),
    setAvatar: (dataUrl, fileName) => ctx.remote.desktopTools.setAvatar(dataUrl, fileName),
    restoreAvatar: () => ctx.remote.desktopTools.restoreAvatar(), systemPermissions: () => ctx.remote.desktopTools.systemPermissions(),
    openSystemPermission: right => ctx.remote.desktopTools.openSystemPermission(right),
    async editShortcut(id, binding) {
      const result = await ctx.shortcuts.edit({ type: 'set', id, binding }, ctx.shortcuts.config.getSnapshot().revision)
      return result.status === 'saved' ? undefined : t('saveError')
    },
    shortcutLabel(id) { return ctx.shortcuts.catalog.getSnapshot().find(item => item.id === id)?.keys.join(' + ') ?? '—' },
  }
  const disposeSection = ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'desktop-tools', order: 40, label: () => t('title'), locale: namespace,
    inject: () => ({ services }),
  }, DesktopToolsSettings))
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    disposeSection()
    disposeScreenshot()
    disposeRecording()
    style.remove()
    await unmount()
  }
  ctx.effect(() => dispose, 'desktop-tools: Client resources')
  return dispose
}
