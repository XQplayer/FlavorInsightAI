export const V2_COMPOUND_IDENTITY_COLUMNS = Object.freeze([
  '中文名', '常用英文名', '主要官能团', '化合物分类',
  'FEMA编号', 'FEMA风味描述', 'FlavorDB2 CID', 'FlavorDB2风味描述',
])

export const V2_WATER_DETECTION_THRESHOLD_COLUMNS = Object.freeze([
  '水中觉察阈值原始数据', '水中觉察阈值来源', '水中觉察阈值（μg/L）',
])

export const V2_OPTIONAL_COMPOUND_METADATA_COLUMNS = Object.freeze([
  ...V2_COMPOUND_IDENTITY_COLUMNS,
  ...V2_WATER_DETECTION_THRESHOLD_COLUMNS,
])
