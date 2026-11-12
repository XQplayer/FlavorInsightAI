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

test('current and archive release links preserve every legacy source identity', async () => {
  const root = new URL('../../', import.meta.url)
  const version = (await readFile(new URL('VERSION', root), 'utf8')).trim()
  const map = JSON.parse(await readFile(new URL('docs/history/releases/version-map.json', root), 'utf8'))
  const snapshot = JSON.parse(await readFile(new URL('docs/history/releases/2026-11-12-legacy-release-backup.json', root), 'utf8'))
  assert.equal(map.current_version, version)
  assert.equal(map.current_tag, `flavorinsight-v${version}`)
  assert.match(map.archive_snapshot_commit, /^[a-f0-9]{40}$/)
  assert.equal(map.archive_tag, 'flavorinsight-v1.0.0')
  assert.equal(map.legacy_versions.length, snapshot.legacy_software_tags.length)
  for (const row of map.legacy_versions) {
    const original = snapshot.releases.find(item => item.tag_name === row.legacy_tag)
    assert.equal(row.release_id, original.id)
    assert.equal(row.original_published_at, original.published_at)
    assert.equal(row.commit, snapshot.tag_refs[`${row.legacy_tag}^{}`] || snapshot.tag_refs[row.legacy_tag])
    assert.equal(row.source_url, `https://github.com/XQplayer/FlavorInsightAI/tree/${row.legacy_tag}`)
  }
})
