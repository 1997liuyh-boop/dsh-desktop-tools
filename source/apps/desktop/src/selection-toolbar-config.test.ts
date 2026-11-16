/** 辅助进程写入划词设置时不得丢失设置页维护的字段。 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { defaultDesktopToolsConfig, readDesktopToolsConfig, writeDesktopToolsConfig } from './desktop-tools-config.ts'
import { readSelectionToolbarConfig, writeSelectionToolbarConfig } from './selection-toolbar-config.ts'

test('修改语言和模型时保留自定义动作与按钮顺序，清除模型时删除 model 字段', (t) => {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-desktop-tools-'))
  t.after(() => { rmSync(profile, { recursive: true, force: true }) })
  const config = defaultDesktopToolsConfig('win32')
  writeDesktopToolsConfig(profile, { ...config, selection: {
    ...config.selection,
    model: { provider: 'p', model: 'm' },
    customActions: [{ id: 'polish', name: '润色', prompt: '润色 {text}' }],
    toolbarItems: ['custom:polish', 'translate'],
  } })
  const current = readSelectionToolbarConfig(profile)
  assert.deepEqual(current.toolbarItems, ['custom:polish', 'translate'])

  const { model: _model, ...withoutModel } = current
  writeSelectionToolbarConfig(profile, { ...withoutModel, translateTargetLanguage: '日本語' })
  const saved = readDesktopToolsConfig(profile).selection
  assert.equal(saved.targetLanguage, '日本語')
  assert.equal('model' in saved, false)
  assert.deepEqual(saved.customActions, [{ id: 'polish', name: '润色', prompt: '润色 {text}' }])
  assert.deepEqual(saved.toolbarItems, ['custom:polish', 'translate'])
})
