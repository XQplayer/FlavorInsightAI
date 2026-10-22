import test from 'node:test'
import assert from 'node:assert/strict'
import { createDataset } from './dataset.mjs'
import { previewTable } from './imports.mjs'
import { effectiveState, confirmMeasured, metadataPreview, applyMetadata, restoreSettings, isRunStale, defaultRecipe } from './workbench.mjs'
import { exportProject, importProject } from './exports.mjs'
import { runFixture } from './evidenceFixture.mjs'
const fixture = () => createDataset({ samples:[{id:'s1',name:'same'},{id:'s2',name:'same'}], features:[{id:'f'}], matrix:[[1],[2]], provenance:{source:'table-import'}, quality:{qcFilteredMask:[[true],[false]]} })
test('quality masks dominate and measured confirmation cannot revive protected cells', () => {
 const d=fixture(), next=confirmMeasured(d)
 assert.equal(effectiveState(next,0,0),'qc-filtered'); assert.equal(effectiveState(next,1,0),'observed')
 assert.notEqual(next.id,d.id); assert.equal(next.provenance.parentId,d.id)
 assert.throws(()=>confirmMeasured(createDataset({...d,provenance:{source:'shimadzu-verified-archive'}})),/TABLE_IMPORT_ONLY/)
})
test('metadata exact matching rejects ambiguous names and duplicates before apply',()=>{
 const d=fixture(); assert.ok(metadataPreview(d,'name,group\nsame,A').errors.length)
 assert.ok(metadataPreview(d,'id,group\ns1,A\ns1,B').errors.length)
 const preview=metadataPreview(d,'id,group,biologicalUnitId\ns1,A,u1\ns2,B,u2')
 assert.deepEqual(preview.errors,[]); const next=applyMetadata(d,preview.samples,false)
 assert.equal(next.samples[0].group,'A'); assert.equal(next.provenance.independenceConfirmed,false)
})
test('restored settings reject unknown fields and malformed runs; active runs become interrupted',()=>{
 assert.throws(()=>restoreSettings({url:'https://evil.invalid'}),/SETTINGS/)
 assert.throws(()=>restoreSettings({runs:[{status:'completed'}]}),/RUN/)
 const d=fixture(), request={dataset:d,recipe:defaultRecipe(),analysis:{method:'pca'}}
 const restored=restoreSettings({runs:[{id:'x',status:'running',request}]})
 assert.equal(restored.runs[0].status,'interrupted')
 assert.equal(isRunStale(restored.runs[0],d,request.recipe,request.analysis),false)
 assert.equal(isRunStale(restored.runs[0],confirmMeasured(d),request.recipe,request.analysis),true)
})
test('untrusted settings have safe complete UI types and completed lineage',()=>{
 for(const analysis of [{method:'plsda',groups:'x'},{method:'plsda',classOrder:{}},{method:'compare',comparisons:[{}]},{method:'pca',center:'auto'}])assert.throws(()=>restoreSettings({analysis}),/SETTINGS/)
 assert.equal(restoreSettings({recipe:{scale:{method:'uv'}}}).recipe.filter.allMissing,'error')
 assert.throws(()=>restoreSettings({recipe:{normalize:{featureId:{}}}}),/SETTINGS/)
 const d=fixture();assert.throws(()=>restoreSettings({runs:[{id:'r',status:'completed',request:{dataset:d,recipe:defaultRecipe(),analysis:{method:'pca'}},result:{schemaVersion:1,method:'pca',data:{},provenance:{datasetId:'other'}}}]}),/RUN/)
 assert.throws(()=>restoreSettings({runs:[{id:'r',status:'failed',requestHash:{evil:true},request:{dataset:d,recipe:defaultRecipe(),analysis:{method:'pca'}}}]}),/RUN/)
 for(const patch of [{error:{code:{evil:true}}},{logs:[{}]}])assert.throws(()=>restoreSettings({runs:[{id:'r',status:'failed',...patch,request:{dataset:d,recipe:defaultRecipe(),analysis:{method:'pca'}}}]}),/RUN/)
 assert.throws(()=>restoreSettings({analysis:{method:'compare',test:'unknown'}}),/SETTINGS/)
 assert.throws(()=>restoreSettings({recipe:{scale:{method:'magic'}}}),/SETTINGS/)
})
test('raw QC and original imputation cannot be confirmed observed through unknown masks',()=>{
 const d=createDataset({...fixture(),quality:{cellStates:[['qc-filtered'],['original-imputed']],unknownSourceMask:[[true],[true]]}})
 assert.equal(effectiveState(d,0,0),'qc-filtered');const next=confirmMeasured(d)
 assert.equal(effectiveState(next,0,0),'qc-filtered');assert.notEqual(effectiveState(next,1,0),'observed')
})
test('unmapped import fields remain serializable through stored run requests',()=>{
 const d=previewTable([['name','s1'],['f1',1]],{headerRow:0,orientation:'features-rows',sampleColumns:[1],nameColumn:0,casColumn:undefined}).dataset
 assert.equal(Object.hasOwn(d.provenance.config,'casColumn'),false)
 assert.equal(restoreSettings({runs:[{id:'r',status:'failed',request:{dataset:d,recipe:defaultRecipe(),analysis:{method:'pca'}}}]}).runs.length,1)
})
test('preprocessing freshness depends on dataset and recipe, not selected downstream analysis',()=>{
 const d=fixture(),recipe=defaultRecipe(),run={request:{dataset:d,recipe,analysis:{method:'preprocess'}}}
 assert.equal(isRunStale(run,d,recipe,{method:'pca'}),false)
 assert.equal(isRunStale(run,d,recipe,{method:'compare',test:'welch'}),false)
 assert.equal(isRunStale(run,confirmMeasured(d),recipe,{method:'pca'}),true)
 assert.equal(isRunStale(run,d,{...recipe,scale:{method:'uv',axis:'feature'}},{method:'pca'}),true)
 const pca={request:{dataset:d,recipe,analysis:{method:'pca'}}}
 assert.equal(isRunStale(pca,d,recipe,{method:'pca',components:1}),true)
})

test('completed broker cleanup warning survives restore and portable export/import unchanged',()=>{
 const run=runFixture();run.logs=['legacy status',{code:'TEMP_CLEANUP_FAILED'}]
 const settings={schemaVersion:1,runs:[run]}
 const restored=restoreSettings(settings)
 assert.deepEqual(restored.runs[0].logs,run.logs)
 assert.deepEqual(restored.runs[0].result,run.result)
 assert.notEqual(restored.runs[0].logs[1],run.logs[1])
 const project=importProject(exportProject(run.request.dataset,settings))
 const portable=restoreSettings(project.settings)
 assert.equal(portable.runs[0].status,'completed')
 assert.deepEqual(portable.runs[0].logs,run.logs)
 assert.deepEqual(portable.runs[0].result,run.result)
})

test('restoration rejects malformed log objects and raw or unrecognized code payloads',()=>{
 for(const logs of [{},[null],[[]],[1],[{}],[{code:123}],[{code:'UNKNOWN_WARNING'}],[{code:'TEMP_CLEANUP_FAILED',message:'raw secret'}],[{code:'TEMP_CLEANUP_FAILED',path:'private-path'}],[{code:{raw:'secret'}}]]) {
  const run=runFixture();run.logs=logs
  assert.throws(()=>restoreSettings({runs:[run]}),/RUN/)
 }
})
