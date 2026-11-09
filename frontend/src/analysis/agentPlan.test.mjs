import test from 'node:test'
import assert from 'node:assert/strict'
import fixture from '../../../services/analysis/tests/fixtures/synthetic-3groups.json' with { type: 'json' }
import { inspectDataset, recommendAnalysis, prepareAnalysis, confirmAnalysis } from './agentPlan.mjs'

test('synthetic PCA inspection counts samples, features and explicit design without inferring independence from names', async () => {
  const dataset = structuredClone(fixture)
  dataset.provenance.independenceConfirmed = false
  const inspected = inspectDataset(dataset)
  assert.equal(inspected.sampleCount, 24)
  assert.equal(inspected.numericFeatureCount, 8)
  assert.equal(inspected.design.independence, 'unconfirmed')
  assert.deepEqual(inspected.groups, { Control: 8, TreatmentA: 8, TreatmentB: 8 })
  assert.equal(recommendAnalysis('帮我分析这份数据的整体差异，先做 PCA。', inspected).method, 'pca')
  assert.equal(recommendAnalysis('生成显著性 P 值', inspected).method, null)
})

test('explicit PCA confirmation binds exact dataset bytes and does not run on stale or incomplete input', async () => {
  const dataset = structuredClone(fixture)
  const plan = await prepareAnalysis(dataset, '先做 PCA 看整体差异')
  assert.equal(plan.analysis.method, 'pca')
  assert.equal(plan.recipe.impute.method, 'none')
  assert.equal(plan.datasetId, dataset.id)
  const bound = await confirmAnalysis(plan, dataset)
  assert.equal(bound.request.dataset.id, dataset.id)
  assert.equal(bound.receipt.datasetHash, plan.datasetHash)
  const changed = structuredClone(dataset)
  changed.matrix[0][0] += 1
  await assert.rejects(confirmAnalysis(plan, changed), /DATASET_CHANGED/)
  const missing = structuredClone(dataset)
  missing.matrix[0][0] = null
  missing.quality.cellStates[0][0] = 'missing'
  const missingPlan = await prepareAnalysis(missing, 'PCA')
  await assert.rejects(confirmAnalysis(missingPlan, missing), /MISSING_VALUES_REQUIRE_EXPLICIT_STRATEGY/)
})

test('technical repeats and paired samples are identified only from explicit metadata', () => {
  const dataset = structuredClone(fixture)
  dataset.samples[1].biologicalUnitId = dataset.samples[0].biologicalUnitId
  dataset.samples[8].biologicalUnitId = dataset.samples[0].biologicalUnitId
  const inspected = inspectDataset(dataset)
  assert.equal(inspected.design.technicalRepeatSets.length, 1)
  assert.equal(inspected.design.crossGroupUnitIds.length, 1)
  assert.equal(inspected.design.biologicalUnitCount, 22)
})
