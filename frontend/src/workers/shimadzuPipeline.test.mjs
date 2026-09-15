import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import JSZip from 'jszip'

import { createPartialFailureArchive, runShimadzuBrowserPipeline } from './shimadzuPipeline.js'

const resource = name => new URL(`../../../resources/shimadzu/templates/${name}`, import.meta.url)

test('builds a downloadable partial archive with structured gate details', async () => {
  const zip = new JSZip()
  zip.file('00_输入配置与清单/data.json', '{"status":"PASS"}\n')
  const failure = await createPartialFailureArchive({
    zip,
    name: '失败测试',
    stage: 4,
    issues: [{ severity: 'FAIL', code: 'INVALID_INTERNAL_STANDARD_AREA', sampleName: 'A-2', cas: '123-96-6' }],
    completedStages: [{ stage: 0, status: 'PASS' }],
  })

  assert.equal(failure.code, 'STAGE_GATE_FAILED')
  assert.equal(failure.details.stage, 4)
  assert.equal(failure.details.issues[0].sampleName, 'A-2')
  assert.ok(failure.archiveBytes.byteLength > 0)
  const partial = await JSZip.loadAsync(failure.archiveBytes)
  assert.ok(partial.file('失败任务/错误明细.json'))
  assert.ok(partial.file('失败任务/部分运行状态.json'))
})

test('runs the public example through browser stages 0-6 without OAV', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  const events = []
  const result = await runShimadzuBrowserPipeline({
    rawBytes,
    sampleBytes,
    rawName: 'Shimadzu_Raw_Workbook_Example.xlsx',
    sampleName: 'Shimadzu_Sample_Internal_Standard_Template.xlsx',
    name: '公开示例',
    onEvent: event => events.push(event),
  })

  assert.deepEqual(events.filter(event => event.type === 'stage-complete').map(event => event.stage), [0, 1, 2, 3, 4, 5, 6])
  assert.equal(result.stages[1].counts.input, 9)
  assert.equal(result.stages[2].counts.retained, 9)
  assert.equal(result.stages[3].counts.casRows, 3)
  assert.equal(result.stages[4].counts.concentrationCells, 9)
  assert.equal(result.stages[5].counts.finalAnalysisCas, 3)
  assert.equal(result.stages[6].counts.workbooks, 4)
  assert.equal(result.oavExecuted, false)

  const zip = await JSZip.loadAsync(result.archiveBytes)
  const paths = Object.keys(zip.files)
  assert.ok(paths.includes('00_输入配置与清单/data.json'))
  assert.ok(paths.includes('04_跨样品合并与半定量/04_全样品_峰面积与浓度.xlsx'))
  assert.ok(paths.some(path => path.endsWith('/05_04_CV30筛选后Mean浓度与SD.xlsx')))
  assert.ok(paths.includes('完整性验证/v2-completeness-verification.json'))
  assert.equal(paths.some(path => /OAV/i.test(path)), false)
})

test('records disabled CV screening without filtering the Stage 5 results', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  const result = await runShimadzuBrowserPipeline({
    rawBytes, sampleBytes, rawName: 'raw.xlsx', sampleName: 'samples.xlsx',
    name: 'CV optional', enableCvScreening: false, cvThreshold: 12.5,
  })
  const zip = await JSZip.loadAsync(result.archiveBytes)
  const stage5Path = Object.keys(zip.files).find(path => path.startsWith('05_') && path.endsWith('/data.json'))
  const stage5 = JSON.parse(await zip.file(stage5Path).async('string'))
  assert.equal(stage5.cvScreeningExecuted, false)
  assert.equal(stage5.cvThreshold, 12.5)
  assert.equal(stage5.counts.filteredGroups, 0)
  assert.equal(stage5.qcRows.some(row => row[0] === 'CV筛查' && row[2] === '未执行'), true)
})

test('adds CAS-resolved identity fields to the enabled Stage 4 workbook export', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  const result = await runShimadzuBrowserPipeline({
    rawBytes, sampleBytes, rawName: 'raw.xlsx', sampleName: 'samples.xlsx', name: 'classification enabled',
    enableClassification: true,
    enrichCasValues: async casValues => new Map(casValues.map(cas => [cas, { 中文名: '乙酸乙酯', 常用英文名: 'Ethyl acetate', 主要官能团: 'carboxylic acid ester', 化合物分类: '酯类', FEMA编号: '2414', FEMA风味描述: 'Aromatic', 'FlavorDB2 CID': '8857', 'FlavorDB2风味描述': 'fruity' }])),
  })
  const zip = await JSZip.loadAsync(result.archiveBytes)
  const workbookBytes = await zip.file('04_跨样品合并与半定量/04_全样品_峰面积与浓度.xlsx').async('uint8array')
  const { readWorkbookSheets } = await import('./shimadzuWorkbook.js')
  const sheet = readWorkbookSheets(workbookBytes)[0]

  assert.equal(sheet.rows[0].cells.includes('CID'), false)
  assert.equal(sheet.rows[0].cells.includes('主要官能团'), true)
  assert.equal(sheet.rows[0].cells.includes('FlavorDB2风味描述'), true)
  assert.equal(sheet.rows[1].cells.includes('乙酸乙酯'), true)
})

test('only adds identity fields to the Stage 4 semi-quantification workbook', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  const result = await runShimadzuBrowserPipeline({
    rawBytes, sampleBytes, rawName: 'raw.xlsx', sampleName: 'samples.xlsx', name: 'Stage 4 only classification',
    enableClassification: true,
    enrichCasValues: async casValues => new Map(casValues.map(cas => [cas, { 中文名: '乙酸乙酯', 常用英文名: 'Ethyl acetate', 主要官能团: 'carboxylic acid ester', 化合物分类: '酯类', FEMA编号: '2414', FEMA风味描述: 'Aromatic', 'FlavorDB2 CID': '8857', 'FlavorDB2风味描述': 'fruity' }])),
  })
  const zip = await JSZip.loadAsync(result.archiveBytes)
  const { readWorkbookSheets } = await import('./shimadzuWorkbook.js')
  const stage3Path = Object.keys(zip.files).find(path => path.startsWith('03_平行峰面积处理/结果清单/') && path.endsWith('_平行峰面积处理.xlsx'))
  assert.ok(stage3Path)
  const stage3Bytes = await zip.file(stage3Path).async('uint8array')
  const stage4Bytes = await zip.file('04_跨样品合并与半定量/04_全样品_峰面积与浓度.xlsx').async('uint8array')
  const stage3Sheet = readWorkbookSheets(stage3Bytes)[0]
  const stage4Sheet = readWorkbookSheets(stage4Bytes)[0]
  assert.equal(stage3Sheet.rows[0].cells.includes('FlavorDB2 CID'), false)
  assert.equal(stage4Sheet.rows[0].cells.includes('FlavorDB2 CID'), true)
})

test('enriches Stage 4 identities and preserves them through Stage 5 and Stage 6', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  const expectedColumns = ['中文名', '常用英文名', '主要官能团', '化合物分类', 'FEMA编号', 'FEMA风味描述', 'FlavorDB2 CID', 'FlavorDB2风味描述']
  const result = await runShimadzuBrowserPipeline({
    rawBytes, sampleBytes, rawName: 'raw.xlsx', sampleName: 'samples.xlsx', name: 'identity enrichment',
    enableClassification: true,
    enrichCasValues: async casValues => new Map(casValues.map(cas => [cas, {
      中文名: '乙酸乙酯', 常用英文名: 'Ethyl acetate', 主要官能团: 'carboxylic acid ester', 化合物分类: '酯类',
      FEMA编号: '2414', FEMA风味描述: 'Aromatic', 'FlavorDB2 CID': '8857', 'FlavorDB2风味描述': 'fruity',
    }])),
  })
  const zip = await JSZip.loadAsync(result.archiveBytes)
  const { readWorkbookSheets } = await import('./shimadzuWorkbook.js')
  const paths = [
    '04_跨样品合并与半定量/04_全样品_峰面积与浓度.xlsx',
    '05_统计_CV_CAS与QC/05_02_Mean浓度与SD.xlsx',
    Object.keys(zip.files).find(path => path.startsWith('06_按矩阵拆分/') && path.endsWith('_CV筛选前_Mean浓度.xlsx')),
  ]
  for (const path of paths) {
    assert.ok(path)
    const bytes = await zip.file(path).async('uint8array')
    const header = readWorkbookSheets(bytes)[0].rows[0].cells
    assert.deepEqual(expectedColumns.map(column => header.includes(column)), expectedColumns.map(() => true))
  }
})

test('does not add identity columns to later stages when classification is disabled', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  const result = await runShimadzuBrowserPipeline({ rawBytes, sampleBytes, enableClassification: false })
  const zip = await JSZip.loadAsync(result.archiveBytes)
  const { readWorkbookSheets } = await import('./shimadzuWorkbook.js')
  const bytes = await zip.file('05_统计_CV_CAS与QC/05_02_Mean浓度与SD.xlsx').async('uint8array')
  assert.equal(readWorkbookSheets(bytes)[0].rows[0].cells.includes('FlavorDB2 CID'), false)
})

test('exports CAS recovery audit rows without adding unresolved records to CAS analysis', async () => {
  const [rawBytes, sampleBytes] = await Promise.all([
    readFile(resource('Shimadzu_Raw_Workbook_Example.xlsx')),
    readFile(resource('Shimadzu_Sample_Internal_Standard_Template.xlsx')),
  ])
  let invoked = false
  const result = await runShimadzuBrowserPipeline({
    rawBytes, sampleBytes,
    recoverCasRecord: async record => {
      if (!invoked) {
        invoked = true
        return { record, review: { 'CAS 原始值': '0-00-0', 'CAS 来源': '待人工确认', 'PubChem CID': '527299', 'CAS 补全状态': '待人工确认' } }
      }
      return { record, audit: { 'CAS 原始值': record['CAS #'], 'CAS 来源': '岛津原始值', 'PubChem CID': 'NA', 'CAS 补全状态': '无需补全' } }
    },
  })
  assert.equal(result.stages[1].identityReviews.length, 1)
  const zip = await JSZip.loadAsync(result.archiveBytes)
  const reviewBytes = await zip.file('01_Hit1整理/01_CAS恢复与审核.xlsx').async('uint8array')
  const { readWorkbookSheets } = await import('./shimadzuWorkbook.js')
  const sheets = readWorkbookSheets(reviewBytes)
  assert.equal(sheets.find(sheet => sheet.name === '待人工确认').rows[1].cells.includes('527299'), true)
})
