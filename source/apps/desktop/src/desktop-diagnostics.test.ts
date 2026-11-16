import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDiagnostics, fillDiagnosticText, formatDiagnosticReport, type DiagnosticInput } from './desktop-diagnostics.ts'
import { defaultDesktopToolsConfig } from './desktop-tools-config.ts'
import type { DesktopDiagnosticId, DesktopDiagnosticItem, DesktopToolsConfig, DesktopToolsSnapshot } from './desktop-tools-types.ts'
import { en, zh } from '../../../client/locales.ts'

function snapshot(overrides: Partial<DesktopToolsSnapshot> = {}, config: DesktopToolsConfig = defaultDesktopToolsConfig('win32')): DesktopToolsSnapshot {
  return {
    config,
    platform: 'win32',
    vision: { state: 'ready' },
    runtime: 'running',
    features: { selection: { phase: 'active' }, floatingBall: { phase: 'active' }, capture: { phase: 'disabled' } },
    ...overrides,
  }
}

function input(overrides: Partial<DiagnosticInput> = {}): DiagnosticInput {
  return {
    platform: 'win32',
    config: { path: 'C:/profile/desktop-tools.json' },
    electron: { kind: 'dev', path: 'D:/electron.exe', exists: true },
    hostElectron: '39.2.0',
    helperElectron: '39.2.0',
    koffi: { packageName: '@koromix/koffi-win32-x64', path: 'D:/node_modules/@koromix/koffi-win32-x64/index.js' },
    snapshot: snapshot(),
    ...overrides,
  }
}

function item(items: DesktopDiagnosticItem[], id: DesktopDiagnosticId): DesktopDiagnosticItem {
  const found = items.find(entry => entry.id === id)
  assert.ok(found, `缺少诊断项 ${id}`)
  return found
}

const captureOn: DesktopToolsConfig = {
  ...defaultDesktopToolsConfig('win32'),
  screenshot: { ...defaultDesktopToolsConfig('win32').screenshot, enabled: true },
}

test('正常环境下关键项均为 ok，未启用的功能为 skip', () => {
  const items = buildDiagnostics(input())
  for (const id of ['config', 'electron', 'electron-version', 'native-module', 'runtime', 'feature-selection', 'feature-floatingBall'] as const) {
    assert.equal(item(items, id).status, 'ok', id)
  }
  assert.equal(item(items, 'feature-capture').status, 'skip')
  assert.equal(item(items, 'vision').status, 'skip')
  assert.equal(item(items, 'shortcuts').status, 'skip')
  assert.equal(item(items, 'permission-screen').status, 'skip')
})

test('打包版缺少独立 Electron 时报错并列出尝试过的路径', () => {
  const items = buildDiagnostics(input({ electron: { kind: 'missing', candidates: ['A/electron.exe', 'B/electron.exe'] } }))
  assert.deepEqual(item(items, 'electron'), { id: 'electron', status: 'error', message: 'diagElectronMissing', values: { tried: 'A/electron.exe\nB/electron.exe' } })
})

test('插件设置中填写的 Electron 不存在时报错', () => {
  const items = buildDiagnostics(input({ electron: { kind: 'configured', path: 'X:/none.exe', exists: false } }))
  assert.equal(item(items, 'electron').status, 'error')
  assert.equal(item(items, 'electron').message, 'diagElectronNotFound')
})

test('Electron 主版本不一致时提醒，辅助进程未上报时跳过', () => {
  assert.equal(item(buildDiagnostics(input({ helperElectron: '37.1.0' })), 'electron-version').status, 'warn')
  assert.equal(item(buildDiagnostics(input({ helperElectron: '39.0.1' })), 'electron-version').status, 'ok')
  const { helperElectron: _helper, ...rest } = input()
  assert.equal(item(buildDiagnostics(rest), 'electron-version').status, 'skip')
})

test('原生模块缺失为 error，不受支持的平台为 skip', () => {
  assert.equal(item(buildDiagnostics(input({ koffi: { packageName: '@koromix/koffi-win32-x64', error: 'Cannot find module' } })), 'native-module').status, 'error')
  assert.equal(item(buildDiagnostics(input({ platform: 'linux', koffi: {} })), 'native-module').status, 'skip')
})

test('辅助进程降级或未运行时给出重启入口', () => {
  const degraded = buildDiagnostics(input({
    snapshot: snapshot({ runtime: 'degraded', features: { selection: { phase: 'error', error: 'hook failed' }, floatingBall: { phase: 'active' }, capture: { phase: 'disabled' } } }),
  }))
  assert.deepEqual(item(degraded, 'runtime'), { id: 'runtime', status: 'error', message: 'diagRuntimeDegraded', values: { error: 'hook failed' }, fix: 'restart' })
  assert.equal(item(degraded, 'feature-selection').status, 'error')
  assert.equal(item(degraded, 'feature-selection').fix, 'restart')

  const stopped = buildDiagnostics(input({
    runtimeError: 'spawn ENOENT',
    snapshot: snapshot({ runtime: 'stopped', features: { selection: { phase: 'disabled' }, floatingBall: { phase: 'disabled' }, capture: { phase: 'disabled' } } }),
  }))
  assert.equal(item(stopped, 'runtime').message, 'diagRuntimeStopped')
  assert.equal(item(stopped, 'runtime').values?.error, 'spawn ENOENT')
  assert.equal(item(stopped, 'feature-floatingBall').message, 'diagFeatureNotRunning')

  const config = { ...defaultDesktopToolsConfig('win32'), selection: { ...defaultDesktopToolsConfig('win32').selection, enabled: false },
    floatingBall: { ...defaultDesktopToolsConfig('win32').floatingBall, enabled: false } }
  const idle = buildDiagnostics(input({ snapshot: snapshot({ runtime: 'stopped', features: { selection: { phase: 'disabled' }, floatingBall: { phase: 'disabled' }, capture: { phase: 'disabled' } } }, config) }))
  assert.equal(item(idle, 'runtime').status, 'skip')
})

test('快捷键占用与无效分别列出', () => {
  const base = { snapshot: snapshot({ features: { selection: { phase: 'active' }, floatingBall: { phase: 'active' }, capture: { phase: 'active' } } }, captureOn) }
  const occupied = item(buildDiagnostics(input({ ...base, shortcuts: { status: { registered: [], failed: [{ accelerator: 'Alt+S', reason: 'occupied' }] } } })), 'shortcuts')
  assert.equal(occupied.status, 'warn')
  assert.equal(occupied.message, 'diagShortcutsOccupied')
  assert.equal(occupied.values?.occupied, 'Alt+S')
  const both = item(buildDiagnostics(input({ ...base, shortcuts: { status: { registered: [], failed: [
    { accelerator: 'Alt+S', reason: 'occupied' }, { accelerator: 'Foo', reason: 'invalid' }] } } })), 'shortcuts')
  assert.equal(both.message, 'diagShortcutsFailed')
  const ok = item(buildDiagnostics(input({ ...base, shortcuts: { status: { registered: ['Alt+S', 'Alt+R'], failed: [] } } })), 'shortcuts')
  assert.deepEqual([ok.status, ok.values?.list], ['ok', 'Alt+S, Alt+R'])
  assert.equal(item(buildDiagnostics(input({ ...base, shortcuts: { error: 'timeout' } })), 'shortcuts').status, 'warn')
})

test('启用截图时检查 vision-router，并按状态给出修复入口', () => {
  const vision = (state: DesktopToolsSnapshot['vision']['state']): DesktopDiagnosticItem =>
    item(buildDiagnostics(input({ snapshot: snapshot({ vision: { state, version: '3.2.0' } }, captureOn) })), 'vision')
  assert.equal(vision('ready').status, 'ok')
  assert.deepEqual([vision('missing').status, vision('missing').fix], ['warn', 'install-vision'])
  assert.deepEqual([vision('disabled').status, vision('disabled').fix], ['warn', 'install-vision'])
  assert.deepEqual([vision('tool-off').status, vision('tool-off').fix], ['warn', undefined])
  assert.equal(vision('unknown').status, 'skip')
})

test('macOS 未授权的系统权限给出打开入口', () => {
  const items = buildDiagnostics(input({ platform: 'darwin', permissions: { screen: false, accessibility: true } }))
  assert.deepEqual([item(items, 'permission-screen').status, item(items, 'permission-screen').fix], ['warn', 'open-screen'])
  assert.equal(item(items, 'permission-accessibility').status, 'ok')
  const unknown = buildDiagnostics(input({ platform: 'darwin' }))
  assert.equal(item(unknown, 'permission-screen').message, 'diagPermissionUnknown')
})

test('配置文件损坏时报错', () => {
  const items = buildDiagnostics(input({ config: { path: 'C:/p/desktop-tools.json', error: 'Unexpected token' } }))
  assert.deepEqual(item(items, 'config'), { id: 'config', status: 'error', message: 'diagConfigError', values: { path: 'C:/p/desktop-tools.json', error: 'Unexpected token' } })
})

test('所有诊断文案键在中英文字典中都存在', () => {
  const variants: DiagnosticInput[] = [
    input(),
    input({ electron: { kind: 'missing', candidates: [] }, koffi: { packageName: 'x', error: 'e' }, config: { path: 'p', error: 'e' } }),
    input({ electron: { kind: 'configured', path: 'p', exists: true }, helperElectron: '1.0.0', platform: 'darwin', permissions: { screen: false, accessibility: true } }),
    input({ electron: { kind: 'found', path: 'p', exists: true }, koffi: {}, platform: 'linux', snapshot: snapshot({ runtime: 'degraded', vision: { state: 'tool-off' },
      features: { selection: { phase: 'starting' }, floatingBall: { phase: 'error' }, capture: { phase: 'disabled' } } }, captureOn), shortcuts: { error: 'x' } }),
  ]
  const keys = new Set(variants.flatMap(variant => buildDiagnostics(variant).map(entry => entry.message)))
  for (const state of ['missing', 'disabled', 'unknown'] as const) {
    keys.add(item(buildDiagnostics(input({ snapshot: snapshot({ vision: { state } }, captureOn) })), 'vision').message)
  }
  for (const key of keys) {
    assert.ok(key in en, `英文缺少 ${key}`)
    assert.ok(key in zh, `中文缺少 ${key}`)
  }
})

test('文案占位符替换与报告格式', () => {
  assert.equal(fillDiagnosticText('{a} 与 {b}', { a: '1' }), '1 与 ')
  const report = formatDiagnosticReport({
    generatedAt: '2026-11-16T00:00:00.000Z',
    environment: { plugin: '0.5.0', platform: 'win32', arch: 'x64', hostElectron: '39.2.0', helperElectron: '39.2.0', packaged: true },
    items: [
      { id: 'electron', status: 'error', message: 'diagElectronMissing', values: { tried: 'A\nB' } },
      { id: 'runtime', status: 'ok', message: 'diagRuntimeRunning' },
    ],
  }, key => (zh as Record<string, string>)[key] ?? key)
  const lines = report.split('\n')
  assert.equal(lines[0], 'dsh-desktop-tools 0.5.0')
  assert.equal(lines[1], 'platform: win32-x64 (packaged DSH)')
  assert.match(report, /\[ERROR\] electron: .*A \| B$/mu)
  assert.match(report, /^\[OK\] runtime: 运行中$/mu)
})
