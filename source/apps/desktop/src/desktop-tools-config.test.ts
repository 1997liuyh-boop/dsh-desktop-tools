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
