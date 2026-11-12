import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('shipped package and deployment defaults agree with the canonical product version', async () => {
  const root = new URL('../../', import.meta.url)
  const version = (await readFile(new URL('VERSION', root), 'utf8')).trim()
  assert.match(version, /^1\.[01]\.0$/)
  const pkg = JSON.parse(await readFile(new URL('frontend/package.json', root), 'utf8'))
  assert.equal(pkg.version, version)
  const render = await readFile(new URL('render.yaml', root), 'utf8')
  assert.equal(render.match(/key: API_VERSION\s+value: "([^"]+)"/)[1], version)
  const workflow = await readFile(new URL('.github/workflows/deploy-render-api.yml', root), 'utf8')
  assert.equal(workflow.match(/expected_version:[\s\S]*?default: ([^\s]+)/)[1], version)
})
