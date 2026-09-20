export const CLASSIFICATION_EXPORT_COLUMNS = ['官能团名称', '主要化合物类别']

const NA_CLASSIFICATION = Object.freeze({
  官能团名称: 'NA',
  主要化合物类别: 'NA',
})

export function classificationExportValues(classifications, cas) {
  const classification = classifications?.get(String(cas || '').trim())
  return [
    classification?.官能团名称 || NA_CLASSIFICATION.官能团名称,
    classification?.主要化合物类别 || NA_CLASSIFICATION.主要化合物类别,
  ]
}
