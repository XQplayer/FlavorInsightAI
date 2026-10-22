import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createDataset } from './dataset.mjs'
import { handoffCompletedArchive } from './handoff.mjs'
const api = await import('./archiveImport.mjs').catch(() => ({}))
const source = createDataset({id:'verified-sha-after-cv', name:'Archive', samples:[{id:'s'}], features:[{id:'f'}], matrix:[[null]], quality:{cellStates:[['qc-filtered']]}, provenance:{kind:'shimadzu-archive', selection:'after-cv'}})
const priorSettings = {schemaVersion:1, recipe:{impute:{method:'median'}}, runs:[{id:'old-run',status:'completed',result:{retained:true}}]}
function repository() {
  const entries = new Map([[source.id,{dataset:source,settings:structuredClone(priorSettings)}]])
  return {entries, save:async(dataset, settings={})=>{entries.set(dataset.id,{dataset,settings});return dataset.id}}
}
test('repeated ZIP ingress forks UI snapshots without overwriting stored archive history', async()=>{
  assert.equal(typeof api.importArchiveSnapshot,'function')
  const store=repository(), adapter=async()=>source
  const first=await api.importArchiveSnapshot(new Uint8Array(),{selection:'after-cv'},adapter)
  await store.save(first,priorSettings)
  const second=await api.importArchiveSnapshot(new Uint8Array(),{selection:'after-cv'},adapter)
  await store.save(second)
  assert.equal(new Set([source.id,first.id,second.id]).size,3)
  assert.deepEqual(store.entries.get(source.id).settings,priorSettings)
  assert.deepEqual(store.entries.get(first.id).settings,priorSettings)
  for(const snapshot of [first,second]) {
    assert.equal(snapshot.provenance.sourceSnapshotId,source.id)
    assert.equal(snapshot.provenance.parentId,source.id)
    assert.equal(snapshot.provenance.operation,'archive-import')
    assert.deepEqual(snapshot.matrix,source.matrix)
    assert.deepEqual(snapshot.quality,source.quality)
    assert.equal(Object.isFrozen(snapshot),true)
  }
  await assert.rejects(api.importArchiveSnapshot(new Uint8Array(),{},async()=>{throw Error('HASH_MISMATCH')}),/HASH_MISMATCH/)
  const panel=await readFile(new URL('../components/analysis/ImportPanel.jsx',import.meta.url),'utf8')
  assert.match(panel,/await importArchiveSnapshot\(/)
  assert.match(panel,/settings: restoreSettings\(project.settings\)/)
})
test('re-entering a complete archive preserves pre-existing and previous handoff run history',async()=>{
  const store=repository(), ids=[], args={job:{status:'complete',downloadUrl:'blob:owned'},ownedUrl:'blob:owned',selection:'after-cv',isCurrent:()=>true,store,storage:{setItem:(_key,id)=>ids.push(id)},navigate:()=>{},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),adapter:async()=>source}
  const first=await handoffCompletedArchive(args)
  await store.save(store.entries.get(first).dataset,priorSettings)
  const second=await handoffCompletedArchive(args)
  assert.equal(new Set([source.id,first,second]).size,3)
  assert.deepEqual(ids,[first,second])
  assert.deepEqual(store.entries.get(source.id).settings,priorSettings)
  assert.deepEqual(store.entries.get(first).settings,priorSettings)
  assert.equal(store.entries.get(second).dataset.provenance.sourceSnapshotId,source.id)
})
