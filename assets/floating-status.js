/* 任务标题仅作为文本显示，禁止把会话内容插入 HTML。 */
const api = window.dshDesktop
function render(view) {
  if (!view?.task) return
  const { task, labels, today } = view
  document.documentElement.lang = /[\u4e00-\u9fff]/u.test(labels.open) ? 'zh-CN' : 'en'
  document.querySelector('#state').textContent = labels[task.state] ?? task.state
  document.querySelector('#title').textContent = task.title
  document.querySelector('#cost').textContent = `${labels.cost} ¥${(today?.cost ?? 0).toFixed(4)}${today?.unpriced ? ' + ?' : ''}`
  document.querySelector('#open').setAttribute('aria-label', `${labels.open}: ${task.title}`)
  document.querySelector('#dismiss').setAttribute('aria-label', labels.dismiss)
}
api.floating.onWidgetState(render)
void api.floating.widgetState().then(render)
document.querySelector('#open').addEventListener('click', () => { void api.floating.openWidget() })
document.querySelector('#dismiss').addEventListener('click', () => { void api.floating.openWidget('dismiss') })
