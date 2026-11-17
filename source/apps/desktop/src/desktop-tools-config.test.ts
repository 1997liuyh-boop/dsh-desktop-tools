/** 桌面工具统一配置的默认值、校验和持久化测试。 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  defaultDesktopToolsConfig,
  isDesktopAccelerator,
  parseDesktopToolsConfig,
  readDesktopToolsConfig,
  writeDesktopToolsConfig,
} from './desktop-tools-config.ts'

test('默认配置按用户确认的功能启用状态和平台坐标提供', () => {
  const windows = defaultDesktopToolsConfig('win32')
  const macos = defaultDesktopToolsConfig('darwin')

  assert.equal(windows.selection.enabled, true)
  assert.equal(windows.floatingBall.enabled, true)
  assert.equal(windows.screenshot.enabled, false)
  assert.equal(windows.recording.enabled, false)
  assert.equal(windows.floatingBall.coordinateMode, 'millifraction')
  assert.equal(macos.floatingBall.coordinateMode, 'pixel')
})

test('旧配置补齐交互和记账默认值，拒绝无效单价与吸附距离', () => {
  const config = defaultDesktopToolsConfig()
  const { edgeSnap, snapDistance, taskBubbles, completionNotifications, ...legacyBall } = config.floatingBall
  const { accounting, ...legacy } = config
  const parsed = parseDesktopToolsConfig({ ...legacy, floatingBall: legacyBall })
  assert.equal(parsed.floatingBall.edgeSnap, true)
  assert.equal(parsed.floatingBall.snapDistance, 24)
  assert.deepEqual(parsed.accounting.rates, [])
  assert.throws(() => parseDesktopToolsConfig({ ...config, floatingBall: { ...config.floatingBall, snapDistance: Infinity } }))
  assert.throws(() => parseDesktopToolsConfig({ ...config, accounting: { ...config.accounting, rates: [{ model: 'a', provider: 'b', input: -1 }] } }))
})

test('解析拒绝缺失字段和无效功能配置值', () => {
  const config = defaultDesktopToolsConfig('win32')

  assert.throws(() => parseDesktopToolsConfig({ ...config, screenshot: {} }), /必须为布尔值/u)
  assert.throws(() => parseDesktopToolsConfig({ ...config, floatingBall: { ...config.floatingBall, coordinateMode: 'screen' } }), /坐标模式无效/u)
  assert.throws(() => parseDesktopToolsConfig({ ...config, selection: { ...config.selection, targetLanguage: ' ' } }), /目标语言无效/u)
})

test('配置文件原子写入后可回读完整值，损坏文件不会静默重置', () => {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-desktop-tools-'))
  try {
    const config = defaultDesktopToolsConfig('win32')
    const changed = { ...config, screenshot: { ...config.screenshot, enabled: true } }
    writeDesktopToolsConfig(profile, changed)
    assert.deepEqual(readDesktopToolsConfig(profile), changed)
    assert.match(readFileSync(join(profile, 'desktop-tools.json'), 'utf8'), /"screenshot"/u)

    writeFileSync(join(profile, 'desktop-tools.json'), '{broken')
    assert.throws(() => readDesktopToolsConfig(profile), /无法读取桌面工具配置/u)
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
})

test('0.3.x 旧配置缺少截图录屏新字段时回落默认值', () => {
  const config = defaultDesktopToolsConfig('win32')
  const legacy = { ...config, screenshot: { enabled: true }, recording: { enabled: false } }
  const parsed = parseDesktopToolsConfig(legacy)

  assert.equal(parsed.screenshot.enabled, true)
  assert.equal(parsed.screenshot.shortcut, 'CommandOrControl+Shift+S')
  assert.equal(parsed.screenshot.longShortcut, '')
  assert.equal(parsed.recording.shortcut, 'CommandOrControl+Shift+R')
  assert.equal(parsed.recording.format, 'mp4')
  assert.equal(parsed.recording.quality, 'hd')
  assert.equal(parsed.recording.microphone, false)
  assert.equal(parsed.recording.knowledgeGraph, false)
})

test('录屏格式、清晰度和快捷键只接受受支持的取值', () => {
  const config = defaultDesktopToolsConfig('win32')

  assert.throws(() => parseDesktopToolsConfig({ ...config, recording: { ...config.recording, format: 'avi' } }), /取值无效: format/u)
  assert.throws(() => parseDesktopToolsConfig({ ...config, recording: { ...config.recording, quality: '4k' } }), /取值无效: quality/u)
  assert.throws(() => parseDesktopToolsConfig({ ...config, recording: { ...config.recording, microphone: 'yes' } }), /布尔值/u)
  assert.throws(() => parseDesktopToolsConfig({ ...config, screenshot: { ...config.screenshot, shortcut: 'S' } }), /快捷键无效/u)
  assert.equal(parseDesktopToolsConfig({ ...config, recording: { ...config.recording, format: 'gif' } }).recording.format, 'gif')
})

test('全局快捷键要求修饰键，空字符串表示不注册', () => {
  assert.equal(isDesktopAccelerator(''), true)
  assert.equal(isDesktopAccelerator('CommandOrControl+Shift+S'), true)
  assert.equal(isDesktopAccelerator('Alt+F1'), true)
  assert.equal(isDesktopAccelerator('PrintScreen'), true)
  assert.equal(isDesktopAccelerator('Ctrl+['), true)
  assert.equal(isDesktopAccelerator('A'), false)
  assert.equal(isDesktopAccelerator('Shift+Shift+A'), false)
  assert.equal(isDesktopAccelerator('Hyper+A'), false)
})

test('旧配置缺少自定义动作与按钮列表时使用默认值', () => {
  const config = defaultDesktopToolsConfig('win32')
  const { customActions: _actions, toolbarItems: _items, ...legacySelection } = config.selection
  const { pinsShortcut: _pins, ...legacyScreenshot } = config.screenshot
  const parsed = parseDesktopToolsConfig({ ...config, selection: legacySelection, screenshot: legacyScreenshot })
  assert.deepEqual(parsed.selection.customActions, [])
  assert.deepEqual(parsed.selection.toolbarItems, ['search', 'translate', 'note', 'wechat', 'explain', 'send-to-agent'])
  assert.equal(parsed.screenshot.pinsShortcut, '')
})

test('截图历史默认开启，旧配置缺少该项时也开启，开关值能保存', () => {
  const config = defaultDesktopToolsConfig('win32')
  assert.equal(config.history.enabled, true)
  const { history: _history, ...legacy } = config
  assert.equal(parseDesktopToolsConfig(legacy).history.enabled, true)
  assert.equal(parseDesktopToolsConfig({ ...config, history: { enabled: false } }).history.enabled, false)
  assert.throws(() => parseDesktopToolsConfig({ ...config, history: { enabled: 'no' } }), /布尔值/u)
})

test('按钮列表去重并丢弃未知按钮和已删除的自定义动作', () => {
  const config = defaultDesktopToolsConfig('win32')
  const parsed = parseDesktopToolsConfig({ ...config, selection: {
    ...config.selection,
    customActions: [{ id: 'polish', name: ' 润色 ', prompt: ' 润色 {text} ' }],
    toolbarItems: ['custom:polish', 'translate', 'translate', 'custom:gone', 'unknown', 42],
  } })
  assert.deepEqual(parsed.selection.customActions, [{ id: 'polish', name: '润色', prompt: '润色 {text}' }])
  assert.deepEqual(parsed.selection.toolbarItems, ['custom:polish', 'translate'])
})

test('自定义动作的 id、名称、提示词和数量受到校验', () => {
  const config = defaultDesktopToolsConfig('win32')
  const withActions = (customActions: unknown): unknown => ({ ...config, selection: { ...config.selection, customActions } })
  const action = { id: 'a', name: '名称', prompt: '提示词' }
  assert.throws(() => parseDesktopToolsConfig(withActions([{ ...action, id: 'Bad Id' }])), /id 无效/u)
  assert.throws(() => parseDesktopToolsConfig(withActions([action, action])), /id 无效/u)
  assert.throws(() => parseDesktopToolsConfig(withActions([{ ...action, name: 'x'.repeat(21) }])), /名称无效/u)
  assert.throws(() => parseDesktopToolsConfig(withActions([{ ...action, prompt: '  ' }])), /提示词无效/u)
  assert.throws(() => parseDesktopToolsConfig(withActions(Array.from({ length: 11 }, (_, index) => ({ ...action, id: `a${String(index)}` })))), /最多 10 个/u)
  assert.throws(() => parseDesktopToolsConfig({ ...config, screenshot: { ...config.screenshot, pinsShortcut: 'K' } }), /快捷键无效/u)
})
