/** 验证菜单层级、开关回调及输入框编辑菜单。 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { MenuItemConstructorOptions } from 'electron'
import { floatingContextMenuTemplate, type FloatingMenuActions } from './floating-context-menu.ts'
import { zh } from './locale.ts'

const plain = { isEditable: false, editFlags: { canCut: false, canCopy: false, canPaste: true } }
const noop = (): void => {}

function actions(overrides: Partial<FloatingMenuActions> = {}): FloatingMenuActions {
  return { capture: noop, wechat: noop, disableSelection: noop, disableFloating: noop, disableCapture: noop,
    selectionEnabled: () => true, captureEnabled: () => true, wechatEnabled: () => true, ...overrides }
}

function submenu(item: MenuItemConstructorOptions): MenuItemConstructorOptions[] {
  assert.ok(Array.isArray(item.submenu))
  return item.submenu
}

test('菜单按三组排列，Agent 设置嵌套两类设置，取消不执行关闭操作', () => {
  const menu = floatingContextMenuTemplate(plain, zh, noop, actions())
  assert.deepEqual(menu.map(item => item.label ?? item.type), [
    '截图 / 屏幕录制', '公众号解读', 'separator', '打开主窗口', 'separator',
    'Agent 设置', '基础设置', 'separator', '取消',
  ])
  assert.deepEqual(submenu(menu[5]).map(item => item.label), ['悬浮球 设置', '划词工具 设置'])
  assert.deepEqual(submenu(menu[6]).map(item => item.label), ['关闭划词', '关闭悬浮球', '关闭截图 / 屏幕录制'])
  assert.equal(menu.at(-1)?.click, undefined)
  assert.equal(menu.some(item => item.label === '退出'), false)
})

test('快捷入口与关闭操作绑定各自回调，未启用的功能禁用对应操作', () => {
  const calls: string[] = []
  const menu = floatingContextMenuTemplate(plain, zh, () => { calls.push('main') }, actions({
    capture: () => { calls.push('capture') }, wechat: () => { calls.push('wechat') },
    disableSelection: () => { calls.push('selection-off') }, disableFloating: () => { calls.push('ball-off') },
    disableCapture: () => { calls.push('capture-off') },
  }))
  for (const item of [menu[0], menu[1], menu[3], ...submenu(menu[6])]) item.click?.(null!, null!, null!)
  assert.deepEqual(calls, ['capture', 'wechat', 'main', 'selection-off', 'ball-off', 'capture-off'])
  const disabled = floatingContextMenuTemplate(plain, zh, noop, actions({ selectionEnabled: () => false, captureEnabled: () => false }))
  assert.equal(disabled[0].enabled, false)
  assert.equal(submenu(disabled[6])[0].enabled, false)
  assert.equal(submenu(disabled[6])[2].enabled, false)
  assert.equal(disabled[1].enabled, true)
})

test('模型不可用时仍可选择跟随主窗口，输入框保留剪切复制粘贴', () => {
  let selected: unknown = 'unchanged'
  const model = { provider: 'test', model: 'test' }
  const menu = floatingContextMenuTemplate({ ...plain, isEditable: true }, zh, noop, actions(), {
    catalog: undefined, overlay: model, background: model, selection: model, backgroundSupported: false,
    onSelectOverlay: noop, onSelectBackground: noop, onSelectSelection: value => { selected = value },
  })
  assert.deepEqual(menu.slice(0, 3).map(item => [item.role, item.enabled]), [['cut', false], ['copy', false], ['paste', true]])
  const settings = submenu(menu.find(item => item.label === 'Agent 设置')!)
  assert.equal(submenu(settings[0])[0].enabled, false)
  submenu(settings[1])[0].click?.(null!, null!, null!)
  assert.equal(selected, undefined)
})
