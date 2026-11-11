/** 截图录屏扩展独立提供菜单入口、全局快捷键、采集窗口和异步写盘清理。 */
import { globalShortcut, ipcMain } from 'electron'
import { DesktopCapture, type CaptureMode } from './desktop-capture.ts'
import type { DesktopFeatureContext } from './desktop-feature-host.ts'
import { readDesktopToolsConfig } from './desktop-tools-config.ts'

declare module './desktop-feature-host.ts' {
  interface DesktopFeatureServices { capture: { open(mode: CaptureMode): Promise<string | undefined>; allowsDisplayMedia: DesktopCapture['allowsDisplayMedia'] } }
}

/** 采集界面仅在插件安装期间通过自定义协议提供。 */
export const shellAssets = [
  '/capture.html', '/capture.js', '/capture.css', '/capture.tw.css', '/capture-frame.html',
  '/capture-pin.html', '/capture-pin.js', '/capture-result.html', '/capture-result.js', '/capture-result.css',
  '/mermaid.min.js', '/selection-markdown.js', '/shell-theme.js', '/assets/window-material.css',
]

/** @param context 当前安装包的原生资源作用域。 */
export function activate(context: DesktopFeatureContext): void {
  const environment = context.environment
  const config = readDesktopToolsConfig(environment.profile)
  const capture = new DesktopCapture({
    directory: environment.profile,
    preload: environment.preload,
    messages: () => environment.locale().messages,
    chinese: () => environment.locale().id === 'zh-CN',
    config: () => config,
    transport: { request: (path, body, signal) => context.request(path, body, signal) },
    currentSessionId: () => context.currentSession(),
    showMain: () => { context.showMain() },
  })
  context.effect(capture.register(ipcMain))
  const open = (mode: CaptureMode): Promise<string | undefined> => {
    const enabled = mode === 'video' ? config.recording.enabled : config.screenshot.enabled
    if (!enabled) return Promise.reject(new Error(mode === 'video' ? '录屏功能未启用' : '截图功能未启用'))
    return capture.open(mode)
  }
  const launch = (mode: CaptureMode): void => { void open(mode).catch((error: unknown) => { console.error('截图录屏启动失败', error) }) }
  context.provide('capture', { open, allowsDisplayMedia: contents => capture.allowsDisplayMedia(contents) })
  context.registerSender(event => capture.owns(event))

  // 系统级快捷键：DSH 主窗口不在前台时同样可以唤起。
  const shortcuts: [string, CaptureMode, boolean][] = [
    [config.screenshot.shortcut, 'image', config.screenshot.enabled],
    [config.screenshot.longShortcut, 'long', config.screenshot.enabled],
    [config.recording.shortcut, 'video', config.recording.enabled],
  ]
  const registered: string[] = []
  for (const [accelerator, mode, enabled] of shortcuts) {
    if (!enabled || accelerator === '' || registered.includes(accelerator)) continue
    try {
      if (globalShortcut.register(accelerator, () => { launch(mode) })) registered.push(accelerator)
      else console.warn(`截图录屏快捷键已被其他程序占用: ${accelerator}`)
    } catch (error: unknown) {
      console.warn(`截图录屏快捷键无效: ${accelerator}`, error)
    }
  }
  context.effect(() => { for (const accelerator of registered) globalShortcut.unregister(accelerator) })

  const messages = (): ReturnType<typeof environment.locale>['messages'] => environment.locale().messages
  context.menu(() => [
    ...(config.screenshot.enabled ? [
      { label: messages().captureScreenshot, click: () => { launch('image') } },
      { label: messages().captureLong, click: () => { launch('long') } },
    ] : []),
    ...(config.recording.enabled ? [{ label: messages().captureVideo, click: () => { launch('video') } }] : []),
  ])
}
