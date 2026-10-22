import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceContext, queryEvidence, resolveCitation } from './evidence.mjs';
import {dataset,runFixture} from './evidenceFixture.mjs';
test('evidence context freezes the selected run, never an edited current dataset', () => {
  const run = runFixture(), current = {...dataset, id: 'new-current'};
  const ctx = createEvidenceContext({run, dataset: current});
  run.request.dataset.name = 'modified';
  const result = queryEvidence(ctx, 'summary');
  assert.equal(result.context.datasetId, dataset.id);
  assert.equal(result.context.runId, 'run-1');
  assert.equal(result.context.requestHashVerified, false);
  assert.equal(result.entries[0].value.samples, 24);
  assert.equal(result.entries[0].value.features, 8);
  assert.notEqual(result.entries[0].value.name, 'modified');
  assert.deepEqual(resolveCitation(ctx, result.entries[0].citation), ctx.source.request.dataset);
});
test('all actual comparison rows remain paged with unchanged p/padj/n/NA reasons', () => {
  const ctx = createEvidenceContext({run: runFixture()});
  const first = queryEvidence(ctx, 'comparisons', {page: 0, pageSize: 20});
  const last = queryEvidence(ctx, 'comparisons', {page: 2, pageSize: 20});
  assert.equal(first.total, 43); assert.equal(first.entries.length, 20); assert.equal(last.entries.length, 3);
  assert.equal(first.entries[0].value.p, null);
  assert.equal(first.entries[0].value.naReason, 'INSUFFICIENT_N');
  assert.equal(last.entries[2].value.padj, 0.4);
  assert.deepEqual(resolveCitation(ctx, last.entries[2].citation), last.entries[2].value);
});
test('exact duplicate name and CAS matches retain stable feature IDs and real evidence pointers', () => {
  const ctx = createEvidenceContext({run: runFixture()});
  for (const q of ['64-17-5', '<script>same</script>']) {
    const answer = queryEvidence(ctx, q, {pageSize: 100});
    const ids = answer.entries.filter(e => e.kind === 'feature').map(e => e.value.id);
    assert.deepEqual(ids, dataset.features.slice(0, 2).map(f => f.id));
    for (const e of answer.entries) assert.notEqual(resolveCitation(ctx, e.citation), undefined);
  }
  assert.equal(queryEvidence(ctx, 'Why does ethanol cause aroma?').status, 'no-local-evidence');
  assert.equal(queryEvidence(ctx, '64-17').status, 'no-local-evidence');
});
test('dataset-only context explicitly has no result and cannot leak previous run', () => {
  const ctx = createEvidenceContext({dataset});
  assert.equal(queryEvidence(ctx, 'summary').context.mode, 'dataset-only');
  assert.equal(queryEvidence(ctx, 'comparisons').status, 'no-local-evidence');
  assert.equal(queryEvidence(createEvidenceContext({}), 'summary').status, 'no-local-evidence');
  assert.equal(resolveCitation(ctx, {pointer: '/request/dataset', runId: 'other', datasetId: dataset.id}), undefined);
});
test('quality and methods expose original source and applied-recipe status only', () => {
  const ctx = createEvidenceContext({run: runFixture()});
  const quality = queryEvidence(ctx, '质量');
  assert.equal(Object.values(quality.entries[0].value.cellStates).reduce((a,b)=>a+b,0),192);
  const methods = queryEvidence(ctx, 'methods');
  assert.equal(methods.entries.find(e=>e.kind==='provenance').value.recipeApplied, false);
  assert.equal(methods.context.engineVersion, '1.0.0');
});
test('malformed run never falls back to current data or fabricates evidence', () => {
  const broken = runFixture(); broken.result.data = 'bad';
  const ctx = createEvidenceContext({run: broken, dataset});
  assert.equal(queryEvidence(ctx,'comparisons').status,'malformed');
  assert.equal(ctx.source.id,'run-1');
});
test('explicit feature prefix resolves command-name collisions and maps actual PCA axes',()=>{
  const run=runFixture();run.request.dataset.features[0].name='summary';
  run.request.analysis.method='pca';run.result.method='pca';
  const ids=run.request.dataset.features.map(f=>f.id);
  run.result.data={featureIds:ids,sampleIds:['s1','s2'],loadings:ids.map((_,i)=>[i,0.5]),matrix:[[1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16]]};
  const ctx=createEvidenceContext({run}),answer=queryEvidence(ctx,'feature:summary');
  assert.equal(answer.entries[0].value.id,ids[0]);
  assert.deepEqual(answer.entries.find(e=>e.kind==='loadings').value.values,[0,0.5]);
  assert.deepEqual(answer.entries.find(e=>e.kind==='matrix').value.values,[1,9]);
  for(const entry of answer.entries)assert.notEqual(resolveCitation(ctx,entry.citation),undefined);
});
test('context package metadata is cloned and never freezes the caller-owned run',()=>{
  const run=runFixture();run.result.provenance.packages={stats:'4.6.0',nested:{version:'1.0'}};
  const ctx=createEvidenceContext({run});
  assert.notEqual(ctx.metadata.packages,run.result.provenance.packages);
  assert.equal(Object.isFrozen(run.result.provenance.packages),false);
  assert.equal(Object.isFrozen(run.result.provenance.packages.nested),false);
  run.result.provenance.packages.nested.version='changed';
  assert.equal(ctx.metadata.packages.nested.version,'1.0');
  assert.equal(Object.isFrozen(ctx.metadata.packages),true);
});
