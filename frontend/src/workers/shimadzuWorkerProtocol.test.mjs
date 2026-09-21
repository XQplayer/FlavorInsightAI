import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./shimadzu.worker.js', import.meta.url), 'utf8')

test('the worker transfers a cancellation archive on the cancelled terminal frame', () => {
  assert.match(source, /const cancelled = error\?\.code === 'ANALYSIS_CANCELLED'/)
  assert.match(source, /type: 'cancelled'[\s\S]*archiveSha256:[\s\S]*fileName:/)
  assert.match(source, /payload\.archiveBytes = archiveBytes\.buffer[\s\S]*self\.postMessage\(payload, \[payload\.archiveBytes\]\)/)
  assert.doesNotMatch(source, /controller\.signal\.aborted \|\| error\?\.code === 'ANALYSIS_CANCELLED'/)
})
