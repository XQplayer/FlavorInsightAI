import test from 'node:test'
import assert from 'node:assert/strict'
import { handoffCompletedArchive } from './handoff.mjs'
test('handoff requires owned complete blob; navigates only after archive verification and save',async()=>{
 const events=[],job={id:'j',status:'complete',downloadUrl:'blob:owned'}
 const deps={job,ownedUrl:'blob:owned',selection:'after-cv',isCurrent:()=>true,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),adapter:async()=>{events.push('verify');return {id:'d',samples:[{id:'s'}],features:[{id:'f'}],matrix:[[1]],provenance:{}}},store:{save:async()=>events.push('save')},storage:{setItem:(key,id)=>events.push([key,id])},navigate:()=>events.push('navigate')}
 const id=await handoffCompletedArchive(deps);assert.notEqual(id,'d');assert.deepEqual(events,['verify','save',['flavor-analysis-handoff-id',id],'navigate'])
 await assert.rejects(handoffCompletedArchive({...deps,job:{...job,status:'running'}}),/COMPLETE_OWNED_ARCHIVE_REQUIRED/)
 await assert.rejects(handoffCompletedArchive({...deps,isCurrent:()=>false}),/STALE_HANDOFF/)
 events.length=0;await assert.rejects(handoffCompletedArchive({...deps,adapter:async()=>{throw Error('HASH_MISMATCH')}}),/HASH_MISMATCH/);assert.deepEqual(events,[])
 let current=true;events.length=0
 await assert.rejects(handoffCompletedArchive({...deps,isCurrent:()=>current,store:{save:async()=>{current=false;events.push('save')}}}),/STALE_HANDOFF/)
 assert.deepEqual(events,['verify','save'])
})
