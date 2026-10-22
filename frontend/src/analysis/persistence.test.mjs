import test from 'node:test'
import assert from 'node:assert/strict'
import { saveStatusForRevision } from './persistence.mjs'

const revision = () => ({dataset:{id:'same-snapshot'},recipe:{},analysis:{method:'compare'},runs:[]})
test('terminal run revision is unsaved immediately, before the debounce starts', () => {
  const previous=revision(),receipt={revision:previous,status:'saved'}
  assert.equal(saveStatusForRevision(previous,receipt),'saved')
  const current={...previous,runs:[{id:'run',status:'completed',result:{}}]}
  assert.equal(saveStatusForRevision(current,receipt),'saving')
  assert.equal(saveStatusForRevision(current,{revision:current,status:'saved'}),'saved')
})
test('only an exact dataset/settings/runs revision can use a save receipt', () => {
  const previous=revision(),receipt={revision:previous,status:'saved'}
  for(const key of ['dataset','recipe','analysis','runs']) {
    const current={...previous,[key]:structuredClone(previous[key])}
    assert.equal(saveStatusForRevision(current,receipt),'saving',key)
    assert.equal(saveStatusForRevision(current,{revision:previous,status:'failed'}),'saving',key)
    assert.equal(saveStatusForRevision(current,{revision:current,status:'failed'}),'failed',key)
  }
  assert.equal(saveStatusForRevision(previous,null),'saving')
  assert.equal(saveStatusForRevision({dataset:null},receipt),'')
})
