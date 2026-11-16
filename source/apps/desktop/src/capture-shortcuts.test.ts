import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerCaptureShortcuts, type CaptureShortcutEntry, type CaptureShortcutMode } from './capture-shortcuts.ts'

const entries: CaptureShortcutEntry[] = [
  { accelerator: 'CommandOrControl+Shift+S', mode: 'image', enabled: true },
  { accelerator: '', mode: 'long', enabled: true },
  { accelerator: 'CommandOrControl+Shift+R', mode: 'video', enabled: false },
]

test('跳过未启用功能与空快捷键', () => {
  const calls: [string, CaptureShortcutMode][] = []
  const status = registerCaptureShortcuts(entries, (accelerator, mode) => { calls.push([accelerator, mode]); return true })
  assert.deepEqual(calls, [['CommandOrControl+Shift+S', 'image']])
  assert.deepEqual(status, { registered: ['CommandOrControl+Shift+S'], failed: [] })
})

test('同一组合只注册一次，第一项生效', () => {
  const calls: CaptureShortcutMode[] = []
  const status = registerCaptureShortcuts([
    { accelerator: 'Alt+A', mode: 'image', enabled: true },
    { accelerator: 'Alt+A', mode: 'long', enabled: true },
  ], (_accelerator, mode) => { calls.push(mode); return true })
  assert.deepEqual(calls, ['image'])
  assert.deepEqual(status.registered, ['Alt+A'])
})

test('被占用的组合失败后不会被后续项重复尝试', () => {
  let attempts = 0
  const status = registerCaptureShortcuts([
    { accelerator: 'Alt+A', mode: 'image', enabled: true },
    { accelerator: 'Alt+A', mode: 'video', enabled: true },
  ], () => { attempts += 1; return false })
  assert.equal(attempts, 1)
  assert.deepEqual(status.failed, [{ accelerator: 'Alt+A', reason: 'occupied' }])
})

test('钉图快捷键按 pins 模式注册', () => {
  const calls: CaptureShortcutMode[] = []
  const status = registerCaptureShortcuts([
    { accelerator: 'Alt+P', mode: 'pins', enabled: true },
    { accelerator: '', mode: 'pins', enabled: true },
  ], (_accelerator, mode) => { calls.push(mode); return true })
  assert.deepEqual(calls, ['pins'])
  assert.deepEqual(status.registered, ['Alt+P'])
})

test('区分被占用与组合无效', () => {
  const status = registerCaptureShortcuts([
    { accelerator: 'Alt+A', mode: 'image', enabled: true },
    { accelerator: 'Bogus+Key', mode: 'long', enabled: true },
    { accelerator: 'Alt+R', mode: 'video', enabled: true },
  ], (accelerator) => {
    if (accelerator === 'Bogus+Key') throw new TypeError('invalid accelerator')
    return accelerator === 'Alt+R'
  })
  assert.deepEqual(status, {
    registered: ['Alt+R'],
    failed: [{ accelerator: 'Alt+A', reason: 'occupied' }, { accelerator: 'Bogus+Key', reason: 'invalid' }],
  })
})
