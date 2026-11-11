/** 截图识别结果窗口：提取文字（可编辑）、翻译与知识图谱（Mermaid 渲染）。 */
import { byId, canvasPng, followTheme, format, h, request, type Messages } from './dom.ts'
import { icons, type IconName } from './icons.ts'

type Kind = 'ocr' | 'translate' | 'graph'
interface TaskState { phase: 'thinking' | 'streaming' | 'done' | 'error' | 'stopped'; text: string; model?: string; error?: string }
interface ResultState {
  kind: Kind
  phase: 'vision' | 'ocr' | 'ready' | 'task' | 'error'
  text: string
  language: string
  long: boolean
  frames: number
  error?: string
  vision?: { state: 'ready' | 'missing' | 'disabled' | 'tool-off' | 'unknown' }
  task?: TaskState
  preview: string
}

declare global {
  interface Window {
    DshMarkdown?: { renderMarkdown(text: string): string }
    mermaid?: {
      initialize(config: object): void
      render(id: string, text: string): Promise<{ svg: string }>
    }
  }
}

void (async () => {
  followTheme()
  const { messages: m, id: locale } = await window.dshDesktop.locale() as { id: string; messages: Messages }
  document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : locale
  const root = byId('app')
  let state = await request<ResultState>('result-init')
  let installing = false
  let installNote = ''
  let editedText: string | undefined
  let renderedGraph = ''
  let graphHtml = ''
  let graphRevision = 0

  const titleOf = (kind: Kind): string => (kind === 'ocr' ? m.captureResultOcr : kind === 'translate' ? m.captureResultTranslate : m.captureResultGraph) ?? ''

  function button(icon: IconName, label: string | undefined, onClick: () => void, options: { primary?: boolean; disabled?: boolean; text?: boolean } = {}): HTMLButtonElement {
    const element = h('button', {
      type: 'button', className: ['tool', options.primary ? 'primary' : '', options.text === false ? '' : 'with-text'].filter(Boolean).join(' '),
      title: label, 'aria-label': label, disabled: options.disabled, onclick: onClick,
    })
    element.innerHTML = icons[icon] + (options.text === false ? '' : `<span>${label ?? ''}</span>`)
    return element
  }

  function spinner(text: string | undefined): HTMLElement {
    return h('div', { className: 'placeholder', role: 'status' }, h('span', { className: 'spinner', 'aria-hidden': 'true' }), h('span', {}, text ?? ''))
  }

  function outputText(): string {
    if (state.kind === 'ocr') return editedText ?? state.text
    return state.task?.text ?? ''
  }

  async function act(operation: string, input?: object): Promise<void> {
    try { await request(operation, input) } catch (error) { showError(error) }
  }
  function showError(error: unknown): void {
    const note = document.getElementById('note')
    if (note) { note.textContent = error instanceof Error ? error.message : String(error); note.dataset.tone = 'error' }
  }

  function visionPanel(): HTMLElement {
    const vision = state.vision?.state ?? 'unknown'
    const message = vision === 'tool-off' ? m.captureVisionToolOff : m.captureVisionRequired
    const action = vision === 'disabled' ? m.captureVisionEnable : m.captureVisionInstall
    return h('div', { className: 'vision' },
      h('p', {}, message ?? ''),
      h('p', { className: 'muted' }, 'npm: dsh-vision-router · dsh plugin add dsh-vision-router'),
      vision === 'tool-off' ? null : button('save', installing ? m.captureVisionInstalling : action, () => {
        installing = true; installNote = ''; render()
        void request<{ restartRequired: boolean }>('result-install-vision').then(value => {
          installing = false
          installNote = value.restartRequired ? m.captureVisionRestart ?? '' : ''
          render()
        }, error => { installing = false; render(); showError(error) })
      }, { primary: true, disabled: installing }),
      installNote ? h('p', { className: 'note' }, installNote) : null,
      button('undo', m.captureRetry, () => { void act('result-retry') }))
  }

  /** 把 Markdown 中的 mermaid 代码块渲染成 SVG；失败时保留源码并提示。 */
  async function renderMermaid(container: HTMLElement, revision: number): Promise<void> {
    const blocks = [...container.querySelectorAll<HTMLElement>('pre > code.language-mermaid')]
    if (blocks.length === 0 || !window.mermaid) return
    const dark = document.body.hasAttribute('data-ds-dark-theme')
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', flowchart: { htmlLabels: false } })
    for (const [index, block] of blocks.entries()) {
      try {
        const { svg } = await window.mermaid.render(`graph-${revision}-${index}`, block.textContent ?? '')
        if (revision !== graphRevision) return
        const figure = h('figure', { className: 'graph', html: svg })
        block.parentElement?.replaceWith(figure)
      } catch {
        block.parentElement?.before(h('p', { className: 'note' }, m.captureGraphRenderFailed ?? ''))
      }
    }
    // 之后的重绘直接复用已渲染的关系图，避免重复渲染。
    if (revision === graphRevision) graphHtml = container.innerHTML
  }

  async function exportGraph(): Promise<void> {
    const svg = document.querySelector<SVGSVGElement>('figure.graph svg')
    if (!svg) return
    const box = svg.getBoundingClientRect()
    const markup = new XMLSerializer().serializeToString(svg)
    const image = new Image()
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
    await image.decode()
    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = Math.round(box.width * scale); canvas.height = Math.round(box.height * scale)
    const context = canvas.getContext('2d')!
    context.fillStyle = getComputedStyle(document.body).backgroundColor || '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    await act('result-save-png', { data: await canvasPng(canvas) })
  }

  function body(): HTMLElement {
    if (state.phase === 'vision') return spinner(m.captureVisionChecking)
    if (state.phase === 'ocr') return spinner(state.frames > 1 ? `${m.captureOcrRunning ?? ''} ${format(m.captureFrames, { count: state.frames })}` : m.captureOcrRunning)
    if (state.phase === 'error') {
      if (state.vision && state.vision.state !== 'ready') return visionPanel()
      return h('div', { className: 'vision' }, h('p', { className: 'error' }, state.error ?? m.captureFailed ?? ''), button('undo', m.captureRetry, () => { void act('result-retry') }, { primary: true }))
    }
    if (state.kind === 'ocr') {
      const area = h('textarea', { className: 'editor', spellcheck: 'false', 'aria-label': m.captureResultOcr })
      area.value = editedText ?? state.text
      area.addEventListener('input', () => { editedText = area.value })
      area.addEventListener('change', () => { void act('result-text', { text: area.value }) })
      return h('div', { className: 'column' }, state.preview ? h('img', { className: 'preview', src: state.preview, alt: '' }) : null, area)
    }
    const task = state.task
    if (!task || (task.phase === 'thinking' && task.text === '')) return spinner(m.captureThinking)
    const content = h('div', { className: 'markdown' })
    const cached = state.kind === 'graph' && task.phase === 'done' && renderedGraph === task.text && graphHtml !== ''
    content.innerHTML = cached ? graphHtml : window.DshMarkdown?.renderMarkdown(task.text) ?? ''
    if (task.phase === 'done' && state.kind === 'graph' && renderedGraph !== task.text) {
      renderedGraph = task.text
      graphHtml = ''
      graphRevision += 1
      void renderMermaid(content, graphRevision)
    }
    return h('div', { className: 'column' },
      task.phase === 'error' ? h('p', { className: 'error' }, task.error ?? m.captureFailed ?? '') : null,
      content,
      h('details', { className: 'source' }, h('summary', {}, m.captureResultOcr ?? ''), h('pre', {}, state.text)))
  }

  function actions(): HTMLElement {
    const running = state.phase === 'task' && (state.task?.phase === 'thinking' || state.task?.phase === 'streaming')
    const ready = state.phase === 'ready' || (state.phase === 'task' && !running)
    const language = h('input', { className: 'language', value: state.language, 'aria-label': m.captureTargetLanguage, title: m.captureTargetLanguage, size: '6' })
    const items: (HTMLElement | null)[] = [
      button('check', m.captureCopy, () => { void act('result-copy', { text: outputText() }) }, { disabled: outputText() === '' }),
      button('save', m.captureSaveLocal, () => { void act('result-save', { text: outputText() }) }, { disabled: outputText() === '' }),
    ]
    if (state.kind === 'graph' && state.task?.phase === 'done') items.push(button('screenshot', m.captureExportPng, () => { void exportGraph().catch(showError) }))
    if (state.kind === 'ocr' && state.phase === 'ready' || state.kind === 'translate' && ready) {
      items.push(h('span', { className: 'divider' }), language,
        button('translate', m.captureTranslate, () => {
          if (editedText !== undefined) void act('result-text', { text: editedText })
          void act('result-run', { kind: 'translate', language: language.value })
        }, { disabled: running }))
    }
    if (state.kind === 'ocr' && state.phase === 'ready') items.push(button('graph', m.captureGraph, () => {
      if (editedText !== undefined) void act('result-text', { text: editedText })
      void act('result-run', { kind: 'graph' })
    }))
    if (running) items.push(button('stop', m.captureStop, () => { void act('result-stop') }))
    else if (state.phase === 'task') items.push(button('undo', m.captureRetry, () => { void act('result-run', { kind: state.kind, language: language.value }) }))
    if (state.phase === 'task') items.push(button('forward', m.captureOpenDsh, () => { void act('result-open-main') }))
    return h('footer', { className: 'actions' }, ...items, h('span', { className: 'grow' }), h('span', { id: 'note', className: 'note', role: 'status' }))
  }

  function render(): void {
    document.title = titleOf(state.kind)
    const model = state.task?.model ? h('span', { className: 'muted' }, state.task.model) : null
    root.replaceChildren(
      h('header', { className: 'head' },
        h('strong', {}, titleOf(state.kind)), model, h('span', { className: 'grow' }),
        button('screenshot', m.captureMaximize, () => { void act('result-maximize') }, { text: false }),
        button('close', m.capturePinClose, () => { void act('result-close') }, { text: false })),
      h('main', { className: 'body' }, body()),
      actions())
  }

  window.dshDesktop.capture.onEvent(event => {
    if (typeof event !== 'object' || event === null || !('kind' in event)) return
    const next = event as ResultState
    // 用户在提取文字视图里的未保存修改，在识别重跑之前保留。
    if (next.phase !== 'ready') editedText = undefined
    state = next
    render()
  })
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !(event.target instanceof HTMLTextAreaElement)) void act('result-close') })
  render()
})()
