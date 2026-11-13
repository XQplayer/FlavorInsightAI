import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthIntent, saveAuthIntent, takeAuthIntent } from './authIntent.js'

const base = '/FlavorInsightAI/'
function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('keeps only internal route and safe processing parameters', () => {
  const intent = createAuthIntent({ returnPath: '/FlavorInsightAI/data-processing/?task_id=bad', action: 'processing.start', draft: { name: 'Sample A', mode: 'continuous', cvThreshold: '30', enableCvScreening: true, rawFile: { name: 'secret.xlsx' }, access_token: 'secret' } }, base, 1000)
  assert.equal(intent.returnPath, '/FlavorInsightAI/data-processing/')
  assert.deepEqual(intent.draft, { name: 'Sample A', mode: 'continuous', cvThreshold: '30', enableCvScreening: true })
  assert.equal(JSON.stringify(intent).includes('secret'), false)
  const legacy = createAuthIntent({ returnPath: '/FlavorInsightAI/shimadzu-analysis/', action: 'processing.start', draft: { name: 'Legacy bookmark' } }, base, 1000)
  assert.equal(legacy.returnPath, '/FlavorInsightAI/shimadzu-analysis/')
})

test('rejects external destinations and stale or tampered intents', () => {
  assert.equal(createAuthIntent({ returnPath: 'https://evil.example/login', action: 'assistant.send' }, base), null)
  assert.equal(createAuthIntent({ returnPath: '//evil.example', action: 'assistant.send' }, base), null)
  const storage = memoryStorage()
  saveAuthIntent({ returnPath: '/FlavorInsightAI/ai-assistant/', action: 'assistant.send', draft: { text: 'Check CAS' } }, base, storage, 1000)
  assert.equal(takeAuthIntent(base, storage, 1000 + 16 * 60_000), null)
  assert.equal(takeAuthIntent(base, storage, 1000 + 16 * 60_000), null)
})

test('restores one bounded draft once without submitting it', () => {
  const storage = memoryStorage()
  saveAuthIntent({ returnPath: '/FlavorInsightAI/ai-assistant/?conversation_id=bad', action: 'assistant.send', draft: { text: 'Research question', password: 'do not store' } }, base, storage, 1000)
  const intent = takeAuthIntent(base, storage, 1001)
  assert.equal(intent.returnPath, '/FlavorInsightAI/ai-assistant/')
  assert.deepEqual(intent.draft, { text: 'Research question' })
  assert.equal(takeAuthIntent(base, storage, 1002), null)
})
