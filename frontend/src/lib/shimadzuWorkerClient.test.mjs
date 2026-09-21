import assert from 'node:assert/strict'
import test from 'node:test'

import { createShimadzuWorkerClient } from './shimadzuWorkerClient.js'

class FakeWorker {
  static latest
  constructor() { FakeWorker.latest = this; this.messages = []; this.terminated = false }
  postMessage(message, transfer) { this.messages.push({ message, transfer }) }
  terminate() { this.terminated = true }
  emit(data) { this.onmessage?.({ data }) }
}

test('transfers workbook buffers and resolves the completed archive', async () => {
  const events = []
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const rawBytes = new Uint8Array([1, 2]).buffer
  const sampleBytes = new Uint8Array([3, 4]).buffer
  const pending = client.run({ rawBytes, sampleBytes, name: '测试', resumeFromStage: 2, onEvent: event => events.push(event) })
  assert.equal(FakeWorker.latest.messages[0].message.type, 'start')
  assert.equal(FakeWorker.latest.messages[0].message.resumeFromStage, 2)
  assert.equal(FakeWorker.latest.messages[0].message.enableWaterDetectionThreshold, true)
  assert.equal(FakeWorker.latest.messages[0].message.enableEstimatedReferenceOav, false)
  assert.deepEqual(FakeWorker.latest.messages[0].transfer, [rawBytes, sampleBytes])
  FakeWorker.latest.emit({ type: 'stage-complete', stage: 0, progress: 14 })
  const archive = new Uint8Array([9, 8]).buffer
  FakeWorker.latest.emit({ type: 'complete', fileName: 'result.zip', archiveBytes: archive, archiveSha256: 'abc' })
  const result = await pending
  assert.equal(result.fileName, 'result.zip')
  assert.deepEqual(events.map(event => event.type), ['stage-complete', 'complete'])
  client.dispose()
  assert.equal(FakeWorker.latest.terminated, true)
})

test('sends CV screening settings with the browser start request', async () => {
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const pending = client.run({
    rawBytes: new ArrayBuffer(1), sampleBytes: new ArrayBuffer(1),
    enableCvScreening: false, cvThreshold: 12.5,
  })
  const start = FakeWorker.latest.messages[0].message
  assert.equal(start.enableCvScreening, false)
  assert.equal(start.cvThreshold, 12.5)
  FakeWorker.latest.emit({ type: 'complete', fileName: 'result.zip', archiveBytes: new ArrayBuffer(0), archiveSha256: 'abc' })
  await pending
  client.dispose()
})

test('sends the opt-in classification setting with the browser start request', async () => {
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const pending = client.run({ rawBytes: new ArrayBuffer(1), sampleBytes: new ArrayBuffer(1), enableClassification: true })
  assert.equal(FakeWorker.latest.messages[0].message.enableClassification, true)
  FakeWorker.latest.emit({ type: 'complete', fileName: 'result.zip', archiveBytes: new ArrayBuffer(0), archiveSha256: 'abc' })
  await pending
  client.dispose()
})

test('sends the independent default-on water detection threshold setting with the browser start request', async () => {
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const pending = client.run({
    rawBytes: new ArrayBuffer(1), sampleBytes: new ArrayBuffer(1),
    enableClassification: false, enableWaterDetectionThreshold: false,
  })
  const start = FakeWorker.latest.messages[0].message
  assert.equal(start.enableClassification, false)
  assert.equal(start.enableWaterDetectionThreshold, false)
  FakeWorker.latest.emit({ type: 'complete', fileName: 'result.zip', archiveBytes: new ArrayBuffer(0), archiveSha256: 'abc' })
  await pending
  client.dispose()
})

test('cancel waits for and preserves the worker cancellation archive', async () => {
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const pending = client.run({ rawBytes: new ArrayBuffer(1), sampleBytes: new ArrayBuffer(1) })
  let settled = false
  pending.then(() => { settled = true }, () => { settled = true })
  client.cancel()
  client.cancel()
  assert.equal(FakeWorker.latest.messages.at(-1).message.type, 'cancel')
  assert.equal(FakeWorker.latest.messages.filter(entry => entry.message.type === 'cancel').length, 1)
  await Promise.resolve()
  assert.equal(settled, false)

  const archive = new Uint8Array([4, 3, 2]).buffer
  FakeWorker.latest.emit({
    type: 'cancelled', code: 'ANALYSIS_CANCELLED', message: 'Analysis cancelled',
    archiveBytes: archive, archiveSha256: 'cancel-sha', archiveSize: archive.byteLength,
    fileName: 'cancelled_partial.zip',
  })
  await assert.rejects(pending, error => {
    assert.equal(error.code, 'ANALYSIS_CANCELLED')
    assert.deepEqual([...new Uint8Array(error.archiveBytes)], [4, 3, 2])
    assert.equal(error.archiveSha256, 'cancel-sha')
    assert.equal(error.fileName, 'cancelled_partial.zip')
    return true
  })
})

test('dispose reports an interruption so page unload does not erase resumable inputs', async () => {
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const pending = client.run({ rawBytes: new ArrayBuffer(1), sampleBytes: new ArrayBuffer(1) })
  client.dispose()
  await assert.rejects(pending, error => error.code === 'ANALYSIS_INTERRUPTED')
})

test('preserves structured failure details and partial archive metadata', async () => {
  const client = createShimadzuWorkerClient({ WorkerCtor: FakeWorker, workerUrl: 'worker.js' })
  const pending = client.run({ rawBytes: new ArrayBuffer(1), sampleBytes: new ArrayBuffer(1) })
  const archive = new Uint8Array([7, 6, 5]).buffer
  FakeWorker.latest.emit({
    type: 'error',
    code: 'STAGE_GATE_FAILED',
    message: '步骤4未通过质量门禁',
    details: { stage: 4, issues: [{ code: 'INVALID_INTERNAL_STANDARD_AREA', sampleName: 'A-2' }] },
    archiveBytes: archive,
    archiveSha256: 'partial-sha',
    archiveSize: archive.byteLength,
    fileName: '失败测试_部分结果.zip',
  })

  await assert.rejects(pending, error => {
    assert.equal(error.code, 'STAGE_GATE_FAILED')
    assert.equal(error.details.stage, 4)
    assert.deepEqual([...new Uint8Array(error.archiveBytes)], [7, 6, 5])
    assert.equal(error.archiveSha256, 'partial-sha')
    assert.equal(error.fileName, '失败测试_部分结果.zip')
    return true
  })
})
