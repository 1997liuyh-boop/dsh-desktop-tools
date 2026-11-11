/** 钉在桌面的截图窗口：拖动移动、滚轮缩放、双击或 Esc 关闭、右键菜单。 */
import { byId, request } from './dom.ts'

interface Bounds { x: number; y: number; width: number; height: number }

void (async () => {
  const image = byId<HTMLImageElement>('pin-image')
  const info = await request<{ image: string; width: number; height: number }>('pin-init')
  image.src = info.image
  const { messages } = await window.dshDesktop.locale()
  document.title = messages.capturePin ?? ''
  image.alt = messages.capturePin ?? ''

  let bounds = await request<Bounds>('pin-position')
  let drag: { x: number; y: number; origin: Bounds } | undefined
  let pending: Bounds | undefined
  let scheduled = false

  // 合并同一帧内的多次移动，避免 IPC 堆积。
  function apply(next: Bounds): void {
    pending = next
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      const target = pending
      pending = undefined
      if (target) void request<Bounds>('pin-bounds', target).then(value => { bounds = value })
    })
  }

  document.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    drag = { x: event.screenX, y: event.screenY, origin: { ...bounds } }
    document.body.setPointerCapture(event.pointerId)
    document.body.dataset.dragging = ''
  })
  document.addEventListener('pointermove', event => {
    if (!drag) return
    bounds = { ...drag.origin, x: Math.round(drag.origin.x + event.screenX - drag.x), y: Math.round(drag.origin.y + event.screenY - drag.y) }
    apply(bounds)
  })
  document.addEventListener('pointerup', event => {
    if (!drag) return
    drag = undefined
    delete document.body.dataset.dragging
    document.body.releasePointerCapture(event.pointerId)
  })
  document.addEventListener('wheel', event => {
    event.preventDefault()
    // 以鼠标位置为锚点缩放。
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
    const width = Math.max(24, Math.round(bounds.width * factor))
    const ratio = width / bounds.width
    const height = Math.round(bounds.height * ratio)
    bounds = { x: Math.round(bounds.x + event.offsetX * (1 - ratio)), y: Math.round(bounds.y + event.offsetY * (1 - ratio)), width, height }
    apply(bounds)
  }, { passive: false })
  document.addEventListener('dblclick', () => { void request('pin-close') })
  document.addEventListener('contextmenu', event => { event.preventDefault(); void request('pin-menu') })
  window.dshDesktop.capture.onEvent(event => {
    if (typeof event === 'object' && event !== null && 'type' in event && event.type === 'pin-reset') {
      void request<Bounds>('pin-position').then(value => { bounds = value })
    }
  })
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') void request('pin-close')
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') void request('pin-copy')
  })
})()
