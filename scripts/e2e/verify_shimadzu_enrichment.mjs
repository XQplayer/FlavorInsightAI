import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dist = path.join(root, 'frontend/dist')
const live = process.env.SHIMADZU_E2E_LIVE === '1'
const { chromium } = await import(process.env.CODEX_E2E_PLAYWRIGHT || pathToFileURL(path.resolve(path.dirname(process.execPath), '../node_modules/playwright/index.mjs')).href)
const { default: JSZip } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/jszip/lib/index.js')).href)
const server = http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/FlavorInsightAI\//, '')
    if (name.includes('..')) throw new Error('invalid path')
    const file = name && !name.endsWith('/') ? name : 'index.html'
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.json') ? 'application/json' : 'text/html')
    response.end(await fs.readFile(path.join(dist, file)))
  } catch { response.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  try { browser = await chromium.launch({ headless: true }) }
  catch { browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }) }
  const context = await browser.newContext()
  let ordinaryLoads = 0
  let bookLoads = 0
  let compoundCalls = 0
  context.on('request', request => {
    if (request.url().includes('aroma_data_merged.json')) ordinaryLoads += 1
    if (request.url().includes('book_flavor_chemistry_index.json')) bookLoads += 1
    if (request.url().includes('/compound?')) compoundCalls += 1
  })
  if (!live) await context.route('https://flavorthresholddb-api.onrender.com/**', async route => {
    const url = new URL(route.request().url())
    let body = { found: false }
    if (url.pathname === '/health') body = { ok: true }
    if (url.pathname === '/pubchem' && url.searchParams.get('cas') === '141-78-6') body = { found: true, cid: 8857, title: 'ETHYL ACETATE', smiles: 'CCOC(=O)C' }
    if (url.pathname === '/flavordb' && url.searchParams.get('cid') === '8857') body = { found: true, cid: 8857, common_name: 'ethyl acetate', functional_groups: ['carboxylic acid derivative', 'carboxylic acid ester'], flavor_profile: ['fruity'] }
    if (url.pathname === '/fema' && url.searchParams.get('cas') === '141-78-6') body = { found: true, fema_number: '2414', flavor_profile: 'Fruity' }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  const baseUrl = live ? 'https://xqplayer.github.io/FlavorInsightAI/' : `http://127.0.0.1:${server.address().port}/FlavorInsightAI/`
  // Keep the real origin without loading unrelated application preloads.
  await context.route(`${baseUrl}__worker-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Worker regression</title>' }))
  await page.goto(`${baseUrl}__worker-test`)
  ordinaryLoads = 0
  bookLoads = 0
  const worker = live ? await page.evaluate(async base => {
    const html = await (await fetch(base)).text()
    const main = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)[1]
    const app = await (await fetch(main)).text()
    const shimadzu = app.match(/assets\/ShimadzuAnalysisPage-[\w-]+\.js/)[0]
    const chunk = await (await fetch(`${base}${shimadzu}`)).text()
    return chunk.match(/shimadzu\.worker-[\w-]+\.js/)[0]
  }, baseUrl) : (await fs.readdir(path.join(dist, 'assets'))).find(name => /^shimadzu\.worker.*\.js$/.test(name))
  const templates = path.join(root, 'resources/shimadzu/templates')
  const raw = (await fs.readFile(path.join(templates, 'Shimadzu_Raw_Workbook_Example.xlsx'))).toString('base64')
  const samples = (await fs.readFile(path.join(templates, 'Shimadzu_Sample_Internal_Standard_Template.xlsx'))).toString('base64')
  const archive = await page.evaluate(({ worker, raw, samples }) => new Promise((resolve, reject) => {
    const instance = new Worker(`/FlavorInsightAI/assets/${worker}`, { type: 'module' })
    const timer = setTimeout(() => { instance.terminate(); reject(new Error('worker timed out')) }, 180000)
    instance.onerror = event => { clearTimeout(timer); instance.terminate(); reject(new Error(event.message)) }
    instance.onmessage = ({ data }) => {
      if (data.type === 'error') { clearTimeout(timer); instance.terminate(); reject(new Error(JSON.stringify(data.details))) }
      if (data.type === 'complete') { clearTimeout(timer); instance.terminate(); resolve(Array.from(new Uint8Array(data.archiveBytes))) }
    }
    instance.postMessage({ type: 'start', rawBytes: Uint8Array.from(atob(raw), c => c.charCodeAt(0)), sampleBytes: Uint8Array.from(atob(samples), c => c.charCodeAt(0)), enableClassification: true, enableWaterDetectionThreshold: true, enableCvScreening: false })
  }), { worker, raw, samples })
  const zip = await JSZip.loadAsync(Uint8Array.from(archive))
  const stage4 = JSON.parse(await zip.file('04_跨样品合并与半定量/data.json').async('string'))
  const ethyl = stage4.table.rows.find(row => row['CAS #'] === '141-78-6')
  assert.equal(ethyl.常用英文名, 'Ethyl acetate')
  assert.equal(ethyl.主要官能团, 'carboxylic acid derivative；carboxylic acid ester')
  assert.equal(ethyl.化合物分类, '酯类')
  assert.equal(ethyl.FEMA编号, '2414')
  assert.equal(ethyl['FlavorDB2 CID'], '8857')
  assert.notEqual(ethyl['水中觉察阈值（μg/L）'], 'NA')
  assert.equal(ordinaryLoads, 2) // identity names once, thresholds once
  assert.equal(bookLoads, 1)
  assert.equal(compoundCalls, 0)
  const XLSX = await import(pathToFileURL(path.join(root, 'frontend/node_modules/xlsx/xlsx.mjs')).href)
  for (const prefix of ['05_', '06_']) {
    const file = Object.keys(zip.files).find(name => name.startsWith(prefix) && /Mean浓度.*\.xlsx$/.test(name))
    assert.ok(file, prefix)
    const book = XLSX.read(await zip.file(file).async('uint8array'), { type: 'array' })
    const row = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]).find(row => row['CAS #'] === '141-78-6')
    assert.equal(row?.常用英文名, 'Ethyl acetate')
    assert.equal(row?.化合物分类, '酯类')
  }
  console.log(JSON.stringify({ mode: live ? 'live public API' : 'API fixtures', productionWorker: worker, status: 'PASS', ordinaryLoads, bookLoads, ethyl }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
