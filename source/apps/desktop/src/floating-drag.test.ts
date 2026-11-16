/** 使用真实交互处理器验证拖动、点击和捕获丢失时的行为。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

function harness(running = false) {
  const source = readFileSync(new URL('../../../../assets/floating.js', import.meta.url), 'utf8')
  const handlers = new Map<string, (event: object) => unknown>()
  const moves: number[][] = []
  const expanded: boolean[] = []
  let clamps = 0
  const context = {
    running, moves, expanded,
    ball: { addEventListener: (name: string, handler: (event: object) => unknown) => handlers.set(name, handler), setPointerCapture() {} },
    document: { body: { classList: { add() {}, remove() {} } } },
    performance: { now: () => 1000 },
    cancelCollapse() {}, asking: () => false, gatingTcc: () => false,
    isPrimaryButton: (event: { button: number }) => event.button === 0,
    primaryButtonHeld: (event: { buttons: number }) => (event.buttons & 1) === 1,
    ballGrabOffset: () => ({ dx: 12, dy: 15 }),
    moveBall: async (x: number, y: number) => { moves.push([x, y]) },
    clampBall: async () => { clamps++ },
  }
  const start = source.indexOf("  ball.addEventListener('pointerdown'")
  const end = source.indexOf("  dockTab.addEventListener('pointerdown'", start)
  assert.ok(start > 0 && end > start)
  runInNewContext(`
    let dragging = false, collapsing = false, skipClick = false, pinned = false, opening = false,
      expanded = false, suppressExpand = false, skipDockCommit = false, clickOpenedAt = 0;
    let pointer, lastOrigin;
    const DOUBLE_CLICK_MS = 300;
    async function setExpanded(next) { expanded = next; globalThis.expanded.push(next); }
    ${source.slice(start, end)}
  `, context)
  return {
    moves, expanded, clamps: () => clamps,
    async emit(type: string, overrides: object = {}) {
      await handlers.get(type)?.({ type, button: 0, buttons: 1, pointerId: 1, screenX: 100, screenY: 100,
        preventDefault() {}, ...overrides })
      await new Promise(resolve => setImmediate(resolve))
    },
  }
}

test('左键按住拖动期间不缩放窗口，松开后提交最终位置并吸边，不打开聊天', async () => {
  const h = harness()
  await h.emit('pointerdown')
  await h.emit('pointermove', { screenX: 120, screenY: 130 })
  assert.deepEqual(h.moves, [[108, 115]])
  assert.deepEqual(h.expanded, [])
  await h.emit('pointerup', { screenX: 125, screenY: 135, buttons: 0 })
  assert.deepEqual(h.moves.at(-1), [113, 120])
  assert.deepEqual(h.expanded, [false])
  assert.equal(h.clamps(), 1)
})

test('轻微移动仍作为点击；没有左键按下的松开和右键不会打开聊天', async () => {
  const h = harness()
  await h.emit('pointerup', { buttons: 0 })
  await h.emit('pointerdown', { button: 2, buttons: 2 })
  await h.emit('pointerup', { button: 2, buttons: 0 })
  assert.deepEqual(h.expanded, [])
  await h.emit('pointerdown')
  await h.emit('pointermove', { screenX: 102, screenY: 102 })
  await h.emit('pointerup', { screenX: 102, screenY: 102, buttons: 0 })
  assert.deepEqual(h.expanded, [true])
  assert.deepEqual(h.moves, [])
})

test('捕获丢失使用最后有效位置，后续松开不会误触发点击', async () => {
  const h = harness()
  await h.emit('pointerdown')
  await h.emit('pointermove', { screenX: 180, screenY: 190 })
  await h.emit('lostpointercapture', { screenX: 0, screenY: 0, buttons: 0 })
  await h.emit('pointerup', { screenX: 180, screenY: 190, buttons: 0 })
  assert.deepEqual(h.moves.at(-1), [168, 175])
  assert.deepEqual(h.expanded, [false])
  assert.equal(h.clamps(), 1)
})

test('Agent 执行期间拖动保留聊天框，不强制收起', async () => {
  const h = harness(true)
  await h.emit('pointerdown')
  await h.emit('pointermove', { screenX: 150 })
  await h.emit('pointerup', { screenX: 150, buttons: 0 })
  assert.deepEqual(h.expanded, [])
  assert.equal(h.clamps(), 1)
})
