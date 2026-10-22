import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeJobResponse } from './lifecycle.mjs'
const run=()=>({id:'local',status:'queued',request:{dataset:{id:'snapshot'},analysis:{method:'pca'},recipe:{schemaVersion:1}}})
test('unchanged poll is referentially stable and stale response cannot overwrite terminal state',()=>{
 const original=run(),queued=mergeJobResponse(original,{id:'server',status:'queued',requestHash:'hash'})
 assert.equal(mergeJobResponse(queued,{id:'server',status:'queued',requestHash:'hash'}),queued)
 const cancelled=mergeJobResponse(queued,{id:'server',status:'cancelled'})
 assert.equal(mergeJobResponse(cancelled,{id:'server',status:'running'}),cancelled)
 assert.equal(cancelled.request,original.request)
})
test('completed result cannot bind another dataset/method or malformed result envelope',()=>{
 const complete={id:'server',status:'completed',result:{schemaVersion:1,method:'pca',data:{},provenance:{datasetId:'snapshot'}}}
 assert.equal(mergeJobResponse(run(),complete).result,complete.result)
 assert.throws(()=>mergeJobResponse(run(),{...complete,result:{...complete.result,method:'compare'}}),/RESULT_LINEAGE/)
 assert.throws(()=>mergeJobResponse(run(),{...complete,result:{...complete.result,provenance:{datasetId:'other'}}}),/RESULT_LINEAGE/)
})
