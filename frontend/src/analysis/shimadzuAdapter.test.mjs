import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
const api = await import('./shimadzuAdapter.mjs').catch(() => ({}))
const dirs = ['00_输入配置与清单','01_Hit1整理','02_化合物筛查','03_平行峰面积处理','04_跨样品合并与半定量','05_统计_CV_CAS与QC','06_按矩阵拆分']
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('')
export async function fixture({ status = 'PASS', mutate, imputedStandard = false } = {}) {
  const zip = new JSZip(); const enc = new TextEncoder()
  async function signed(path, value) { const bytes = enc.encode(JSON.stringify(value)); zip.file(path, bytes); zip.file(path.replace(/\.json$/, '.sha256'), await hash(bytes)); return bytes }
  const sampleConfigs = [{sampleName:'S1',sampleGroup:'G',internalStandardCas:'123-96-6'}, {sampleName:'S2',sampleGroup:'G',internalStandardCas:'123-96-6'}]
  const rows = [{'CAS #':'64-17-5', Name:'A','S1（μg/mL）':2,'S2（μg/mL）':4}, {'CAS #':'123-96-6',Name:'IS','S1（μg/mL）':1,'S2（μg/mL）':1}]
  const columns = Object.keys(rows[0])
  for (let i = 0; i < dirs.length; i++) {
    const data = { schemaVersion:`shimadzu-v2-stage${i}-1`, stage:dirs[i], sampleOrder:['S1','S2'], sampleConfigs, issues:[], ...(i===4?{table:{columns,rows},inheritedLogs:{imputedTwoOfThree:[{cas:'64-17-5',targetSample:'S2'}]},concentrationStatus:[]}:{}), ...(i===5?{triplicateAfter:{columns,rows:rows.map(r=>({...r,'S1（μg/mL）': r.Name==='A'?'NA':1}))},cvScreeningExecuted:true,cvReport:[{cas:'64-17-5',sampleNames:['S1']}],groupStatistics:[]}: {}) }
    if (i === 6) data.schemaVersion = 'shimadzu-v2-stage6-split-1'
    if (i === 4 && imputedStandard) { data.sampleCalculations = { S1: {internalStandardAreaStatus:'Imputed_Internal_Standard_Area'} }; data.concentrationStatus = [{cas:'64-17-5',sampleName:'S1',areaStatus:'Measured'}] }
    const bytes = enc.encode(JSON.stringify(data)); zip.file(`${dirs[i]}/data.json`, bytes)
    await signed(`${dirs[i]}/manifest.json`, {schemaVersion:'shimadzu-browser-manifest-1',stage:dirs[i],severity:'PASS',canAdvance:true,outputHashes:[{path:`${dirs[i]}/data.json`,sha256:await hash(bytes),size:bytes.length}]})
  }
  await signed('v2-run.json',{schemaVersion:'shimadzu-browser-run-1',status,name:'Synthetic',completedStages:dirs})
  await signed('完整性验证/v2-completeness-verification.json',{schemaVersion:'shimadzu-v2-completeness-1',status:'PASS',completedStages:dirs})
  if (mutate) await mutate(zip)
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'})
}
test('archive and direct handoff share verified adapter and preserve sample concentrations and masks', async () => {
  assert.equal(typeof api.importShimadzuArchive, 'function')
  const archiveBytes = await fixture(); const pre = await api.importShimadzuArchive(archiveBytes,{selection:'before-cv'})
  const handoff = await api.datasetFromShimadzuResult({archiveBytes},{selection:'before-cv'})
  assert.deepEqual(pre, handoff); assert.deepEqual(pre.matrix,[[2,1],[4,1]])
  assert.equal(pre.features[1].isInternalStandard,true); assert.equal(pre.quality.originalImputedMask[1][0],true)
  assert.equal(pre.samples[0].biologicalUnitId,'')
  const post = await api.importShimadzuArchive(archiveBytes,{selection:'after-cv'})
  assert.equal(post.matrix[0][0],null); assert.equal(post.quality.qcFilteredMask[0][0],true)
  await assert.rejects(api.importShimadzuArchive(archiveBytes,{}), /EXPLICIT_STAGE_SELECTION/)
})
test('rejects incomplete/cancelled/failed archives, tampering, absent manifest outputs, unsafe paths and oversized expansion', async () => {
  assert.equal(typeof api.importShimadzuArchive, 'function')
  for(const status of ['CANCELLED','PARTIAL_FAILED','RUNNING']) await assert.rejects(api.importShimadzuArchive(await fixture({status}),{selection:'before-cv'}), /RUN_NOT_COMPLETE/)
  await assert.rejects(api.importShimadzuArchive(await fixture({mutate:z=>z.file(`${dirs[4]}/data.json`,'{}')}),{selection:'before-cv'}), /HASH_MISMATCH|SIZE_MISMATCH/)
  await assert.rejects(api.importShimadzuArchive(await fixture({mutate:z=>z.remove(`${dirs[2]}/manifest.json`)}),{selection:'before-cv'}), /MISSING_ARCHIVE_ENTRY/)
  await assert.rejects(api.importShimadzuArchive(await fixture({mutate:z=>z.file('../escape','bad')}),{selection:'before-cv'}), /UNSAFE_ZIP_PATH/)
  await assert.rejects(api.importShimadzuArchive(await fixture(),{selection:'before-cv',maxExpandedBytes:10}), /ZIP_EXPANDED_LIMIT/)
})
test('imputed internal-standard denominator marks derived analyte concentration as original-imputed', async () => {
  const d = await api.importShimadzuArchive(await fixture({imputedStandard:true}),{selection:'before-cv'})
  assert.equal(d.quality.originalImputedMask[0][0],true)
  assert.equal(d.quality.cellStates[0][0],'original-imputed')
})
