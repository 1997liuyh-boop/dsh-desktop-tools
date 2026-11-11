/** 长截图「自动滚动」所需的原生滚轮注入；Linux 不提供。 */
import { screen } from 'electron'
import { loadKoffiPlatform, type KoffiFunction } from './koffi-platform.ts'

/** 在屏幕某点向下滚动若干行。 */
export interface CaptureScroller {
  /**
   * @param point 屏幕 DIP 坐标（Electron 坐标系）。
   * @param lines 向下滚动的行数，必须为正数。
   */
  scroll(point: { readonly x: number; readonly y: number }, lines: number): void
}

const WHEEL_DELTA = 120
const INPUT_MOUSE = 0
const MOUSEEVENTF_WHEEL = 0x0800
const SCROLL_UNIT_LINE = 1
const HID_EVENT_TAP = 0

let cached: CaptureScroller | null | undefined

function windowsScroller(): CaptureScroller {
  const koffi = loadKoffiPlatform()
  koffi.struct('DSH_CAP_MOUSEINPUT', {
    dx: 'int32', dy: 'int32', mouseData: 'int32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr',
  })
  const input = koffi.struct('DSH_CAP_INPUT', { type: 'uint32', mi: 'DSH_CAP_MOUSEINPUT' })
  const user32 = koffi.load('user32.dll')
  const setCursorPos: KoffiFunction = user32.func('bool __stdcall SetCursorPos(int x, int y)')
  const sendInput: KoffiFunction = user32.func('uint32 __stdcall SendInput(uint32 cInputs, DSH_CAP_INPUT *pInputs, int cbSize)')
  const size = koffi.sizeof(input)
  return {
    scroll(point, lines) {
      // Windows 的 SetCursorPos 使用物理像素，需要从 DIP 换算。
      const physical = screen.dipToScreenPoint({ x: Math.round(point.x), y: Math.round(point.y) })
      setCursorPos(physical.x, physical.y)
      const sent = sendInput(1, {
        type: INPUT_MOUSE, mi: { dx: 0, dy: 0, mouseData: -WHEEL_DELTA * Math.max(1, Math.round(lines)), dwFlags: MOUSEEVENTF_WHEEL, time: 0, dwExtraInfo: 0 },
      }, size)
      if (sent !== 1) throw new Error('系统拒绝了模拟滚动输入')
    },
  }
}

function macosScroller(): CaptureScroller {
  const koffi = loadKoffiPlatform()
  koffi.struct('DSH_CAP_CGPOINT', { x: 'double', y: 'double' })
  const graphics = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
  const foundation = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
  const warp: KoffiFunction = graphics.func('int32 CGWarpMouseCursorPosition(DSH_CAP_CGPOINT point)')
  const create: KoffiFunction = graphics.func('void *CGEventCreateScrollWheelEvent(void *source, uint32 units, uint32 wheelCount, int32 wheel1, ...)')
  const post: KoffiFunction = graphics.func('void CGEventPost(uint32 tap, void *event)')
  const release: KoffiFunction = foundation.func('void CFRelease(void *value)')
  return {
    scroll(point, lines) {
      warp({ x: point.x, y: point.y })
      const event = create(null, SCROLL_UNIT_LINE, 1, -Math.max(1, Math.round(lines)))
      if (event === null) throw new Error('无法创建滚动事件，请在系统设置中授予辅助功能权限')
      try { post(HID_EVENT_TAP, event) } finally { release(event) }
    },
  }
}

/** @returns 当前平台的滚轮注入器；不支持或加载失败时为 undefined。 */
export function captureScroller(): CaptureScroller | undefined {
  if (cached !== undefined) return cached ?? undefined
  try {
    cached = process.platform === 'win32' ? windowsScroller() : process.platform === 'darwin' ? macosScroller() : null
  } catch (error: unknown) {
    console.warn('长截图自动滚动不可用:', error)
    cached = null
  }
  return cached ?? undefined
}
