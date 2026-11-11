/** 长截图拼接位移识别测试：用合成画面模拟滚动、固定顶栏与静止帧。 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { findShift, rowSignatures } from './stitch.ts'

const WIDTH = 40

/** 生成一帧：每个内容行的颜色由其在整页中的行号决定，顶栏固定。 */
function frame(scroll: number, height: number, header = 0): Uint8ClampedArray {
  const data = new Uint8ClampedArray(WIDTH * height * 4)
  for (let y = 0; y < height; y += 1) {
    const line = y < header ? -1 - y : y + scroll
    for (let x = 0; x < WIDTH; x += 1) {
      const index = (y * WIDTH + x) * 4
      // 行内也有变化，避免纯色行在任意位移下都匹配。
      data[index] = line < 0 ? 200 : (line * 37 + x * 11) % 256
      data[index + 1] = line < 0 ? 200 : (line * 91 + x * 5) % 256
      data[index + 2] = line < 0 ? 200 : (line * 53) % 256
      data[index + 3] = 255
    }
  }
  return data
}

test('识别向下滚动的行数', () => {
  const height = 120
  const before = rowSignatures(frame(0, height), WIDTH, height)
  const after = rowSignatures(frame(23, height), WIDTH, height)
  assert.equal(findShift(before, after, 0, height), 23)
})

test('画面未变化时返回 0', () => {
  const height = 120
  const rows = rowSignatures(frame(5, height), WIDTH, height)
  assert.equal(findShift(rows, rows, 0, height), 0)
})

test('排除固定顶栏后仍能识别位移', () => {
  const height = 150, header = 20
  const before = rowSignatures(frame(0, height, header), WIDTH, height)
  const after = rowSignatures(frame(40, height, header), WIDTH, height)
  let top = 0
  while (before[top] === after[top]) top += 1
  assert.equal(top, header)
  assert.equal(findShift(before, after, top, height), 40)
})

test('完全不相关的画面无法匹配', () => {
  const height = 100
  const before = rowSignatures(frame(0, height), WIDTH, height)
  const after = rowSignatures(frame(5000, height), WIDTH, height)
  assert.equal(findShift(before, after, 0, height), -1)
})
