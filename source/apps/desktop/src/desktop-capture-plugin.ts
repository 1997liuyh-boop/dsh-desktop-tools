/** 截图录屏扩展独立提供菜单入口、全局快捷键、采集窗口、钉图管理和异步写盘清理。 */
import { globalShortcut, ipcMain } from 'electron'
import { DesktopCapture, type CaptureMode } from './desktop-capture.ts'
import type { DesktopFeatureContext } from './desktop-feature-host.ts'
import { readDesktopToolsConfig } from './desktop-tools-config.ts'
import { registerCaptureShortcuts, type CaptureShortcutMode, type CaptureShortcutStatus } from './capture-shortcuts.ts'

declare module './desktop-feature-host.ts' {
  interface DesktopFeatureServices {
    capture: {
      open(mode: CaptureMode): Promise<string | undefined>
      allowsDisplayMedia: DesktopCapture['allowsDisplayMedia']
      /** 全局快捷键注册结果，供诊断页读取。 */
      shortcuts(): CaptureShortcutStatus
      /** 钉图管理：数量与打开管理窗。 */
      pins: { count(): number; manage(): void }
      /** 截图历史：打开历史窗；Host 清空历史后刷新已打开的窗口。 */
      history: { open(): void; changed(): void }
    }
  }
}

/** 采集界面仅在插件安装期间通过自定义协议提供。 */
export const shellAssets = [
  '/capture.html', '/capture.js', '/capture.css', '/capture.tw.css', '/capture-frame.html',
  '/capture-pin.html', '/capture-pin.js', '/capture-result.html', '/capture-result.js', '/capture-result.css',
  '/capture-pins.html', '/capture-pins.js', '/capture-history.html', '/capture-history.js',
  '/mermaid.min.js', '/selection-markdown.js', '/shell-theme.js', '/assets/window-material.css',
]

/** @param context 当前安装包的原生资源作用域。 */
export function activate(context: DesktopFeatureContext): void {
  const environment = context.environment
  // 设置页保存后由 onConfig 就地替换，不需要重启本功能。
  let config = readDesktopToolsConfig(environment.profile)
  const capture = new DesktopCapture({
    directory: environment.profile,
    preload: environment.preload,
    messages: () => environment.locale().messages,
    chinese: () => environment.locale().id === 'zh-CN',
    config: () => config,
    transport: { request: (path, body, signal) => context.request(path, body, signal) },
    currentSessionId: () => context.currentSession(),
    showMain: () => { context.showMain() },
    // 托盘菜单显示钉图数量，钉图变化时重建菜单。
    pinsChanged: () => { environment.changed() },
  })
  context.effect(capture.register(ipcMain))
  const open = (mode: CaptureMode): Promise<string | undefined> => {
    const enabled = mode === 'video' ? config.recording.enabled : config.screenshot.enabled
    if (!enabled) return Promise.reject(new Error(mode === 'video' ? '录屏功能未启用' : '截图功能未启用'))
    return capture.open(mode)
  }
  const launch = (mode: CaptureShortcutMode): void => {
    if (mode === 'pins') { capture.togglePins(); return }
    void open(mode).catch((error: unknown) => { console.error('截图录屏启动失败', error) })
  }
  // 快捷键在下方注册，诊断页读取时始终拿到最新结果。
  let shortcutStatus: CaptureShortcutStatus = { registered: [], failed: [] }
  context.provide('capture', {
    open, allowsDisplayMedia: contents => capture.allowsDisplayMedia(contents), shortcuts: () => shortcutStatus,
    pins: { count: () => capture.pinCount(), manage: () => { capture.openPinsManager() } },
    history: { open: () => { capture.openHistory() }, changed: () => { capture.historyChanged() } },
  })
  context.registerSender(event => capture.owns(event))
  // 截图录屏功能重启（例如重新启用）时，钉图从磁盘恢复。
  capture.restorePins()

  /** 系统级快捷键：DSH 主窗口不在前台时同样可以唤起。重复调用会先注销上一次注册的组合。 */
  const registerShortcuts = (): void => {
    for (const accelerator of shortcutStatus.registered) globalShortcut.unregister(accelerator)
    shortcutStatus = registerCaptureShortcuts([
      { accelerator: config.screenshot.shortcut, mode: 'image', enabled: config.screenshot.enabled },
      { accelerator: config.screenshot.longShortcut, mode: 'long', enabled: config.screenshot.enabled },
      { accelerator: config.screenshot.pinsShortcut, mode: 'pins', enabled: config.screenshot.enabled },
      { accelerator: config.recording.shortcut, mode: 'video', enabled: config.recording.enabled },
    ], (accelerator, mode) => globalShortcut.register(accelerator, () => { launch(mode) }))
    for (const { accelerator, reason } of shortcutStatus.failed) {
      console.warn(reason === 'occupied' ? `截图录屏快捷键已被其他程序占用: ${accelerator}` : `截图录屏快捷键无效: ${accelerator}`)
    }
  }
  registerShortcuts()
  context.effect(() => { for (const accelerator of shortcutStatus.registered) globalShortcut.unregister(accelerator) })
  // 设置页保存：替换配置快照、重新注册快捷键、刷新托盘菜单；已打开的窗口不受影响。
  context.onConfig(() => {
    config = readDesktopToolsConfig(environment.profile)
    registerShortcuts()
    environment.changed()
  })

  const messages = (): ReturnType<typeof environment.locale>['messages'] => environment.locale().messages
  context.menu(() => {
    const count = capture.pinCount()
    const pins = config.screenshot.enabled || count > 0 ? [{
      label: messages().capturePins.replace('{count}', String(count)),
      submenu: [
        { label: messages().capturePinsManage, click: () => { capture.openPinsManager() } },
        { type: 'separator' as const },
        { label: messages().capturePinsShowAll, enabled: count > 0, click: () => { capture.setPinsHidden(false) } },
        { label: messages().capturePinsHideAll, enabled: count > 0, click: () => { capture.setPinsHidden(true) } },
        { label: messages().capturePinsCloseAll, enabled: count > 0, click: () => { capture.closeAllPins() } },
      ],
    }] : []
    return [
      ...(config.screenshot.enabled ? [
        { label: messages().captureScreenshot, click: () => { launch('image') } },
        { label: messages().captureLong, click: () => { launch('long') } },
      ] : []),
      ...(config.recording.enabled ? [{ label: messages().captureVideo, click: () => { launch('video') } }] : []),
      ...pins,
      { label: messages().captureHistoryOpen, click: () => { capture.openHistory() } },
    ]
  })
}
