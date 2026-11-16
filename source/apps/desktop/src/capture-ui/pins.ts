/** 钉图管理窗：缩略图列表，可定位、显示/隐藏、复制、保存、提问和关闭，顶部可批量显示、隐藏、关闭。 */
import { byId, followTheme, h, request, type Messages } from './dom.ts'
import { icons, type IconName } from './icons.ts'

interface PinSummary { id: string; createdAt: number; hidden: boolean; width: number; height: number; thumb: string }

void (async () => {
  followTheme()
  const { messages: m, id: locale } = await window.dshDesktop.locale() as { id: string; messages: Messages }
  document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : locale
  document.title = m.capturePinsTitle ?? ''
  const root = byId('app')
  let pins = await request<PinSummary[]>('pins-init')

  function button(icon: IconName, label: string | undefined, onClick: () => void, options: { primary?: boolean; disabled?: boolean; text?: boolean } = {}): HTMLButtonElement {
    const element = h('button', {
      type: 'button', className: ['tool', options.primary ? 'primary' : '', options.text === false ? '' : 'with-text'].filter(Boolean).join(' '),
      title: label, 'aria-label': label, disabled: options.disabled, onclick: onClick,
    })
    element.innerHTML = icons[icon] + (options.text === false ? '' : `<span>${label ?? ''}</span>`)
    return element
  }

  async function act(operation: string, input?: object): Promise<void> {
    try { await request(operation, input) } catch (error) {
      const note = document.getElementById('note')
      if (note) { note.textContent = error instanceof Error ? error.message : String(error); note.dataset.tone = 'error' }
    }
  }

  function card(pin: PinSummary): HTMLElement {
    const time = new Date(pin.createdAt).toLocaleString(document.documentElement.lang)
    const image = h('img', { className: 'pin-thumb', src: pin.thumb, alt: time, title: m.capturePinsLocate })
    image.addEventListener('click', () => { void act('pins-focus', { id: pin.id }) })
    return h('article', { className: pin.hidden ? 'pin-card is-hidden' : 'pin-card' },
      image,
      h('div', { className: 'muted' }, `${time} · ${pin.width}×${pin.height}${pin.hidden ? ` · ${m.capturePinsHide ?? ''}` : ''}`),
      h('div', { className: 'pin-actions' },
        button(pin.hidden ? 'eye' : 'eyeOff', pin.hidden ? m.capturePinsShow : m.capturePinsHide, () => { void act('pins-toggle', { id: pin.id }) }, { text: false }),
        button('check', m.capturePinsCopy, () => { void act('pins-copy', { id: pin.id }) }, { text: false }),
        button('save', m.capturePinsSave, () => { void act('pins-save', { id: pin.id }) }, { text: false }),
        button('ask', m.capturePinAsk, () => { void act('pins-ask', { id: pin.id }) }, { text: false }),
        h('span', { className: 'grow' }),
        button('close', m.capturePinClose, () => { void act('pins-close', { id: pin.id }) }, { text: false })))
  }

  function render(): void {
    const empty = pins.length === 0
    root.replaceChildren(
      h('header', { className: 'head' },
        h('strong', {}, `${m.capturePinsTitle ?? ''}${empty ? '' : ` · ${pins.length}`}`), h('span', { className: 'grow' }),
        button('close', m.capturePinClose, () => { void act('pins-window-close') }, { text: false })),
      h('main', { className: 'body' }, empty
        ? h('div', { className: 'placeholder' }, m.capturePinsEmpty ?? '')
        : h('div', { className: 'pin-grid' }, ...pins.map(card))),
      h('footer', { className: 'actions' },
        button('eye', m.capturePinsShowAll, () => { void act('pins-show-all') }, { disabled: empty }),
        button('eyeOff', m.capturePinsHideAll, () => { void act('pins-hide-all') }, { disabled: empty }),
        h('span', { className: 'grow' }),
        h('span', { id: 'note', className: 'note', role: 'status' }),
        button('close', m.capturePinsCloseAll, () => { void act('pins-close-all') }, { disabled: empty })))
  }

  window.dshDesktop.capture.onEvent(event => {
    if (typeof event !== 'object' || event === null || !('type' in event) || event.type !== 'pins-changed' || !('pins' in event)) return
    pins = event.pins as PinSummary[]
    render()
  })
  window.addEventListener('keydown', event => { if (event.key === 'Escape') void act('pins-window-close') })
  render()
})()
