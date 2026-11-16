/** 截图历史：保存、列出、上限、删除、清空，以及缺失文件与损坏索引。 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { HistoryStore, MAX_HISTORY_ENTRIES, MAX_HISTORY_TEXT, newHistoryId, type HistoryEntry } from './capture-history-store.ts'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function setup(t: TestContext): { store: HistoryStore; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-history-'))
  t.after(() => { rmSync(directory, { recursive: true, force: true }) })
  return { store: new HistoryStore(directory), directory }
}

const entry = (id: string, createdAt: number, extra: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({ id, createdAt, kind: 'image', image: true, width: 10, height: 10, ...extra })

test('新记录排在最前，图片与文字可以读回', (t) => {
  const { store } = setup(t)
  store.add(entry('h-a', 1), png)
  store.add(entry('h-b', 2, { kind: 'ocr', text: '识别结果' }), png)
  const list = store.list()
  assert.deepEqual(list.map(item => item.id), ['h-b', 'h-a'])
  assert.equal(list[0]?.text, '识别结果')
  assert.deepEqual(store.readImage('h-a'), png)
})

test('超出 100 条时删除最早的记录及图片', (t) => {
  const { store, directory } = setup(t)
  for (let index = 0; index < MAX_HISTORY_ENTRIES; index += 1) store.add(entry(`h-${String(index)}`, index), png)
  const evicted = store.add(entry('h-new', 1000), png)
  assert.deepEqual(evicted, ['h-0'])
  assert.equal(store.list().length, MAX_HISTORY_ENTRIES)
  assert.equal(existsSync(join(directory, 'h-0.png')), false)
})

test('过长的文字被截断，缺图片的图片记录拒绝保存', (t) => {
  const { store } = setup(t)
  store.add(entry('h-long', 1, { text: 'x'.repeat(MAX_HISTORY_TEXT + 10) }), png)
  assert.equal(store.list()[0]?.text?.length, MAX_HISTORY_TEXT)
  assert.throws(() => store.add(entry('h-noimg', 2)), /缺少图片/u)
})

test('删除单条与全部清空，都不碰用户保存的文件', (t) => {
  const { store, directory } = setup(t)
  const saved = join(directory, '..', `saved-${newHistoryId()}.mp4`)
  writeFileSync(saved, 'video')
  t.after(() => { rmSync(saved, { force: true }) })
  store.add(entry('h-a', 1), png)
  store.add({ id: 'h-rec', createdAt: 2, kind: 'recording', image: false, file: saved })
  store.remove('h-a')
  assert.deepEqual(store.list().map(item => item.id), ['h-rec'])
  store.clear()
  assert.deepEqual(store.list(), [])
  assert.equal(existsSync(saved), true)
})

test('录屏文件被删除、图片缺失、索引损坏或条目非法时跳过', (t) => {
  const { store, directory } = setup(t)
  writeFileSync(join(directory, 'history.json'), '{broken')
  assert.deepEqual(store.list(), [])
  writeFileSync(join(directory, 'h-ok.png'), png)
  writeFileSync(join(directory, 'history.json'), JSON.stringify([
    entry('h-ok', 1),
    entry('h-missing', 2),
    { id: 'h-rec', createdAt: 3, kind: 'recording', image: false, file: join(directory, 'gone.mp4') },
    { id: '../escape', createdAt: 4, kind: 'image', image: false },
    { id: 'h-kind', createdAt: 5, kind: 'video', image: false },
  ]))
  assert.deepEqual(store.list().map(item => item.id), ['h-ok'])
  assert.throws(() => store.readImage('../escape'), /id 无效/u)
})

test('新 id 满足命名规则且不重复', () => {
  const ids = new Set(Array.from({ length: 50 }, () => newHistoryId()))
  assert.equal(ids.size, 50)
  for (const id of ids) assert.match(id, /^[a-z0-9-]{1,48}$/u)
})
