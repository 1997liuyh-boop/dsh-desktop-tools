/** 截图录屏扩展独立提供菜单入口、采集窗口和异步写盘清理。 */
import { ipcMain } from 'electron'
import { DesktopCapture } from './desktop-capture.ts'
import type { DesktopFeatureContext } from './desktop-feature-host.ts'
import { readDesktopToolsConfig } from './desktop-tools-config.ts'

declare module './desktop-feature-host.ts' {
  interface DesktopFeatureServices { capture: { open(mode: 'image' | 'video'): Promise<string | undefined>; allowsDisplayMedia: DesktopCapture['allowsDisplayMedia'] } }
}

/** 采集界面仅在插件安装期间通过自定义协议提供。 */
export const shellAssets = ['/capture.html', '/capture.js', '/capture.css', '/capture.tw.css', '/shell-theme.js', '/assets/window-material.css']

/** @param context 当前安装包的原生资源作用域。 */
export function activate(context: DesktopFeatureContext): void {
  const environment = context.environment
  const config = readDesktopToolsConfig(environment.profile)
  const capture = new DesktopCapture(environment.profile, environment.preload, () => environment.locale().messages)
  context.effect(capture.register(ipcMain))
  const open = (mode: 'image' | 'video'): Promise<string | undefined> => {
    const enabled = mode === 'image' ? config.screenshot.enabled : config.recording.enabled
    if (!enabled) throw new Error(mode === 'image' ? '截图功能未启用' : '录屏功能未启用')
    return capture.open(mode)
  }
  context.provide('capture', { open, allowsDisplayMedia: contents => capture.allowsDisplayMedia(contents) })
  context.registerSender(event => capture.owns(event))
  context.menu(() => [
    ...(config.screenshot.enabled ? [{ label: environment.locale().messages.captureScreenshot, click: () => { void open('image').catch((error: unknown) => { console.error('截图录屏启动失败', error) }) } }] : []),
    ...(config.recording.enabled ? [{ label: environment.locale().messages.captureVideo, click: () => { void open('video').catch((error: unknown) => { console.error('截图录屏启动失败', error) }) } }] : []),
  ])
}
