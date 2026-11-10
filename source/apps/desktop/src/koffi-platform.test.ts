import assert from 'node:assert/strict'
import { test } from 'node:test'

test('Koffi computes native structure sizes on supported platforms', { skip: !['darwin', 'win32'].includes(process.platform) }, async () => {
  const { loadKoffiPlatform } = await import('./koffi-platform.ts')
  const koffi = loadKoffiPlatform()
  const point = koffi.struct('DSH_TEST_POINT', { x: 'int32', y: 'int32' })
  assert.equal(koffi.sizeof(point), 8)
})

test('Koffi loader can be imported without loading a platform binary', async () => {
  const { loadKoffiPlatform } = await import('./koffi-platform.ts')
  assert.equal(typeof loadKoffiPlatform, 'function')
})
