/** 截图 / 录屏 / 长截图覆盖层：屏幕顶部工具栏、框选编辑、录制与长截图拼接。 */
import { byId, canvasPng, clock, followTheme, format, h, request, type Messages } from './dom.ts'
import { icons, type IconName } from './icons.ts'
import { area, constrain, drawMark, fontSize, inside, pixelate, type Box, type Mark, type Point, type Tool } from './marks.ts'
import { recorderType, ScreenRecorder, type RecordingFormat, type RecordingQuality } from './recorder.ts'
import { LongStitcher } from './stitch.ts'

type Mode = 'image' | 'video' | 'long'
type Scope = 'region' | 'window' | 'screen'
type Phase = 'select' | 'recording' | 'recorded' | 'long-capture' | 'long-result' | 'done'
type Popover = 'shape' | 'text' | 'forward' | 'windows' | 'screens' | undefined

interface ScreenImage { id: string; x: number; y: number; width: number; height: number; scaleFactor: number; bitmap: HTMLImageElement }
interface DesktopInfo {
  width: number; height: number; pointer: Point; platform: string; scroll: boolean; share: boolean
  images: { id: string; x: number; y: number; width: number; height: number; scaleFactor: number; image: string }[]
  recording: { format: RecordingFormat; quality: RecordingQuality; systemAudio: boolean; microphone: boolean; knowledgeGraph: boolean }
}
interface SourceInfo { id: string; name: string; kind: 'window' | 'screen'; displayId: string; thumbnail: string; icon: string }

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#111827']
const STROKES = [2, 4, 7]

void (async () => {
  followTheme()
  const { messages: m, id: locale } = await window.dshDesktop.locale() as { id: string; messages: Messages }
  document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : locale
  document.title = m.captureTitle ?? ''
  const surface = byId<HTMLCanvasElement>('surface')
  const painter = surface.getContext('2d')!
  const bar = byId('bar'), panel = byId('panel'), status = byId('status'), badge = byId('size-badge')
  const editor = byId<HTMLTextAreaElement>('text-editor')
  const params = new URLSearchParams(location.search)

  // ---------- 状态 ----------
  let mode: Mode = params.get('mode') === 'video' ? 'video' : params.get('mode') === 'long' ? 'long' : 'image'
  let phase: Phase = 'select'
  let desktop: DesktopInfo | undefined
  let screens: ScreenImage[] = []
  let selection: Box | undefined
  let drag: { origin?: Point; move?: Point; resize?: { x: string; y: string }; original?: Box; mark?: Mark } | undefined
  let tool: Tool | undefined
  let shape: 'rect' | 'ellipse' | 'line' = 'rect'
  let textKind: 'text' | 'number' = 'text'
  let color = COLORS[0]!
  let stroke = 1
  let textSize = 2
  let mosaicBlock = 12
  let marks: Mark[] = []
  let textPoint: Point | undefined
  let popover: Popover
  let busy = false
  let compact = false
  let vision: string = 'unknown'
  let forwardNote = ''
  // 录屏选项
  let scope: Scope = 'region'
  let recordFormat: RecordingFormat = 'mp4'
  let quality: RecordingQuality = 'hd'
  let systemAudio = true
  let microphone = false
  let keyframes = false
  let windows: SourceInfo[] = []
  let chosenWindow: SourceInfo | undefined
  let chosenScreen: ScreenImage | undefined
  let recorder: ScreenRecorder | undefined
  let savedPath: string | undefined
  let pendingSave = false
  // 长截图
  let stitcher: LongStitcher | undefined
  let longStream: MediaStream | undefined
  let longTimers: ReturnType<typeof setInterval>[] = []
  let longResult: HTMLCanvasElement | undefined
  let longScale = 1
  let autoScroll: ReturnType<typeof setInterval> | undefined
  let mosaicCache: { key: string; canvas: HTMLCanvasElement; box: Box } | undefined

  // ---------- 基础 ----------
  function setStatus(text: string, tone: 'info' | 'error' = 'info'): void {
    status.textContent = text
    status.dataset.tone = tone
    status.hidden = text === ''
    placeStatus()
  }
  function fail(error: unknown): void { setStatus((m.captureFailed ?? '') + '\n' + (error instanceof Error ? error.message : String(error)), 'error') }
  function position(event: PointerEvent): Point {
    return { x: Math.max(0, Math.min(desktop?.width ?? 0, event.clientX)), y: Math.max(0, Math.min(desktop?.height ?? 0, event.clientY)) }
  }
  function pointerScreen(): ScreenImage | undefined {
    const pointer = desktop?.pointer
    return screens.find(item => pointer && inside(pointer, item)) ?? screens[0]
  }
  function selectionScreen(): ScreenImage | undefined {
    if (!selection) return undefined
    const box = selection
    return screens.find(item => inside({ x: box.x, y: box.y }, item) && inside({ x: box.x + box.width, y: box.y + box.height }, item))
  }
  function strokeWidth(): number { return STROKES[stroke] ?? 4 }

  // ---------- 画布 ----------
  function mosaicSource(block: number): { canvas: CanvasImageSource; box: Box } | undefined {
    if (!selection) return undefined
    const box = selection
    const key = `${block}|${box.x}|${box.y}|${box.width}|${box.height}`
    if (mosaicCache?.key !== key) {
      mosaicCache = { key, box, canvas: pixelate(context => { for (const item of screens) context.drawImage(item.bitmap, item.x, item.y, item.width, item.height) }, box, block) }
    }
    return { canvas: mosaicCache.canvas, box: mosaicCache.box }
  }

  function draw(): void {
    if (!desktop || compact) return
    painter.clearRect(0, 0, surface.width, surface.height)
    for (const item of screens) painter.drawImage(item.bitmap, item.x, item.y, item.width, item.height)
    painter.fillStyle = 'rgba(0,0,0,.45)'
    const highlight = mode === 'video' && scope === 'screen' ? chosenScreen : mode === 'video' && scope === 'window' ? undefined : selection
    if (!highlight) { painter.fillRect(0, 0, desktop.width, desktop.height); badge.hidden = true; return }
    const box = highlight
    painter.fillRect(0, 0, desktop.width, box.y)
    painter.fillRect(0, box.y + box.height, desktop.width, desktop.height - box.y - box.height)
    painter.fillRect(0, box.y, box.x, box.height)
    painter.fillRect(box.x + box.width, box.y, desktop.width - box.x - box.width, box.height)
    if (selection && highlight === selection) {
      painter.save(); painter.beginPath(); painter.rect(box.x, box.y, box.width, box.height); painter.clip()
      for (const mark of marks) drawMark(painter, mark, mosaicSource)
      if (drag?.mark) drawMark(painter, drag.mark, mosaicSource)
      painter.restore()
    }
    painter.strokeStyle = mode === 'video' ? '#ef4444' : '#22c55e'
    painter.lineWidth = 1.5
    painter.strokeRect(box.x, box.y, box.width, box.height)
    if (selection && highlight === selection && !tool) {
      painter.fillStyle = '#fff'
      for (const x of [box.x, box.x + box.width / 2, box.x + box.width]) for (const y of [box.y, box.y + box.height / 2, box.y + box.height]) {
        if (x === box.x + box.width / 2 && y === box.y + box.height / 2) continue
        painter.fillRect(x - 3, y - 3, 6, 6); painter.strokeRect(x - 3, y - 3, 6, 6)
      }
    }
    badge.hidden = false
    badge.textContent = format(m.captureSize, { width: Math.round(box.width), height: Math.round(box.height) })
    badge.style.left = box.x + 'px'
    badge.style.top = Math.max(0, box.y - 26) + 'px'
  }

  /** 合成选区（含标注）为物理像素画布。 */
  function compose(): { canvas: HTMLCanvasElement; scale: number } {
    if (!selection) throw new Error(m.captureFailed)
    const box = selection
    const overlapping = screens.filter(item => box.x < item.x + item.width && box.x + box.width > item.x && box.y < item.y + item.height && box.y + box.height > item.y)
    const scale = Math.max(1, ...overlapping.map(item => item.scaleFactor))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(box.width * scale); canvas.height = Math.round(box.height * scale)
    if (!canvas.width || !canvas.height || canvas.width * canvas.height > 120_000_000) throw new Error(m.captureFailed)
    const context = canvas.getContext('2d')!
    context.scale(scale, scale); context.translate(-box.x, -box.y)
    for (const item of screens) context.drawImage(item.bitmap, item.x, item.y, item.width, item.height)
    for (const mark of marks) drawMark(context, mark, mosaicSource)
    return { canvas, scale }
  }

  // ---------- 工具栏 ----------
  function button(icon: IconName, label: string | undefined, onClick: () => void, options: { pressed?: boolean; primary?: boolean; disabled?: boolean; text?: boolean; menu?: boolean; badge?: boolean; danger?: boolean; expanded?: boolean } = {}): HTMLButtonElement {
    const element = h('button', {
      type: 'button', className: ['tool', options.primary ? 'primary' : '', options.text ? 'with-text' : '', options.danger ? 'danger' : ''].filter(Boolean).join(' '),
      title: label, 'aria-label': label, 'aria-pressed': options.pressed === undefined ? undefined : String(options.pressed),
      'aria-haspopup': options.menu ? 'true' : undefined, 'aria-expanded': options.expanded === undefined ? undefined : String(options.expanded),
      disabled: options.disabled || busy, onclick: (event: Event) => { event.stopPropagation(); onClick() },
    })
    element.innerHTML = icons[icon] + (options.text ? `<span>${label ?? ''}</span>` : '') + (options.menu ? `<i class="caret">${icons.chevron}</i>` : '') + (options.badge ? '<i class="dot"></i>' : '')
    return element
  }
  const divider = (): HTMLElement => h('span', { className: 'divider', 'aria-hidden': 'true' })
  function toggle(label: string | undefined, checked: boolean, onChange: (value: boolean) => void, options: { disabled?: boolean; icon?: IconName; title?: string } = {}): HTMLElement {
    const input = h('input', { type: 'checkbox', checked, disabled: options.disabled || busy, onchange: (event: Event) => { onChange((event.target as HTMLInputElement).checked) } })
    const wrap = h('label', { className: 'switch', title: options.title ?? label }, input)
    if (options.icon) wrap.insertAdjacentHTML('beforeend', icons[options.icon])
    wrap.append(h('span', {}, label ?? ''))
    return wrap
  }
  function select<T extends string>(label: string | undefined, value: T, choices: [T, string][], onChange: (value: T) => void, disabled = false): HTMLElement {
    const element = h('select', { 'aria-label': label, title: label, disabled: disabled || busy, onchange: (event: Event) => { onChange((event.target as HTMLSelectElement).value as T) } },
      ...choices.map(([key, text]) => h('option', { value: key, selected: key === value }, text)))
    return h('label', { className: 'field' }, h('span', {}, label ?? ''), element)
  }

  function modeTabs(): HTMLElement {
    const tab = (value: Mode, icon: IconName, label: string | undefined): HTMLElement => button(icon, label, () => { switchMode(value) }, { pressed: mode === value, text: true })
    return h('div', { className: 'tabs', role: 'tablist' }, tab('image', 'screenshot', m.captureScreenshot), tab('video', 'video', m.captureVideo), tab('long', 'long', m.captureLong))
  }

  function imageTools(): HTMLElement[] {
    const ready = Boolean(selection)
    const choose = (next: Tool): void => { commitText(); tool = tool === next ? undefined : next; popover = undefined; render() }
    const shapeIcon: IconName = shape
    const needsVision = vision !== 'ready' && vision !== 'unknown'
    const analyze = (kind: 'ocr' | 'translate' | 'graph'): void => { void runImage(async (png) => { await request('analyze', { kind, data: png }); await close(true) }) }
    return [
      button(shapeIcon, m.captureShape, () => { if (tool === shape) popover = popover === 'shape' ? undefined : 'shape'; else { choose(shape); popover = 'shape' }; render() }, { pressed: tool === shape, disabled: !ready, menu: true, expanded: popover === 'shape' }),
      button('pen', m.capturePen, () => { choose('pen') }, { pressed: tool === 'pen', disabled: !ready }),
      button('arrow', m.captureArrow, () => { choose('arrow') }, { pressed: tool === 'arrow', disabled: !ready }),
      button(textKind, textKind === 'text' ? m.captureText : m.captureNumber, () => { if (tool === textKind) popover = popover === 'text' ? undefined : 'text'; else { choose(textKind); popover = 'text' }; render() }, { pressed: tool === textKind, disabled: !ready, menu: true, expanded: popover === 'text' }),
      button('mosaic', m.captureMosaic, () => { choose('mosaic') }, { pressed: tool === 'mosaic', disabled: !ready }),
      divider(),
      button('pin', m.capturePin, () => { void runImage(async (png) => { await request('pin', { data: png, bounds: selection }); await close(true) }) }, { disabled: !ready }),
      button('long', m.captureLong, () => { void startLong() }, { disabled: !ready }),
      button('graph', m.captureGraph, () => { analyze('graph') }, { disabled: !ready, badge: needsVision }),
      button('translate', m.captureTranslate, () => { analyze('translate') }, { disabled: !ready, badge: needsVision }),
      button('ocr', m.captureOcr, () => { analyze('ocr') }, { disabled: !ready, badge: needsVision }),
      divider(),
      button('undo', m.captureUndo, undo, { disabled: !ready || marks.length === 0 }),
      button('forward', m.captureForward, () => { popover = popover === 'forward' ? undefined : 'forward'; render() }, { disabled: !ready, menu: true, expanded: popover === 'forward' }),
      button('save', m.captureSaveLocal, () => { void saveImage() }, { disabled: !ready }),
      divider(),
      button('close', m.captureExit, () => { void close() }, { danger: true }),
      button('check', m.captureDone, () => { void done() }, { primary: true, disabled: !ready, text: true }),
    ]
  }

  function videoTools(): HTMLElement[] {
    const scopeButton = (value: Scope, label: string | undefined): HTMLElement => button(value === 'region' ? 'screenshot' : value === 'window' ? 'video' : 'long', label, () => {
      scope = value
      popover = value === 'window' ? 'windows' : value === 'screen' && screens.length > 1 ? 'screens' : undefined
      if (value === 'window') void loadWindows()
      if (value === 'screen') chosenScreen ??= pointerScreen()
      render(); draw()
    }, { pressed: scope === value, text: true, expanded: (value === 'window' && popover === 'windows') || (value === 'screen' && popover === 'screens') })
    const gif = recordFormat === 'gif'
    const ready = scope === 'region' ? Boolean(selection) : scope === 'window' ? Boolean(chosenWindow) : Boolean(chosenScreen)
    const audioSupported = desktop?.platform === 'win32' || desktop?.platform === 'darwin'
    return [
      h('div', { className: 'segmented' }, scopeButton('region', m.captureScopeRegion), scopeButton('window', m.captureScopeWindow), scopeButton('screen', m.captureScopeScreen)),
      divider(),
      select(m.captureFormat, recordFormat, [['mp4', 'MP4'], ['gif', 'GIF'], ['webm', 'WebM']], value => { recordFormat = value; render() }),
      select(m.captureQuality, quality, [['sd', m.captureQualitySd ?? 'SD'], ['hd', m.captureQualityHd ?? 'HD'], ['original', m.captureQualityOriginal ?? 'Original']], value => { quality = value; render() }),
      toggle(m.captureSystemAudio, systemAudio && !gif && audioSupported, value => { systemAudio = value }, { disabled: gif || !audioSupported, icon: 'sound', title: gif ? m.captureGifNoAudio : audioSupported ? m.captureSystemAudio : m.captureAudioUnavailable }),
      toggle(m.captureMicrophone, microphone && !gif, value => { microphone = value }, { disabled: gif, icon: 'mic', title: gif ? m.captureGifNoAudio : m.captureMicrophone }),
      toggle(m.captureVideoGraph, keyframes, value => { keyframes = value }, { icon: 'graph', title: m.captureVideoGraphHint }),
      divider(),
      button('close', m.captureQuit, () => { void close() }, { danger: true, text: true }),
      button('record', m.captureStart, () => { void startRecording() }, { primary: true, disabled: !ready, text: true }),
    ]
  }

  function longTools(): HTMLElement[] {
    return [
      h('span', { className: 'hint' }, m.captureLongHint ?? ''),
      divider(),
      button('close', m.captureExit, () => { void close() }, { danger: true, text: true }),
      button('play', m.captureLongStart, () => { void startLong() }, { primary: true, disabled: !selection, text: true }),
    ]
  }

  function properties(): HTMLElement | undefined {
    if (mode !== 'image' || !tool) return undefined
    const swatches = COLORS.map(value => h('button', {
      type: 'button', className: 'swatch', style: `--swatch:${value}`, 'aria-label': value, 'aria-pressed': String(color === value),
      onclick: () => { color = value; render() },
    }))
    const custom = h('input', { type: 'color', value: color, 'aria-label': m.captureColor, title: m.captureColor, oninput: (event: Event) => { color = (event.target as HTMLInputElement).value } })
    const sizes = (current: number, onPick: (value: number) => void, label: string | undefined): HTMLElement => h('div', { className: 'sizes', role: 'group', 'aria-label': label },
      ...[0, 1, 2].map(index => h('button', { type: 'button', className: 'size', title: label, 'aria-pressed': String(current === index), onclick: () => { onPick(index); render() } }, h('i', { style: `--dot:${4 + index * 4}px` }))))
    const items: HTMLElement[] = []
    if (tool === 'mosaic') {
      items.push(sizes(stroke, value => { stroke = value }, m.captureStrokeWidth))
      items.push(h('label', { className: 'field' }, h('span', {}, m.captureMosaicSize ?? ''),
        h('input', { type: 'range', min: '6', max: '30', step: '2', value: String(mosaicBlock), oninput: (event: Event) => { mosaicBlock = Number((event.target as HTMLInputElement).value) } })))
    } else {
      items.push(tool === 'text' || tool === 'number' ? sizes(textSize, value => { textSize = value; if (!editor.hidden) styleEditor() }, m.captureFontSize) : sizes(stroke, value => { stroke = value }, m.captureStrokeWidth))
      items.push(divider(), ...swatches, custom)
    }
    return h('div', { className: 'bar-row props' }, ...items)
  }

  function popoverContent(): HTMLElement | undefined {
    if (popover === 'shape') {
      return h('div', { className: 'menu' }, ...(['rect', 'ellipse', 'line'] as const).map(kind => button(kind, kind === 'rect' ? m.captureRectangle : kind === 'ellipse' ? m.captureEllipse : m.captureLine,
        () => { shape = kind; tool = kind; popover = undefined; render() }, { pressed: shape === kind, text: true })))
    }
    if (popover === 'text') {
      return h('div', { className: 'menu' }, ...(['text', 'number'] as const).map(kind => button(kind, kind === 'text' ? m.captureText : m.captureNumber,
        () => { textKind = kind; tool = kind; popover = undefined; render() }, { pressed: textKind === kind, text: true })))
    }
    if (popover === 'forward') {
      const note = h('textarea', { rows: '2', placeholder: m.captureForwardNote, oninput: (event: Event) => { forwardNote = (event.target as HTMLTextAreaElement).value } })
      note.value = forwardNote
      return h('div', { className: 'menu forward' },
        h('div', { className: 'menu-section' }, h('strong', {}, m.captureForwardDsh ?? ''), note,
          button('forward', m.captureSend, () => { void forward('dsh') }, { primary: true, text: true })),
        desktop?.share ? button('forward', m.captureForwardShare, () => { void forward('share') }, { text: true }) : null)
    }
    if (popover === 'windows') {
      if (windows.length === 0) return h('div', { className: 'menu' }, h('span', { className: 'hint' }, m.captureNoWindows ?? ''))
      return h('div', { className: 'menu grid', role: 'listbox', 'aria-label': m.captureChooseWindow },
        ...windows.filter(item => item.kind === 'window').map(item => h('button', {
          type: 'button', className: 'source', role: 'option', 'aria-selected': String(chosenWindow?.id === item.id), title: item.name,
          onclick: () => { chosenWindow = item; popover = undefined; render() },
        }, item.thumbnail ? h('img', { src: item.thumbnail, alt: '' }) : h('span', { className: 'blank' }),
        h('span', { className: 'name' }, item.icon ? h('img', { src: item.icon, alt: '', className: 'icon' }) : null, item.name))))
    }
    if (popover === 'screens') {
      return h('div', { className: 'menu', role: 'listbox', 'aria-label': m.captureChooseScreen },
        ...screens.map((item, index) => button('screenshot', `${index + 1} · ${item.width}×${item.height}`, () => { chosenScreen = item; popover = undefined; render(); draw() }, { pressed: chosenScreen === item, text: true })))
    }
    return undefined
  }

  function render(): void {
    bar.replaceChildren()
    if (compact) { bar.hidden = true; renderPanel(); return }
    bar.hidden = false
    panel.hidden = true
    const tools = mode === 'image' ? imageTools() : mode === 'video' ? videoTools() : longTools()
    bar.append(h('div', { className: 'bar-row' }, modeTabs(), divider(), ...tools))
    if (mode === 'image' && !selection) bar.append(h('div', { className: 'bar-hint' }, m.captureRegionHint ?? ''))
    if (mode === 'video' && scope === 'region' && !selection) bar.append(h('div', { className: 'bar-hint' }, m.captureRegionHint ?? ''))
    if (mode === 'video' && scope === 'window' && chosenWindow) bar.append(h('div', { className: 'bar-hint' }, `${m.captureScopeWindow ?? ''}: ${chosenWindow.name}`))
    const props = properties()
    if (props) bar.append(props)
    if (mode === 'image' && selection) bar.append(h('div', { className: 'bar-hint subtle' }, m.captureShortcuts ?? ''))
    placeBar()
    const content = popoverContent()
    if (content) {
      // 下拉浮层挂在触发按钮正下方，不撑开工具栏。
      bar.append(content)
      const anchor = bar.querySelector<HTMLElement>('[aria-expanded="true"]')
      const left = anchor ? anchor.getBoundingClientRect().left - bar.getBoundingClientRect().left : 6
      content.style.left = Math.max(0, Math.min(left, bar.offsetWidth - content.offsetWidth)) + 'px'
    }
  }

  function placeBar(): void {
    const display = pointerScreen()
    if (!display || compact) return
    bar.style.maxWidth = Math.max(320, display.width - 24) + 'px'
    const width = bar.offsetWidth
    bar.style.left = Math.round(display.x + (display.width - width) / 2) + 'px'
    bar.style.top = display.y + 12 + 'px'
    placeStatus()
  }

  function placeStatus(): void {
    if (compact) { status.style.left = ''; status.style.top = ''; return }
    const rect = bar.getBoundingClientRect()
    status.style.left = rect.left + 'px'
    status.style.top = rect.bottom + 8 + 'px'
    status.style.maxWidth = rect.width + 'px'
  }

  // ---------- 紧凑面板（录制中 / 已保存 / 长截图） ----------
  function renderPanel(): void {
    panel.hidden = false
    panel.replaceChildren()
    if (phase === 'recording' && recorder) {
      const paused = recorder.isPaused()
      panel.append(h('div', { className: 'bar-row recording' },
        h('span', { className: paused ? 'rec-dot paused' : 'rec-dot' }),
        h('strong', {}, paused ? m.capturePaused ?? '' : m.captureRecordingNow ?? ''),
        h('output', { id: 'timer', className: 'timer' }, clock(recorder.seconds())),
        h('span', { className: 'grow' }),
        button(paused ? 'play' : 'pause', paused ? m.captureResume : m.capturePause, () => { recorder?.togglePause(); renderPanel() }, { text: true }),
        button('stop', m.captureFinish, () => { recorder?.stop() }, { primary: true, text: true }),
        button('close', m.captureCancel, () => { recorder?.stop(true) }, { danger: true, text: true })))
      return
    }
    if (phase === 'recorded' || phase === 'done') {
      panel.append(h('div', { className: 'bar-row' },
        h('span', { className: 'grow' }),
        pendingSave ? button('save', m.captureSelectSave, () => { void saveRecording() }, { primary: true, text: true }) : null,
        pendingSave ? button('close', m.captureDiscard, () => { void close() }, { danger: true, text: true }) : null,
        savedPath ? button('folder', m.selectionOpenFolder ?? m.captureSaveLocal, () => { void request('reveal').catch(fail) }, { text: true }) : null,
        !pendingSave ? button('check', m.captureDone, () => { void close() }, { primary: true, text: true }) : null))
      return
    }
    if (phase === 'long-capture') {
      const preview = h('canvas', { id: 'long-preview', className: 'long-preview' })
      panel.append(
        h('div', { className: 'panel-head' }, h('strong', {}, m.captureLong ?? ''), h('output', { id: 'long-height', className: 'timer' }, format(m.captureLongHeight, { height: stitcher?.length ?? 0 }))),
        h('p', { className: 'hint' }, m.captureLongScrollTip ?? ''),
        preview,
        h('div', { className: 'bar-row' },
          desktop?.scroll ? button('scroll', autoScroll ? m.captureLongAutoStop : m.captureLongAuto, toggleAutoScroll, { text: true, pressed: Boolean(autoScroll) }) : null,
          h('span', { className: 'grow' }),
          button('close', m.captureExit, () => { void close() }, { danger: true }),
          button('check', m.captureLongStop, () => { void finishLong() }, { primary: true, text: true })))
      requestAnimationFrame(() => {
        preview.width = preview.clientWidth * devicePixelRatio
        preview.height = preview.clientHeight * devicePixelRatio
        if (stitcher) stitcher.preview(preview)
      })
      return
    }
    if (phase === 'long-result' && longResult) {
      const image = h('img', { className: 'long-image', alt: m.captureLong })
      longResult.toBlob(blob => { if (blob) image.src = URL.createObjectURL(blob) }, 'image/png')
      const analyze = (kind: 'ocr' | 'translate' | 'graph'): void => { void runLong(async (png) => { await request('analyze', { kind, data: png, long: true }); await close(true) }) }
      panel.append(
        h('div', { className: 'panel-head' }, h('strong', {}, m.captureLong ?? ''), h('span', { className: 'hint' }, `${longResult.width}×${longResult.height}`)),
        h('div', { className: 'long-scroll' }, image),
        h('div', { className: 'bar-row wrap' },
          button('pin', m.capturePin, () => { void runLong(async (png) => { await request('pin', { data: png, fit: true, scale: longScale }); await close(true) }) }),
          button('ocr', m.captureOcr, () => { analyze('ocr') }),
          button('translate', m.captureTranslate, () => { analyze('translate') }),
          button('graph', m.captureGraph, () => { analyze('graph') }),
          button('forward', m.captureForwardDsh, () => { void runLong(async (png) => { await request('forward', { target: 'dsh', data: png }); setStatus(m.captureForwardSent ?? ''); await close(true) }) }),
          desktop?.share ? button('forward', m.captureForwardShare, () => { void runLong(async (png) => { await request('forward', { target: 'share', data: png }); await close(true) }) }) : null,
          button('save', m.captureSaveLocal, () => { void runLong(async (png) => { const value = await request<{ path?: string }>('image-data', { data: png }); if (value.path) await close(true); else setStatus(m.captureSaveCancelled ?? '') }) }),
          h('span', { className: 'grow' }),
          button('close', m.captureExit, () => { void close() }, { danger: true }),
          button('check', m.captureDone, () => { void runLong(async (png) => { await request('image-data', { data: png, copy: true }); await close(true) }) }, { primary: true, text: true })))
    }
  }

  // ---------- 操作 ----------
  function switchMode(next: Mode): void {
    if (busy || phase !== 'select') return
    commitText()
    mode = next; tool = undefined; popover = undefined
    if (next === 'video' && scope === 'screen') chosenScreen ??= pointerScreen()
    if (next !== 'image') marks = []
    setStatus('')
    render(); draw()
  }

  function undo(): void { marks.pop(); render(); draw() }

  /** @param force 由正在执行的操作在完成后关闭时为 true，跳过忙碌检查。 */
  async function close(force = false): Promise<void> {
    if (busy && !force) return
    stopLong()
    await request('cancel').catch(() => undefined)
    await request('close')
  }

  async function runImage(action: (png: Uint8Array) => Promise<void>): Promise<void> {
    if (busy || !selection) return
    commitText(); busy = true; popover = undefined; render()
    try { await action(await canvasPng(compose().canvas)) } catch (error) { fail(error) } finally { busy = false; render() }
  }

  async function runLong(action: (png: Uint8Array) => Promise<void>): Promise<void> {
    if (busy || !longResult) return
    busy = true; renderPanel()
    try { await action(await canvasPng(longResult)) } catch (error) { fail(error) } finally { busy = false; if (!document.hidden) renderPanel() }
  }

  async function done(): Promise<void> { await runImage(async (png) => { await request('image-data', { data: png, copy: true }); await request('close') }) }

  async function saveImage(): Promise<void> {
    await runImage(async (png) => {
      const value = await request<{ path?: string; pending?: boolean; saveError?: string }>('image-data', { data: png })
      if (value.path) { await request('close'); return }
      // 用户取消另存时丢弃临时文件，回到编辑状态。
      await request('cancel')
      setStatus(value.saveError ? (m.captureSaveFailed ?? '') + '\n' + value.saveError : m.captureSaveCancelled ?? '', value.saveError ? 'error' : 'info')
    })
  }

  async function forward(target: 'dsh' | 'share'): Promise<void> {
    await runImage(async (png) => {
      await request('forward', { target, data: png, note: forwardNote })
      setStatus(target === 'dsh' ? m.captureForwardSent ?? '' : m.captureShared ?? '')
      await request('close')
    })
  }

  async function loadWindows(): Promise<void> {
    try { windows = await request<SourceInfo[]>('sources'); render() } catch (error) { fail(error) }
  }

  // ---------- 录屏 ----------
  async function becomeCompact(operation: object): Promise<void> {
    compact = true
    document.body.setAttribute('data-compact', '')
    badge.hidden = true
    render()
    await request('compact', operation)
  }

  async function startRecording(): Promise<void> {
    if (busy) return
    let source: string | undefined, screenBox: Box | undefined, crop: Box | undefined
    if (scope === 'region') {
      const screen = selectionScreen()
      if (!screen || !selection) { setStatus(m.captureSingleScreen ?? '', 'error'); return }
      source = screen.id; screenBox = screen; crop = { ...selection }
    } else if (scope === 'screen') {
      if (!chosenScreen) return
      source = chosenScreen.id; screenBox = chosenScreen
    } else {
      if (!chosenWindow) return
      source = chosenWindow.id
    }
    const actual = recorderType(recordFormat)
    if (actual.format !== recordFormat) setStatus(`MP4 → ${actual.format.toUpperCase()}`)
    busy = true; render(); setStatus(m.capturePreparing ?? '')
    try {
      // 窗口来源需要刷新来源表，确保主进程持有最新的来源对象。
      if (scope !== 'window') await request('sources')
      await request('begin', { source, format: actual.format, audio: systemAudio && actual.format !== 'gif' })
      recorder = new ScreenRecorder({
        onTick: seconds => { const timer = document.getElementById('timer'); if (timer) timer.textContent = clock(seconds) },
        onWarning: message => { setStatus(message) },
        onEnd: result => { void recordingEnded(result) },
      })
      phase = 'recording'
      busy = false
      await becomeCompact({ recording: true })
      await recorder.start({
        source, ...(screenBox ? { screen: screenBox } : {}), ...(crop ? { crop } : {}),
        format: actual.format, quality, systemAudio, microphone, keyframes,
      }, { audioFallback: m.captureAudioFallback ?? '', micFailed: m.captureMicFailed ?? '' })
      setStatus('')
      renderPanel()
    } catch (error) {
      recorder?.release(); recorder = undefined
      await request('cancel').catch(() => undefined)
      busy = false
      if (compact) { phase = 'done'; renderPanel() } else { phase = 'select'; render() }
      fail(error)
    }
  }

  async function recordingEnded(result: { cancelled: boolean; error?: Error }): Promise<void> {
    const frames = recorder?.keyframes ?? []
    busy = true
    phase = 'recorded'
    renderPanel()
    try {
      if (result.error) { await request('cancel'); phase = 'done'; fail(result.error); return }
      if (result.cancelled) { await request('cancel'); await request('close'); return }
      setStatus(m.captureSaving ?? '')
      await request('compact', {})
      const value = await request<{ path?: string; pending?: boolean; saveError?: string }>('finish')
      saved(value)
      if (keyframes && frames.length > 0) await request('analyze', { kind: 'graph', frames: frames.map(frame => ({ data: frame.data, at: frame.at })) })
    } catch (error) { fail(error) } finally { busy = false; renderPanel() }
  }

  function saved(value: { path?: string; pending?: boolean; saveError?: string }): void {
    pendingSave = Boolean(value.pending)
    savedPath = value.path
    phase = value.path ? 'done' : 'recorded'
    setStatus(value.path ? format(m.captureSaved, { path: value.path }) : value.saveError ? (m.captureSaveFailed ?? '') + '\n' + value.saveError : m.captureSaveCancelled ?? '', value.saveError ? 'error' : 'info')
  }

  async function saveRecording(): Promise<void> {
    busy = true; renderPanel()
    try { saved(await request('save')) } catch (error) { fail(error) } finally { busy = false; renderPanel() }
  }

  // ---------- 长截图 ----------
  async function startLong(): Promise<void> {
    if (busy) return
    const screen = selectionScreen()
    if (!screen || !selection) { setStatus(m.captureSingleScreen ?? '', 'error'); return }
    commitText()
    mode = 'long'; marks = []; tool = undefined; popover = undefined
    busy = true; render()
    try {
      const value = await request<{ region: Box; display: Box }>('long-begin', { selection, source: screen.id })
      compact = true
      document.body.setAttribute('data-compact', '')
      document.body.setAttribute('data-panel', '')
      badge.hidden = true
      phase = 'long-capture'
      busy = false
      render()
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      longStream = stream
      const video = h('video', { muted: true })
      video.srcObject = stream
      await video.play()
      const scale = video.videoWidth / value.display.width
      longScale = scale
      const crop = { x: Math.round(value.region.x * scale), y: Math.round(value.region.y * scale), width: Math.round(value.region.width * scale), height: Math.round(value.region.height * scale) }
      const frame = h('canvas')
      frame.width = crop.width; frame.height = crop.height
      const context = frame.getContext('2d', { willReadFrequently: true })!
      stitcher = new LongStitcher(crop.width, crop.height)
      let idle = 0
      const sample = (): void => {
        if (!stitcher) return
        context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
        const update = stitcher.push(context.getImageData(0, 0, crop.width, crop.height))
        idle = update.added > 0 ? 0 : idle + 1
        const height = document.getElementById('long-height')
        if (height) height.textContent = format(m.captureLongHeight, { height: update.height })
        const preview = document.getElementById('long-preview') as HTMLCanvasElement | null
        if (preview && update.added > 0) stitcher.preview(preview)
        if (update.full) { setStatus(m.captureLongLimit ?? ''); void finishLong() }
        // 自动滚动连续多次没有新内容，视为到底并停止。
        if (autoScroll && idle >= 8) { toggleAutoScroll(); setStatus(m.captureLongStop ?? '') }
      }
      sample()
      longTimers.push(setInterval(sample, 150))
    } catch (error) {
      busy = false
      stopLong()
      fail(error)
    }
  }

  function toggleAutoScroll(): void {
    if (autoScroll) { clearInterval(autoScroll); autoScroll = undefined; renderPanel(); return }
    autoScroll = setInterval(() => { void request('long-scroll', { lines: 3 }).catch((error: unknown) => { toggleAutoScroll(); fail(error) }) }, 450)
    renderPanel()
  }

  function stopLong(): void {
    if (autoScroll) { clearInterval(autoScroll); autoScroll = undefined }
    for (const timer of longTimers) clearInterval(timer)
    longTimers = []
    for (const track of longStream?.getTracks() ?? []) track.stop()
    longStream = undefined
  }

  async function finishLong(): Promise<void> {
    if (phase !== 'long-capture' || !stitcher) return
    stopLong()
    if (stitcher.length === 0) { setStatus(m.captureLongEmpty ?? '', 'error'); return }
    longResult = stitcher.result()
    stitcher = undefined
    phase = 'long-result'
    await request('long-end')
    renderPanel()
  }

  // ---------- 文本编辑 ----------
  function styleEditor(): void {
    const size = fontSize(textSize)
    editor.style.fontSize = size + 'px'
    editor.style.color = color
    editor.style.borderColor = color
  }
  function commitText(): void {
    if (!editor.hidden && editor.value.trim() && textPoint) marks.push({ kind: 'text', a: textPoint, text: editor.value.replace(/\s+$/u, ''), color, size: textSize })
    editor.hidden = true; editor.value = ''; textPoint = undefined
    draw()
  }
  editor.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commitText(); render() }
    else if (event.key === 'Escape') { editor.value = ''; commitText() }
  })
  editor.addEventListener('input', () => { editor.style.height = 'auto'; editor.style.height = editor.scrollHeight + 'px' })

  // ---------- 指针 ----------
  function resizeHandle(point: Point): { x: string; y: string } | undefined {
    if (!selection) return undefined
    const box = selection
    const nearX = Math.abs(point.x - box.x) < 8 ? 'left' : Math.abs(point.x - box.x - box.width) < 8 ? 'right' : ''
    const nearY = Math.abs(point.y - box.y) < 8 ? 'top' : Math.abs(point.y - box.y - box.height) < 8 ? 'bottom' : ''
    return point.x >= box.x - 8 && point.x <= box.x + box.width + 8 && point.y >= box.y - 8 && point.y <= box.y + box.height + 8 && (nearX || nearY) ? { x: nearX, y: nearY } : undefined
  }
  function moveSelection(dx: number, dy: number): void {
    if (!selection || !desktop) return
    const before = selection
    const x = Math.max(0, Math.min(desktop.width - before.width, before.x + dx)), y = Math.max(0, Math.min(desktop.height - before.height, before.y + dy))
    const shiftX = x - before.x, shiftY = y - before.y
    const shift = (point: Point): void => { point.x += shiftX; point.y += shiftY }
    for (const mark of marks) {
      if ('a' in mark) shift(mark.a)
      if ('b' in mark) shift(mark.b)
      if ('points' in mark) mark.points.forEach(shift)
    }
    selection = { ...before, x, y }
  }
  function updateCursor(point: Point): void {
    if (!selection || tool) { surface.style.cursor = tool ? (tool === 'text' ? 'text' : 'crosshair') : 'crosshair'; return }
    const handle = resizeHandle(point)
    if (handle) {
      const diagonal = handle.x && handle.y
      surface.style.cursor = diagonal ? ((handle.x === 'left') === (handle.y === 'top') ? 'nwse-resize' : 'nesw-resize') : handle.x ? 'ew-resize' : 'ns-resize'
    } else surface.style.cursor = inside(point, selection) ? 'move' : 'crosshair'
  }
  const regionMode = (): boolean => mode === 'image' || mode === 'long' || (mode === 'video' && scope === 'region')

  surface.addEventListener('pointerdown', event => {
    if (busy || compact || !desktop || event.button !== 0 || phase !== 'select') return
    if (popover) { popover = undefined; render() }
    if (!regionMode()) return
    commitText()
    const point = position(event), handle = resizeHandle(point)
    if (selection && tool && mode === 'image' && inside(point, selection)) {
      if (tool === 'text') {
        textPoint = point
        editor.style.left = point.x + 'px'; editor.style.top = point.y + 'px'
        styleEditor(); editor.hidden = false; editor.focus()
        return
      }
      if (tool === 'number') {
        marks.push({ kind: 'number', a: point, n: marks.filter(mark => mark.kind === 'number').length + 1, color, size: textSize })
        render(); draw(); return
      }
      const base = { color, size: tool === 'mosaic' ? strokeWidth() * 5 : strokeWidth() }
      drag = { mark: tool === 'pen' ? { ...base, kind: 'pen', points: [point] }
        : tool === 'mosaic' ? { ...base, kind: 'mosaic', points: [point], block: mosaicBlock }
        : { ...base, kind: tool, a: point, b: point } }
    } else if (handle && !tool) drag = { resize: handle, original: { ...selection! } }
    else if (selection && !tool && inside(point, selection)) drag = { move: point }
    else if (!selection || !tool) { marks = []; selection = area(point, point); drag = { origin: point }; mosaicCache = undefined }
    else return
    surface.setPointerCapture(event.pointerId)
    draw()
  })
  surface.addEventListener('pointermove', event => {
    const point = position(event)
    if (!drag) { if (!compact && regionMode()) updateCursor(point); return }
    if (drag.origin) selection = area(drag.origin, point)
    else if (drag.move) { moveSelection(point.x - drag.move.x, point.y - drag.move.y); drag.move = point }
    else if (drag.mark) {
      const mark = drag.mark
      if (mark.kind === 'pen' || mark.kind === 'mosaic') mark.points.push(point)
      else if ('b' in mark) mark.b = event.shiftKey ? constrain(mark.kind, mark.a, point) : point
    } else if (drag.resize && drag.original) {
      const box = drag.original
      const a = { x: drag.resize.x === 'left' ? point.x : box.x, y: drag.resize.y === 'top' ? point.y : box.y }
      const b = { x: drag.resize.x === 'right' ? point.x : box.x + box.width, y: drag.resize.y === 'bottom' ? point.y : box.y + box.height }
      selection = area(a, b)
    }
    if (drag.origin || drag.move || drag.resize) mosaicCache = undefined
    draw()
  })
  surface.addEventListener('pointerup', event => {
    if (!drag) return
    if (drag.mark) {
      const mark = drag.mark
      const tiny = 'b' in mark && Math.hypot(mark.b.x - mark.a.x, mark.b.y - mark.a.y) < 3
      if (!tiny) marks.push(mark)
    }
    const created = Boolean(drag.origin)
    drag = undefined
    surface.releasePointerCapture(event.pointerId)
    if (selection && (selection.width < 4 || selection.height < 4)) selection = undefined
    if (created && selection && mode === 'video') scope = 'region'
    render(); draw()
  })
  surface.addEventListener('dblclick', () => { if (mode === 'image' && selection && !tool) void done() })

  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur()
      return
    }
    const primary = event.ctrlKey || event.metaKey
    if (event.key === 'Escape') {
      event.preventDefault()
      if (popover) { popover = undefined; render(); return }
      if (phase === 'recording') { recorder?.stop(true); return }
      if (tool && mode === 'image') { tool = undefined; render(); draw(); return }
      void close().catch(fail)
      return
    }
    if (phase === 'recording') {
      if (event.code === 'Space') { event.preventDefault(); recorder?.togglePause(); renderPanel() }
      else if (event.key === 'Enter') { event.preventDefault(); recorder?.stop() }
      return
    }
    if (phase === 'long-result' && event.key === 'Enter') { event.preventDefault(); void runLong(async (png) => { await request('image-data', { data: png, copy: true }); await close(true) }); return }
    if (phase === 'long-capture' && event.key === 'Enter') { event.preventDefault(); void finishLong(); return }
    if (compact || mode !== 'image' || !selection) return
    if (primary && event.key.toLowerCase() === 'z') { event.preventDefault(); undo() }
    else if (primary && event.key.toLowerCase() === 's') { event.preventDefault(); void saveImage() }
    else if (primary && event.key.toLowerCase() === 'c') { event.preventDefault(); void done() }
    else if (event.key === 'Enter') { event.preventDefault(); void done() }
  })
  window.addEventListener('beforeunload', () => { recorder?.release(); stopLong() })
  window.addEventListener('resize', () => { if (!compact) placeBar() })

  // ---------- 启动 ----------
  try {
    desktop = await request<DesktopInfo>('desktop')
    screens = await Promise.all(desktop.images.map(async item => {
      const bitmap = new Image(); bitmap.src = item.image; await bitmap.decode()
      return { id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, scaleFactor: item.scaleFactor, bitmap }
    }))
    recordFormat = desktop.recording.format
    quality = desktop.recording.quality
    systemAudio = desktop.recording.systemAudio
    microphone = desktop.recording.microphone
    keyframes = desktop.recording.knowledgeGraph
    surface.width = desktop.width; surface.height = desktop.height
    surface.style.width = desktop.width + 'px'; surface.style.height = desktop.height + 'px'
    if (mode === 'video') chosenScreen = pointerScreen()
    render(); draw()
    void request<{ state: string }>('vision-status').then(value => { vision = value.state; if (mode === 'image') render() }, () => undefined)
  } catch (error) {
    compact = true; phase = 'done'
    document.body.setAttribute('data-compact', '')
    render(); fail(error)
    await request('compact', {}).catch(() => undefined)
  }
  await request('ready')
})()
