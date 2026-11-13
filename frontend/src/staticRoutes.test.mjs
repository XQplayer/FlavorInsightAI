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
  'data-processing/monitor',
  'data-processing/results',
  'data-processing/tasks',
  'shimadzu-analysis',
  'data-analysis',
  'ai-models',
  'ai-assistant',
  'resources',
  'login',
]

test('Vite keeps the Pages base and uses an isolated preview root', async () => {
  const previous = process.env.VITE_PCA_PREVIEW
  try {
    delete process.env.VITE_PCA_PREVIEW
    const pages = (await import('../vite.config.js?target=pages')).default
    assert.equal(pages.base, '/FlavorInsightAI/')
    process.env.VITE_PCA_PREVIEW = 'true'
    const preview = (await import('../vite.config.js?target=preview')).default
    assert.equal(preview.base, '/')
  } finally {
    if (previous === undefined) delete process.env.VITE_PCA_PREVIEW
    else process.env.VITE_PCA_PREVIEW = previous
  }
})

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

test('homepage metadata and package scripts identify the shipped FlavorInsight AI version', async () => {
  const html = await readFile(path.resolve('index.html'), 'utf8')
  const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'))

  assert.match(html, /<title>FlavorInsight AI \| 食品风味信息学智能分析平台<\/title>/)
  assert.match(html, /<meta name="description" content="FlavorInsight AI /)
  assert.match(html, /<meta property="og:title" content="FlavorInsight AI \| 食品风味信息学智能分析平台"/)
  assert.match(html, /<meta property="og:description" content="FlavorInsight AI /)
  assert.doesNotMatch(html, /%BASE_URL%favicon/)
  assert.match(html, /rel="icon" type="image\/png" href="\/brand\/flavorinsight-ai-mark\.png"/)
  assert.equal(packageJson.version, (await readFile(path.resolve('../VERSION'), 'utf8')).trim())
  assert.equal(
    packageJson.scripts['test:platform'],
    'node --test src/platformRoutes.test.mjs src/platformUiContract.test.mjs src/platformHomeV2.test.mjs src/app/authIntent.test.mjs',
  )
  assert.equal(
    packageJson.scripts['test:e2e:platform'],
    'node ../scripts/e2e/verify_platform_shell.mjs',
  )
})
