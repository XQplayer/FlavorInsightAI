import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAiEvents, verifiedAiEvents } from './aiStream.js'

test('SSE parser preserves split Unicode deltas without duplicate messages', async () => {
  const encoder = new TextEncoder()
  const bytes = encoder.encode('data: {"type":"delta","text":"乙酸"}\n\ndata: {"type":"delta","text":"乙酯"}\n\ndata: {"type":"done"}\n\n')
  const stream = new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close() } })
  const events = []
  for await (const event of parseAiEvents(stream)) events.push(event)
  assert.deepEqual(events.map(event => event.type), ['delta', 'delta', 'done'])
  assert.equal(events.filter(event => event.type === 'delta').map(event => event.text).join(''), '乙酸乙酯')
})

test('truncated SSE stream is a visible failure, not a successful partial answer', async () => {
  const bytes = new TextEncoder().encode('data: {"type":"delta","text":"partial"}\n\n')
  const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } })
  await assert.rejects(async () => { for await (const event of verifiedAiEvents(stream)) void event }, /ended before completion/u)
})
