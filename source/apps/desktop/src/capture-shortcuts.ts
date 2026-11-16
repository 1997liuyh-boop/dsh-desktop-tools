/** 截图录屏全局快捷键注册（不依赖 electron，便于单测）。 */

/** 截图录屏快捷键的入口；pins 为显示 / 隐藏全部钉图。 */
export type CaptureShortcutMode = 'image' | 'video' | 'long' | 'pins'

/** 单条待注册的快捷键：组合、触发模式、对应功能是否启用。 */
export interface CaptureShortcutEntry {
  readonly accelerator: string
  readonly mode: CaptureShortcutMode
  readonly enabled: boolean
}

/** 注册失败的快捷键及原因：occupied 为被其他程序占用，invalid 为组合无效。 */
export interface CaptureShortcutFailure {
  readonly accelerator: string
  readonly reason: 'occupied' | 'invalid'
}

/** 注册结果，供诊断页展示。 */
export interface CaptureShortcutStatus {
  readonly registered: readonly string[]
  readonly failed: readonly CaptureShortcutFailure[]
}

/**
 * 依次注册快捷键：跳过未启用或为空的项，同一组合只注册一次。
 * @param entries 待注册的快捷键。
 * @param register 实际注册函数（通常为 globalShortcut.register），返回 false 表示被占用，抛错表示组合无效。
 * @returns 已注册与注册失败的快捷键。
 */
export function registerCaptureShortcuts(entries: readonly CaptureShortcutEntry[],
  register: (accelerator: string, mode: CaptureShortcutMode) => boolean): CaptureShortcutStatus {
  const registered: string[] = []
  const failed: CaptureShortcutFailure[] = []
  const seen = new Set<string>()
  for (const { accelerator, mode, enabled } of entries) {
    if (!enabled || accelerator === '' || seen.has(accelerator)) continue
    seen.add(accelerator)
    try {
      if (register(accelerator, mode)) registered.push(accelerator)
      else failed.push({ accelerator, reason: 'occupied' })
    } catch {
      failed.push({ accelerator, reason: 'invalid' })
    }
  }
  return { registered, failed }
}
