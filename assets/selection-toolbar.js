const api = window.dshDesktop

void (async () => {
  const { messages, locale } = await api.locale()
  document.documentElement.lang = locale?.startsWith('zh') ? 'zh-CN' : 'en'
  const bar = document.getElementById('bar')
  const labels = {
    search: messages.selectionToolbarSearch,
    translate: messages.selectionToolbarTranslate,
    note: messages.selectionToolbarNote,
    wechat: messages.selectionToolbarWechat,
    explain: messages.selectionToolbarExplain,
    'send-to-agent': messages.selectionToolbarSendToAgent,
  }
  // 内置按钮保留在页面里，只按配置调整顺序和显示；自定义动作按需创建。
  const builtins = new Map(Object.keys(labels).map(id => [id, document.getElementById(id)]))
  for (const [id, label] of Object.entries(labels)) builtins.get(id).textContent = label
  const report = error => {
    bar.title = messages.selectionFailed
    console.warn('Selection toolbar action failed', error)
  }
  const run = id => {
    if (id === 'search') return api.selection.search()
    if (id === 'send-to-agent') return api.selection.sendToAgent()
    return api.selection.action(id)
  }
  bar.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button[data-item]') : null
    if (button) void run(button.dataset.item).catch(report)
  })
  for (const [id, button] of builtins) button.dataset.item = id
  document.addEventListener('pointerdown', () => { void api.selection.interact().catch(report) })

  /** 按辅助进程下发的顺序重建按钮；items 为空数组时整条工具栏为空。 */
  const render = items => {
    if (!Array.isArray(items)) return
    for (const button of builtins.values()) button.hidden = true
    for (const button of bar.querySelectorAll('button[data-custom]')) button.remove()
    for (const item of items) {
      if (typeof item?.id !== 'string') continue
      let button = builtins.get(item.id)
      if (button === undefined) {
        if (!item.id.startsWith('custom:') || typeof item.label !== 'string') continue
        button = document.createElement('button')
        button.type = 'button'
        button.dataset.item = item.id
        button.dataset.custom = ''
        button.textContent = item.label
      }
      button.hidden = false
      bar.append(button)
    }
  }
  const syncSize = () => {
    const rect = bar.getBoundingClientRect()
    void api.selection.setContentSize({ width: Math.ceil(rect.width + 12), height: Math.ceil(rect.height + 12) }).catch(report)
  }
  api.selection.onState(state => { render(state?.items); syncSize() })
  render(await api.selection.items().catch(error => { report(error); return [...builtins.keys()].map(id => ({ id })) }))
  new ResizeObserver(syncSize).observe(bar)
  syncSize()
})()
