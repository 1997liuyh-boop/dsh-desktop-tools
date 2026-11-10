/** 桌面工具统一配置的默认值、校验和持久化测试。 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  defaultDesktopToolsConfig,
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
    writeDesktopToolsConfig(profile, { ...config, screenshot: { enabled: true } })
    assert.deepEqual(readDesktopToolsConfig(profile), { ...config, screenshot: { enabled: true } })
    assert.match(readFileSync(join(profile, 'desktop-tools.json'), 'utf8'), /"screenshot"/u)

    writeFileSync(join(profile, 'desktop-tools.json'), '{broken')
    assert.throws(() => readDesktopToolsConfig(profile), /无法读取桌面工具配置/u)
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
})
