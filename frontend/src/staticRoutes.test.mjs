import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const EXPECTED_STATIC_ROUTES = [
  'database',
  'aroma-threshold',
  'data-processing',
  'shimadzu-analysis',
  'data-analysis',
  'resources',
]

test('static route generator creates index entries for public application routes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'flavorthresholddb-routes-'))
  const dist = path.join(root, 'dist')
  await mkdir(dist)
  const sourceHtml = '<!doctype html><title>FlavorInsight AI</title>'
  await writeFile(path.join(dist, 'index.html'), sourceHtml)

  const previousOutputArgument = process.argv[2]
  process.argv[2] = dist
  let routeGenerator
  try {
    routeGenerator = await import(
      `${pathToFileURL(path.resolve('scripts/create-static-routes.mjs')).href}?test=${Date.now()}`
    )
  } finally {
    if (previousOutputArgument === undefined) {
      delete process.argv[2]
    } else {
      process.argv[2] = previousOutputArgument
    }
  }

  assert.deepEqual(routeGenerator.STATIC_ROUTE_SEGMENTS, EXPECTED_STATIC_ROUTES)
  assert.equal(Object.isFrozen(routeGenerator.STATIC_ROUTE_SEGMENTS), true)
  assert.equal(await readFile(path.join(dist, 'index.html'), 'utf8'), sourceHtml)

  for (const route of EXPECTED_STATIC_ROUTES) {
    assert.equal(
      await readFile(path.join(dist, route, 'index.html'), 'utf8'),
      sourceHtml,
      `${route} should refresh to the application shell`,
    )
  }
})

test('homepage metadata and package scripts identify FlavorInsight AI without changing the release version', async () => {
  const html = await readFile(path.resolve('index.html'), 'utf8')
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'))

  assert.match(html, /<title>FlavorInsight AI \| 食品风味信息学智能分析平台<\/title>/)
  assert.match(html, /<meta name="description" content="FlavorInsight AI /)
  assert.match(html, /<meta property="og:title" content="FlavorInsight AI \| 食品风味信息学智能分析平台"/)
  assert.match(html, /<meta property="og:description" content="FlavorInsight AI /)
  assert.equal(packageJson.version, '1.5.0')
  assert.equal(
    packageJson.scripts['test:platform'],
    'node --test src/platformRoutes.test.mjs src/platformUiContract.test.mjs',
  )
  assert.equal(
    packageJson.scripts['test:e2e:platform'],
    'node ../scripts/e2e/verify_platform_shell.mjs',
  )
})
