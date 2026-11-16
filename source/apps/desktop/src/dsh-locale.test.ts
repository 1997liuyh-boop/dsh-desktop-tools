/** 从 DSH 设置服务描述中读取界面语言偏好。 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { dshLocalePreference } from './dsh-locale.ts'
import { resolveDesktopStartupLocale } from './locale.ts'

test('取出 locale 项的 preference', () => {
  assert.equal(dshLocalePreference([{ ns: 'theme', value: {} }, { ns: 'locale', value: { preference: 'ja' } }]), 'ja')
  assert.equal(dshLocalePreference([{ ns: 'locale', value: { preference: 'zh-CN' } }]), 'zh-CN')
})

test('没有设置、格式非法或结构不符时返回 null（跟随系统）', () => {
  assert.equal(dshLocalePreference([{ ns: 'locale', value: {} }]), null)
  assert.equal(dshLocalePreference([{ ns: 'locale', value: { preference: '../../etc' } }]), null)
  assert.equal(dshLocalePreference([{ ns: 'locale', value: { preference: 42 } }]), null)
  assert.equal(dshLocalePreference([{ ns: 'other' }]), null)
  assert.equal(dshLocalePreference(undefined), null)
  assert.equal(dshLocalePreference({ ns: 'locale' }), null)
})

test('DSH 的偏好优先于系统语言，未知偏好回落到系统语言', () => {
  assert.equal(resolveDesktopStartupLocale('en', ['zh-CN']).id, 'en')
  assert.equal(resolveDesktopStartupLocale('zh', ['en-US']).id, 'zh-CN')
  assert.equal(resolveDesktopStartupLocale('xx', ['ja-JP']).id, 'ja')
  assert.equal(resolveDesktopStartupLocale(null, ['fr-FR']).id, 'fr')
})
