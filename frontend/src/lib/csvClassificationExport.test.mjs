import assert from 'node:assert/strict'
import test from 'node:test'

import { CLASSIFICATION_EXPORT_COLUMNS, classificationExportValues } from './csvClassificationExport.js'

test('exports the two traceable classification columns and uses NA when unavailable', () => {
  assert.deepEqual(CLASSIFICATION_EXPORT_COLUMNS, ['官能团名称', '主要化合物类别'])
  const classifications = new Map([['141-78-6', { 官能团名称: '酯类', 主要化合物类别: '酯类' }]])
  assert.deepEqual(classificationExportValues(classifications, '141-78-6'), ['酯类', '酯类'])
  assert.deepEqual(classificationExportValues(classifications, 'missing'), ['NA', 'NA'])
})
