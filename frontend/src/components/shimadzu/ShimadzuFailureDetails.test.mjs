import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('renders bilingual evidence safely and keeps the downloadable archive', async () => {
  const vite = await createServer({ root: fileURLToPath(new URL('../../..', import.meta.url)), logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { default: Details } = await vite.ssrLoadModule('/src/components/shimadzu/ShimadzuFailureDetails.jsx')
    const error = { code: 'STAGE_GATE_FAILED', message: 'Gate failed', details: { stage: 1, issues: [{ severity: 'FAIL', code: 'FAIL_Missing_Peak_Headers', sampleName: '<script>bad</script>', sourceRow: 6, nextSectionRow: 7, sectionEmpty: true, missingHeaders: ['Peak#', 'Area'] }] } }
    const render = language => renderToStaticMarkup(React.createElement(Details, { error, language, downloadUrl: 'blob:test', downloadName: 'partial.zip' }))
    const zh = render('zh')
    assert.match(zh, /整段峰面积数据/)
    assert.match(zh, /重新导出/)
    assert.match(zh, /<details/)
    assert.match(zh, /download="partial.zip"/)
    assert.match(zh, /&lt;script&gt;bad&lt;\/script&gt;/)
    assert.doesNotMatch(zh, /<script>bad/)
    assert.match(render('en'), /entire peak-area table/)
    const cancelled = renderToStaticMarkup(React.createElement(Details, { error: { code: 'ANALYSIS_CANCELLED', message: 'Cancelled' }, cancelled: true }))
    assert.match(cancelled, /分析已取消/)
    assert.doesNotMatch(cancelled, /建议处理/)
  } finally { await vite.close() }
})
