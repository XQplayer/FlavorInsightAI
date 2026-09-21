import assert from 'node:assert/strict'
import test from 'node:test'

import { createShimadzuWaterDetectionThresholdService } from './shimadzuWaterDetectionThreshold.js'

test('selects the lowest normalized value from the newest ordinary water detection year', async () => {
  const service = createShimadzuWaterDetectionThresholdService({
    loadThresholds: async () => [
      { cas: '1-11-1', medium: '水', threshold_data: ['Older (2019) d 0.1 mg/L'] },
      { cas: '1-11-1', medium: '水', threshold_data: ['Newest (2022) d 500 ng/L', 'Newest (2022) d 0.8 μg/L'] },
      { cas: '1-11-1', medium: '水', threshold_data: ['Wrong type (2024) r 0.01 μg/L'] },
    ],
    loadBookIndex: async () => ({ records: [] }),
  })
  assert.deepEqual(await service.resolve('1-11-1'), {
    '水中觉察阈值原始数据': '500 ng/L', '水中觉察阈值来源': 'Newest (2022)', '水中觉察阈值（μg/L）': 0.5,
  })
})

test('falls back to the smallest usable book water detection threshold', async () => {
  const service = createShimadzuWaterDetectionThresholdService({
    loadThresholds: async () => [],
    loadBookIndex: async () => ({ records: [
      { entity_cas: '2-22-2', media: ['水'], threshold_type: '觉察', values: [{ low: '2', unit: 'μg/L' }], raw_text: '2 μg/L', page: 28 },
      { entity_cas: '2-22-2', media: ['水'], threshold_type: '觉察', values: [{ low: '900', unit: 'ng/L' }], raw_text: '900 ng/L', page: 29 },
    ] }),
  })
  assert.deepEqual(await service.resolve('2-22-2'), {
    '水中觉察阈值原始数据': '900 ng/L', '水中觉察阈值来源': '书籍：酒类风味化学，第29页', '水中觉察阈值（μg/L）': 0.9,
  })
})

test('returns NA when no scalar water detection threshold can be converted', async () => {
  const service = createShimadzuWaterDetectionThresholdService({
    loadThresholds: async () => [{ cas: '3-33-3', medium: '水', threshold_data: ['Ref (2024) r 0.1 μg/L', 'Ref (2024) d < 0.1 μg/L', 'Ref (2024) d 1 mmol/L'] }],
    loadBookIndex: async () => ({ records: [] }),
  })
  assert.deepEqual(await service.resolve('3-33-3'), {
    '水中觉察阈值原始数据': 'NA', '水中觉察阈值来源': 'NA', '水中觉察阈值（μg/L）': 'NA',
  })
})

test('uses the project water convention for an ordinary source record without a unit', async () => {
  const service = createShimadzuWaterDetectionThresholdService({
    loadThresholds: async () => [{ cas: '4-44-4', medium: '水', threshold_data: ['Local (2023) d 0.08'] }],
    loadBookIndex: async () => ({ records: [] }),
  })
  assert.deepEqual(await service.resolve('4-44-4'), {
    '水中觉察阈值原始数据': '0.08 mg/kg（项目推定）',
    '水中觉察阈值来源': 'Local (2023)（单位按项目约定推定为 mg/kg）',
    '水中觉察阈值（μg/L）': 80,
  })
})
