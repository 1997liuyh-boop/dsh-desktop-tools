import assert from 'node:assert/strict'
import test from 'node:test'
import { floatingSnapTarget } from './floating-snap.ts'

test('松开时在阈值内吸附左右边缘，超过阈值保持自由位置', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1080 }
  assert.equal(floatingSnapTarget({ x: 24, y: 400 }, area, area, 24).docked, 'left')
  assert.equal(floatingSnapTarget({ x: 25, y: 400 }, area, area, 24).docked, undefined)
  assert.equal(floatingSnapTarget({ x: 1830, y: 400 }, area, area, 24).docked, 'right')
})

test('副屏负坐标和任务栏工作区的上下边缘正确吸附', () => {
  const bounds = { x: -1920, y: -300, width: 1920, height: 1080 }
  const work = { ...bounds, height: 1040 }
  assert.equal(floatingSnapTarget({ x: -1910, y: 200 }, bounds, work, 24).docked, 'left')
  assert.equal(floatingSnapTarget({ x: -1000, y: -280 }, bounds, work, 24).y, -300)
  assert.equal(floatingSnapTarget({ x: -1000, y: 660 }, bounds, work, 24).y, 668)
})
