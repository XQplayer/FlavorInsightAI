import test from 'node:test'
import assert from 'node:assert/strict'
import { createAnalysisClient, serviceError } from './client.mjs'
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body})
test('fixed loopback; token only in auth header; no mutation retry on 401',async()=>{
 const calls=[]; const client=createAnalysisClient({fetch:async(url,options)=>{calls.push({url,options}); return calls.length===1?response({token:'secret'}):response({error:{code:'TOKEN_REQUIRED'}},401)}})
 await assert.rejects(client.submit({dataset:{}}),/TOKEN_REQUIRED/)
 assert.equal(calls.length,2); assert.equal(calls[0].url,'http://127.0.0.1:8890/session')
 assert.equal(calls[1].options.headers.Authorization,'Bearer secret')
 assert.ok(!calls[1].options.body.includes('secret'))
})
test('ambiguous POST network failure never resubmits',async()=>{
 let count=0; const client=createAnalysisClient({fetch:async()=>{count++; if(count===1)return response({token:'x'}); throw new TypeError('private text')}})
 await assert.rejects(client.submit({}),/SUBMISSION_UNCERTAIN/); assert.equal(count,2)
 assert.ok(!serviceError(new Error('private text'),'en').includes('private text'))
})
test('read failure and abort are explicit; health capability retained',async()=>{
 const client=createAnalysisClient({fetch:async()=>response({capabilities:{runtimeReady:false,methods:[]}})})
 assert.equal((await client.health()).capabilities.runtimeReady,false)
 const abort=new AbortController();abort.abort(); await assert.rejects(client.health(abort.signal),/ABORTED/)
})
test('successful submission with malformed JSON or job remains uncertain',async()=>{
 for(const invalid of [{ok:true,status:202,json:async()=>{throw Error('broken')}},response({})]){
 let count=0;const client=createAnalysisClient({fetch:async()=>++count===1?response({token:'x'}):invalid})
 await assert.rejects(client.submit({}),/SUBMISSION_UNCERTAIN/);assert.equal(count,2)
 }
})
test('scientific failures retain codes and give actionable bilingual advice',()=>{
 assert.match(serviceError(new Error('INDEPENDENCE_REQUIRED'),'en'),/Apply metadata/)
 assert.match(serviceError(new Error('OUTER_FOLDS_INFEASIBLE'),'zh'),/不会自动减少/)
 assert.match(serviceError(new Error('SUPERVISED_CELL_FIT_BUDGET'),'en'),/budget/)
 assert.match(serviceError(new Error('AMBIGUOUS_COMPARISON_LABEL'),'en'),/group names.*duplicate contrast/i)
 assert.match(serviceError(new Error('AMBIGUOUS_COMPARISON_LABEL'),'zh'),/分组名称.*重复/)
})
test('poll and explicit cancellation reuse the in-memory session and do not submit another job',async()=>{
 const calls=[];const client=createAnalysisClient({fetch:async(url,options)=>{calls.push([url,options.method]);if(url.endsWith('/session'))return response({token:'secret'});return response({id:'job-1',status:options.method==='DELETE'?'cancelled':'running',requestHash:'hash'})}})
 await client.submit({});await client.poll('job-1');assert.equal((await client.cancel('job-1')).status,'cancelled')
 assert.deepEqual(calls.map(c=>c[1]),['POST','POST','GET','DELETE'])
 assert.equal(calls.filter(c=>c[0].endsWith('/jobs')&&c[1]==='POST').length,1)
})
test('DOM AbortError numeric codes do not hide timeout or ambiguous POST state',async()=>{
 const fetch=async(url,{signal})=>url.endsWith('/session')?response({token:'x'}):new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('private','AbortError')),{once:true}))
 await assert.rejects(createAnalysisClient({fetch,timeout:5}).health(),/TIMEOUT/)
 await assert.rejects(createAnalysisClient({fetch,timeout:5}).submit({}),/SUBMISSION_UNCERTAIN/)
 const controller=new AbortController(),pending=createAnalysisClient({fetch,timeout:500}).health(controller.signal)
 controller.abort();await assert.rejects(pending,/ABORTED/)
})
test('abort while establishing session does not dispatch a job afterward',async()=>{
 const controller=new AbortController();let calls=0
 const client=createAnalysisClient({fetch:async()=>{calls++;controller.abort();return response({token:'x'})}})
 await assert.rejects(client.submit({},controller.signal),/ABORTED/);assert.equal(calls,1)
})
