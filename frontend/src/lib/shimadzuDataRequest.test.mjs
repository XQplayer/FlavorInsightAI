import assert from 'node:assert/strict'
import test from 'node:test'
import { requestShimadzuJson } from './shimadzuDataRequest.js'

test('retries a rate-limited request and returns the successful data', async () => {
  let attempts = 0
  const result = await requestShimadzuJson('https://example.test/pubchem', { fetchImpl: async () => {
    attempts += 1
    return attempts === 1 ? { ok: false, status: 429 } : { ok: true, json: async () => ({ title: 'Ethanol' }) }
  } })
  assert.equal(attempts, 2)
  assert.equal(result.title, 'Ethanol')
})

test('times out stalled fetches rather than leaving analysis running indefinitely', async () => {
  let aborted = 0
  await assert.rejects(requestShimadzuJson('https://example.test/pubchem', {
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted += 1; reject(new Error('timed out')) }, { once: true })
    }),
  }), /timed out/)
  assert.equal(aborted, 2)
})

test('does not issue or retry requests after cancellation', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  await assert.rejects(requestShimadzuJson('https://example.test/pubchem', { signal: controller.signal, fetchImpl: async () => { calls += 1 } }))
  assert.equal(calls, 0)
})

test('allows a cold-start HTML response to recover before parsing the real API data', async () => {
  let calls = 0
  const result = await requestShimadzuJson('https://example.test/health', {
    attempts: 3, retryDelayMs: 0,
    fetchImpl: async () => ({ ok: true, json: async () => {
      calls += 1
      if (calls < 3) throw new SyntaxError('Render service waking up HTML')
      return { ok: true }
    } }),
  })
  assert.equal(calls, 3)
  assert.equal(result.ok, true)
})
