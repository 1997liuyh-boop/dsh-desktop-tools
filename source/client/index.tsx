/** 桌面工具 Client 插件和设置入口注册。 */
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { DesktopToolsSettings, type DesktopToolsSettingsServices, type ModelCatalog } from './DesktopToolsSettings.tsx'
import { en, zh } from './locales.ts'
import desktopToolsCss from './desktop-tools.tw.css?inline'
import type { DesktopToolsConfig, DesktopToolsSnapshot, DesktopToolsUpdateResult } from '../apps/desktop/src/desktop-tools-types.ts'
import remote from '../apps/desktop/native-extension-runtime/remote.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { desktopTools: keyof typeof zh }
}

interface DesktopToolsRemote {
  snapshot(): Promise<RemoteResult<DesktopToolsSnapshot>>
  update(config: DesktopToolsConfig): Promise<RemoteResult<DesktopToolsUpdateResult>>
  restart(): Promise<RemoteResult<DesktopToolsSnapshot>>
  openCapture(mode: 'image' | 'video' | 'long'): Promise<RemoteResult<{ readonly opened: true }>>
  installVision(): Promise<RemoteResult<{ readonly snapshot: DesktopToolsSnapshot; readonly restartRequired: boolean }>>
  avatar(): Promise<RemoteResult<{ readonly dataUrl?: string; readonly defaultDataUrl?: string }>>
  setAvatar(dataUrl: string, fileName: string): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean; readonly error?: string }>>
  restoreAvatar(): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean; readonly error?: string }>>
  systemPermissions(): Promise<RemoteResult<{ readonly screen?: boolean; readonly accessibility?: boolean }>>
  openSystemPermission(right: 'screen' | 'accessibility'): Promise<RemoteResult<unknown>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap { desktopTools: DesktopToolsRemote }
}

// 只等待挂载前就存在的服务；remote.desktopTools 由下方 apply 中的 $mount 创建，
// 若列入 inject 会形成自等待，插件永远停在 pending 并导致 web boot 失败（与官方 action-cards 一致）
export const inject = ['slots', 'locale', 'remote']

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const style = document.createElement('style')
  style.dataset.dshDesktopTools = ''
  style.textContent = desktopToolsCss
  document.head.append(style)
  const namespace = 'desktopTools'
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }), 'desktop-tools: dictionaries')
  const t = ctx.locale.bind(namespace)
  // remote.desktopTools 由上面的 $mount 创建，不在插件 inject 中；
  // 必须在声明了它的内层上下文里读取，否则 cordis 报「cannot get property without inject」（与官方 action-cards 一致）。
  // DSH 核心的 remote.session 提供与「模型」设置一致的模型目录；单独注入，缺失时只影响模型下拉。
  type SessionRemote = { modelCatalog(): Promise<RemoteResult<ModelCatalog>> }
  let sessionRemote: SessionRemote | undefined
  const sessionScope = ctx.inject(['remote.session'], (scope) => {
    sessionRemote = (scope.remote as unknown as { session: SessionRemote }).session
    scope.effect(() => () => { sessionRemote = undefined }, 'desktop-tools: model catalog')
  })
  const section = ctx.inject(['remote.desktopTools'], (inner) => {
    const tools = (): DesktopToolsRemote => inner.remote.desktopTools
    const services: DesktopToolsSettingsServices = {
      snapshot: () => tools().snapshot(), update: config => tools().update(config),
      restart: () => tools().restart(), avatar: () => tools().avatar(),
      setAvatar: (dataUrl, fileName) => tools().setAvatar(dataUrl, fileName),
      restoreAvatar: () => tools().restoreAvatar(), systemPermissions: () => tools().systemPermissions(),
      openSystemPermission: right => tools().openSystemPermission(right),
      installVision: () => tools().installVision(),
      openCapture: mode => tools().openCapture(mode),
      async modelCatalog() {
        if (sessionRemote === undefined) return undefined
        const result = await sessionRemote.modelCatalog()
        return result.ok ? result.value : undefined
      },
    }
    inner.effect(() => inner.slots.inject('settings.section', () => inner.slots.register({
      name: 'settings.section', id: 'desktop-tools', order: 40, label: () => t('title'), locale: namespace,
      inject: () => ({ services }),
    }, DesktopToolsSettings)), 'desktop-tools: settings section')
  })
  try { await section } catch (error) { await section.dispose(); style.remove(); await unmount(); throw error }
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    await section.dispose()
    await sessionScope.dispose()
    style.remove()
    await unmount()
  }
  ctx.effect(() => dispose, 'desktop-tools: Client resources')
  return dispose
}
