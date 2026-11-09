import { createDataset } from './dataset.mjs'
import { defaultRecipe, effectiveState, validateAnalysis, validateRecipe } from './workbench.mjs'

const PCA_INTENT = /\bPCA\b|主成分|整体差异|整体分布|overall (?:pattern|difference|distribution)|principal component/i

export async function datasetSha256(dataset) {
  const bytes = new TextEncoder().encode(JSON.stringify(dataset))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function inspectDataset(input) {
  const dataset = createDataset(input)
  const included = dataset.samples.map((sample, index) => ({ sample, index })).filter(({ sample }) => sample.include !== false)
  const groups = {}
  const unitGroups = new Map()
  const technicalGroups = new Map()
  const rowSignatures = new Map()
  const duplicateMeasurementRows = []
  const duplicateNames = []
  const names = new Set()
  for (const { sample, index } of included) {
    if (sample.group) groups[sample.group] = (groups[sample.group] || 0) + 1
    if (names.has(sample.name)) duplicateNames.push(sample.id)
    names.add(sample.name)
    if (sample.biologicalUnitId) {
      const group = sample.group || '<unassigned>'
      const units = unitGroups.get(sample.biologicalUnitId) || new Set()
      units.add(group)
      unitGroups.set(sample.biologicalUnitId, units)
      const key = JSON.stringify([sample.biologicalUnitId, group])
      technicalGroups.set(key, [...(technicalGroups.get(key) || []), sample.id])
    }
    const signature = JSON.stringify(dataset.matrix[index])
    if (rowSignatures.has(signature)) duplicateMeasurementRows.push([rowSignatures.get(signature), sample.id])
    else rowSignatures.set(signature, sample.id)
  }
  const missingByFeature = []
  const constantFeatureIds = []
  let missingCount = 0
  let unverifiedCount = 0
  let numericFeatureCount = 0
  for (let column = 0; column < dataset.features.length; column++) {
    const values = []
    let missing = 0
    for (const { index } of included) {
      const value = dataset.matrix[index][column]
      const state = effectiveState(dataset, index, column)
      if (value === null || state === 'missing' || state === 'qc-filtered') { missing++; continue }
      if (state !== 'observed') unverifiedCount++
      values.push(value)
    }
    missingCount += missing
    if (missing) missingByFeature.push({ featureId: dataset.features[column].id, count: missing })
    if (values.length) numericFeatureCount++
    if (values.length && values.every(value => value === values[0])) constantFeatureIds.push(dataset.features[column].id)
  }
  const units = [...new Set(dataset.features.map(feature => feature.unit).filter(Boolean))]
  return {
    datasetId: dataset.id, datasetName: dataset.name,
    sampleCount: included.length, numericFeatureCount,
    sampleIds: included.map(({ sample }) => sample.id), featureIds: dataset.features.map(feature => feature.id),
    groups, units, missingCount, missingByFeature, unverifiedCount, constantFeatureIds,
    duplicateNames, duplicateMeasurementRows,
    design: {
      independence: dataset.provenance.independenceConfirmed === true ? 'user-confirmed' : 'unconfirmed',
      biologicalUnitCount: unitGroups.size,
      missingBiologicalUnitIds: included.filter(({ sample }) => !sample.biologicalUnitId).map(({ sample }) => sample.id),
      technicalRepeatSets: [...technicalGroups].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ biologicalUnitId: JSON.parse(key)[0], group: JSON.parse(key)[1], sampleIds: ids })),
      crossGroupUnitIds: [...unitGroups].filter(([, labels]) => labels.size > 1).map(([id]) => id),
      pairedDesign: [...unitGroups.values()].some(labels => labels.size > 1) ? 'possible; confirm experimentally' : 'not established',
    },
    source: dataset.provenance.source || 'unrecorded',
  }
}

export function recommendAnalysis(prompt, inspection) {
  if (typeof prompt !== 'string' || prompt.length > 4000 || !PCA_INTENT.test(prompt)) {
    return { method: null, reason: 'Only exploratory PCA intent is supported in this workflow.' }
  }
  if (inspection.sampleCount < 2 || inspection.numericFeatureCount < 1) {
    return { method: null, reason: 'PCA requires at least two samples and one numeric variable.' }
  }
  const warnings = []
  if (inspection.design.independence !== 'user-confirmed') warnings.push('BIOLOGICAL_INDEPENDENCE_UNCONFIRMED')
  if (inspection.design.missingBiologicalUnitIds.length) warnings.push('BIOLOGICAL_UNIT_IDS_MISSING')
  if (inspection.design.technicalRepeatSets.length) warnings.push('TECHNICAL_REPEATS_NOT_INDEPENDENT')
  if (inspection.design.crossGroupUnitIds.length) warnings.push('REPEATED_OR_PAIRED_DESIGN_NEEDS_CONFIRMATION')
  if (inspection.missingCount) warnings.push('MISSING_VALUES_REQUIRE_EXPLICIT_STRATEGY')
  if (inspection.unverifiedCount) warnings.push('MEASUREMENT_LINEAGE_UNVERIFIED')
  if (inspection.constantFeatureIds.length) warnings.push('CONSTANT_FEATURES_RECOMMEND_EXPLICIT_DROP')
  if (inspection.units.length > 1) warnings.push('MIXED_UNITS_REQUIRE_ACKNOWLEDGEMENT')
  if (inspection.duplicateNames.length || inspection.duplicateMeasurementRows.length) warnings.push('POSSIBLE_DUPLICATE_RECORDS_REVIEW')
  return {
    method: 'pca', reason: 'Exploratory PCA describes the dominant variation in a sample-by-variable matrix.',
    warnings, assumptions: ['Samples are rows and measured variables are columns.', 'PCA scores are descriptive; group separation is not a significance test.', 'Group labels do not establish biological independence.'],
  }
}

export async function prepareAnalysis(dataset, prompt) {
  const inspection = inspectDataset(dataset)
  const recommendation = recommendAnalysis(prompt, inspection)
  if (recommendation.method !== 'pca') throw new Error('UNSUPPORTED_ANALYSIS_INTENT')
  const recipe = defaultRecipe()
  recipe.filter.zeroVariance = inspection.constantFeatureIds.length ? 'drop' : 'keep'
  return {
    schemaVersion: 1, prompt: prompt.trim(), datasetId: dataset.id,
    datasetHash: await datasetSha256(dataset), inspection, recommendation,
    recipe, analysis: { method: 'pca', center: true, components: Math.min(2, inspection.sampleCount - 1, inspection.numericFeatureCount) },
    engine: 'existing R analysis service', status: 'awaiting-user-confirmation',
  }
}

export async function confirmAnalysis(plan, dataset) {
  if (!plan || plan.status !== 'awaiting-user-confirmation' || plan.datasetId !== dataset?.id || plan.datasetHash !== await datasetSha256(dataset)) throw new Error('DATASET_CHANGED')
  const inspected = inspectDataset(dataset)
  if (inspected.sampleCount < 2 || inspected.numericFeatureCount < 1) throw new Error('INSUFFICIENT_PCA_MATRIX')
  const recipe = validateRecipe(plan.recipe)
  const analysis = validateAnalysis(plan.analysis)
  if (analysis.method !== 'pca' || analysis.components > Math.min(inspected.sampleCount - 1, inspected.numericFeatureCount)) throw new Error('INVALID_PCA_COMPONENTS')
  if (inspected.missingCount && recipe.impute.method === 'none') throw new Error('MISSING_VALUES_REQUIRE_EXPLICIT_STRATEGY')
  if (inspected.units.length > 1 && !recipe.filter.allowMixedUnits) throw new Error('MIXED_UNITS_REQUIRE_ACKNOWLEDGEMENT')
  const receipt = {
    datasetId: plan.datasetId, datasetHash: plan.datasetHash,
    prompt: plan.prompt, confirmedAt: new Date().toISOString(),
    sampleIds: inspected.sampleIds, featureIds: inspected.featureIds,
    warnings: recommendAnalysis(plan.prompt, inspected).warnings,
    engine: plan.engine, analysis, recipe,
  }
  receipt.confirmationHash = await datasetSha256(receipt)
  return { request: { dataset, recipe, analysis }, receipt }
}
