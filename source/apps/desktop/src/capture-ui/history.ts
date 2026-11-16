/** 截图历史窗：按时间倒序列出截图、识别结果与录屏，可复制、提问、钉到桌面、打开所在文件夹、删除，以及全部清空。 */
import { byId, followTheme, h, request, type Messages } from './dom.ts'
import { icons, type IconName } from './icons.ts'

type Kind = 'image' | 'long' | 'recording' | 'ocr' | 'translate' | 'graph' | 'ask'
interface HistoryItem {
  id: string
  createdAt: number
  kind: Kind
  image: boolean
  width?: number
  height?: number
  text?: string
  question?: string
  file?: string
  thumb: string
}

void (async () => {
  followTheme()
  const { messages: m, id: locale } = await window.dshDesktop.locale() as { id: string; messages: Messages }
  document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : locale
  document.title = m.captureHistoryTitle ?? ''
  const root = byId('app')
  const initial = await request<{ entries: HistoryItem[]; enabled: boolean; directory: string }>('history-init')
  let entries = initial.entries
  let enabled = initial.enabled

  const kindLabel: Record<Kind, string | undefined> = {
    image: m.captureHistoryKindImage, long: m.captureLong, recording: m.captureVideo, ocr: m.captureOcr,
    translate: m.captureTranslate, graph: m.captureGraph, ask: m.captureAsk,
  }

  function button(icon: IconName, label: string | undefined, onClick: () => void, options: { primary?: boolean; disabled?: boolean; text?: boolean } = {}): HTMLButtonElement {
    const element = h('button', {
      type: 'button', className: ['tool', options.primary ? 'primary' : '', options.text === false ? '' : 'with-text'].filter(Boolean).join(' '),
      title: label, 'aria-label': label, disabled: options.disabled, onclick: onClick,
    })
    element.innerHTML = icons[icon] + (options.text === false ? '' : `<span>${label ?? ''}</span>`)
    return element
  }

  async function act(operation: string, input?: object, done?: string): Promise<void> {
    const note = document.getElementById('note')
    try {
      await request(operation, input)
      if (note && done) { note.textContent = done; note.dataset.tone = '' }
    } catch (error) {
      if (note) { note.textContent = error instanceof Error ? error.message : String(error); note.dataset.tone = 'error' }
    }
  }

  function card(item: HistoryItem): HTMLElement {
    const time = new Date(item.createdAt).toLocaleString(document.documentElement.lang)
    const preview = item.image && item.thumb
      ? h('img', { className: 'pin-thumb', src: item.thumb, alt: time })
      : h('div', { className: 'pin-thumb history-placeholder', html: icons[item.kind === 'recording' ? 'video' : 'ocr'] })
    const summary = (item.question ? `${item.question} — ` : '') + (item.text ?? (item.file ?? ''))
    return h('article', { className: 'pin-card' },
      preview,
      h('div', { className: 'muted' }, `${kindLabel[item.kind] ?? item.kind} · ${time}${item.width ? ` · ${item.width}×${item.height ?? ''}` : ''}`),
      summary.trim() === '' ? null : h('p', { className: 'history-text', title: summary }, summary),
      h('div', { className: 'pin-actions' },
        item.image ? button('check', m.captureHistoryCopyImage, () => { void act('history-copy-image', { id: item.id }, m.captureHistoryCopied) }, { text: false }) : null,
        item.text ? button('lines', m.captureHistoryCopyText, () => { void act('history-copy-text', { id: item.id }, m.captureHistoryCopied) }, { text: false }) : null,
        item.image ? button('ask', m.captureAsk, () => { void act('history-ask', { id: item.id }) }, { text: false }) : null,
        item.image ? button('pin', m.capturePin, () => { void act('history-pin', { id: item.id }) }, { text: false }) : null,
        item.file ? button('folder', m.captureHistoryReveal, () => { void act('history-reveal', { id: item.id }) }, { text: false }) : null,
        h('span', { className: 'grow' }),
        button('close', m.captureHistoryDelete, () => { void act('history-delete', { id: item.id }) }, { text: false })))
  }

  function render(): void {
    const empty = entries.length === 0
    root.replaceChildren(
      h('header', { className: 'head' },
        h('strong', {}, `${m.captureHistoryTitle ?? ''}${empty ? '' : ` · ${entries.length}`}`), h('span', { className: 'grow' }),
        button('close', m.capturePinClose, () => { void act('history-window-close') }, { text: false })),
      h('main', { className: 'body' },
        h('p', { className: 'note history-notice' }, (enabled ? m.captureHistoryNotice : m.captureHistoryDisabled ?? '')?.replace('{path}', initial.directory) ?? ''),
        empty ? h('div', { className: 'placeholder' }, m.captureHistoryEmpty ?? '') : h('div', { className: 'pin-grid' }, ...entries.map(card))),
      h('footer', { className: 'actions' },
        h('span', { id: 'note', className: 'note', role: 'status' }),
        h('span', { className: 'grow' }),
        button('close', m.captureHistoryClear, () => {
          if (window.confirm(m.captureHistoryClearConfirm ?? '')) void act('history-clear')
        }, { disabled: empty })))
  }

  window.dshDesktop.capture.onEvent(event => {
    if (typeof event !== 'object' || event === null || !('type' in event) || event.type !== 'history-changed' || !('entries' in event)) return
    entries = event.entries as HistoryItem[]
    const first = entries[0] as (HistoryItem & { enabled?: boolean }) | undefined
    if (typeof first?.enabled === 'boolean') enabled = first.enabled
    render()
  })
  window.addEventListener('keydown', event => { if (event.key === 'Escape') void act('history-window-close') })
  render()
})()
