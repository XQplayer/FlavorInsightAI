import assert from 'node:assert/strict'
import test from 'node:test'
import { rectanglesOverlap } from './overlapGeometry.mjs'

test('fixed sidebar adjacent to main content is not an overlap', () => {
  const sidebar = { left: 0, right: 256, top: 0, bottom: 800 }
  const main = { left: 256, right: 1280, top: -9263, bottom: 799.64 }
  assert.equal(rectanglesOverlap(sidebar, main), false)
})

test('fixed bottom element crossing main content is an overlap', () => {
  const bottomBar = { left: 256, right: 1280, top: 740, bottom: 800 }
  const main = { left: 256, right: 1280, top: -9263, bottom: 799.64 }
  assert.equal(rectanglesOverlap(bottomBar, main), true)
})

test('offscreen drawer does not overlap mobile content', () => {
  const drawer = { left: -256, right: 0, top: 0, bottom: 667 }
  const main = { left: 0, right: 375, top: -1500, bottom: 667 }
  assert.equal(rectanglesOverlap(drawer, main), false)
})

test('zero-sized fixed elements do not count as occlusion', () => {
  const main = { left: 256, right: 1280, top: 0, bottom: 800 }
  assert.equal(rectanglesOverlap({ left: 500, right: 500, top: 740, bottom: 800 }, main), false)
  assert.equal(rectanglesOverlap({ left: 500, right: 700, top: 740, bottom: 740 }, main), false)
})
