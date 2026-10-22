import test from 'node:test'
import assert from 'node:assert/strict'
import { resultTable, pageGroups, toggleGroup, textPage } from './resultTables.mjs'
test('wide raw matrices expose every scalar with stable feature columns and sample identity',()=>{
 const featureIds=Array.from({length:300},(_,i)=>`feature-${i+1}`),matrix=[featureIds.map((_,i)=>i===299?null:i)]
 const table=resultTable(matrix,{name:'matrix',context:{sampleIds:['sample-x'],featureIds}})
 assert.equal(table.rows[0].sampleId,'sample-x');assert.equal(table.rows[0]['[299] feature-299'],298)
 assert.equal(table.rows[0]['[300] feature-300'],null);assert.equal(table.columns.length,302)
 assert.equal(table.columnAxis,'featureIds');assert.equal(table.rows[0].value,undefined)
})
test('scores and loadings do not incorrectly use feature IDs as component axes',()=>{
 const context={sampleIds:['s1','s2'],featureIds:['f1','f2']}
 assert.deepEqual(resultTable([[1],[2]],{name:'scores',context}).columns,['row','sampleId','[1]'])
 assert.equal(resultTable([[1],[2]],{name:'loadings',context}).rows[1].featureId,'f2')
 assert.equal(resultTable([[1,2]],{name:'other',context}).columnAxis,'one-based column index')
})
test('group page stays bounded and off-page selections are preserved explicitly',()=>{
 const groups=Array.from({length:10000},(_,i)=>`group-${i+1}`),selected=['group-1']
 assert.equal(pageGroups(groups,'',0).items.length,30)
 assert.equal(pageGroups(groups,'',9999).page,333)
 assert.deepEqual(pageGroups(groups,'group-10000',0).items,['group-10000'])
 assert.deepEqual(toggleGroup(selected,'group-10000',true),['group-1','group-10000'])
 assert.deepEqual(toggleGroup(selected,'group-10000',false),selected)
 assert.deepEqual(selected,['group-1'])
})
test('long cell values can be read completely through bounded text pages',()=>{
 const text='x'.repeat(1200)+'TAIL',pages=[0,1,2].map(page=>textPage(text,page))
 assert.equal(pages.map(p=>p.text).join(''),text);assert.equal(pages[2].text.endsWith('TAIL'),true)
 assert.ok(pages.every(p=>p.text.length<=500));assert.equal(textPage(text,999).page,2)
})
