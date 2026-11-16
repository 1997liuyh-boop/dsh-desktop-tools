const api = window.dshDesktop

void (async () => {
  let { messages, id: locale } = await api.locale()
  const bar = document.getElementById('bar')
  const ids = ['search', 'translate', 'note', 'wechat', 'explain', 'send-to-agent']
  const keys = {
    search: 'selectionToolbarSearch', translate: 'selectionToolbarTranslate', note: 'selectionToolbarNote',
    wechat: 'selectionToolbarWechat', explain: 'selectionToolbarExplain', 'send-to-agent': 'selectionToolbarSendToAgent',
  }
  // 内置按钮保留在页面里，只按配置调整顺序和显示；自定义动作按需创建。
  const builtins = new Map(ids.map(id => [id, document.getElementById(id)]))
  /** 按当前语言设置内置按钮文案；DSH 切换语言后重新调用。 */
  const applyLocale = () => {
    document.documentElement.lang = locale ?? 'en'
    for (const id of ids) builtins.get(id).textContent = messages[keys[id]]
  }
  applyLocale()
  api.onLocaleChanged?.(() => {
    void api.locale().then(next => { messages = next.messages; locale = next.id; applyLocale() })
  })
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
