/** 钉图持久化：保存、恢复、更新、删除、数量上限与损坏数据。 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { MAX_STORED_PINS, PinStore, type StoredPin } from './capture-pin-store.ts'

const bounds = { x: 10, y: 20, width: 300, height: 200 }
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function setup(t: TestContext): { store: PinStore; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-pins-'))
  t.after(() => { rmSync(directory, { recursive: true, force: true }) })
  return { store: new PinStore(directory), directory }
}

const pin = (id: string, createdAt: number): StoredPin => ({ id, createdAt, bounds, hidden: false })

test('保存后可以按创建时间恢复，并更新位置和显示状态', (t) => {
  const { store } = setup(t)
  assert.deepEqual(store.list(), [])
  store.add(pin('pin-b', 2), png)
  store.add(pin('pin-a', 1), png)
  assert.deepEqual(store.list().map(item => item.id), ['pin-a', 'pin-b'])
  assert.deepEqual(store.readImage('pin-a'), png)
  store.update('pin-a', { bounds: { ...bounds, x: 99 }, hidden: true })
  const updated = store.list()[0]
  assert.deepEqual([updated?.bounds.x, updated?.hidden], [99, true])
  store.update('missing', { hidden: true })
  assert.equal(store.list().length, 2)
})

test('删除钉图同时删除图片文件', (t) => {
  const { store, directory } = setup(t)
  store.add(pin('pin-a', 1), png)
  store.remove('pin-a')
  assert.deepEqual(store.list(), [])
  assert.equal(existsSync(join(directory, 'pin-a.png')), false)
})

test('超出上限时删除最早的钉图并返回其 id', (t) => {
  const { store, directory } = setup(t)
  for (let index = 0; index < MAX_STORED_PINS; index += 1) store.add(pin(`pin-${String(index)}`, index), png)
  const evicted = store.add(pin('pin-new', 1000), png)
  assert.deepEqual(evicted, ['pin-0'])
  assert.equal(store.list().length, MAX_STORED_PINS)
  assert.equal(existsSync(join(directory, 'pin-0.png')), false)
})

test('索引损坏、条目非法或图片缺失时跳过，不抛错', (t) => {
  const { store, directory } = setup(t)
  writeFileSync(join(directory, 'pins.json'), '{broken')
  assert.deepEqual(store.list(), [])
  writeFileSync(join(directory, 'pin-ok.png'), png)
  writeFileSync(join(directory, 'pins.json'), JSON.stringify([
    pin('pin-ok', 1), pin('pin-no-image', 2),
    { id: '../escape', createdAt: 3, bounds, hidden: false },
    { id: 'pin-bad', createdAt: 4, bounds: { x: 0 }, hidden: false },
  ]))
  assert.deepEqual(store.list().map(item => item.id), ['pin-ok'])
  assert.throws(() => store.add(pin('../escape', 5), png), /id 无效/u)
})
