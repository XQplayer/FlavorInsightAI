import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
test('real evidence UI renders bilingual non-AI boundary, frozen run metadata, citations and report controls',async t=>{
  const vite=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
  t.after(()=>vite.close());
  const {default:ResultsPanel}=await vite.ssrLoadModule('/src/components/analysis/ResultsPanel.jsx');
  const dataset=JSON.parse(readFileSync(new URL('../../../services/analysis/tests/fixtures/synthetic-3groups.json',import.meta.url)));
  const props={dataset,recipe:{schemaVersion:1},analysis:{method:'compare'},t:(en)=>en,onRetry(){}};
  const empty=renderToStaticMarkup(React.createElement(ResultsPanel,{...props,runs:[]}));
  assert.match(empty,/Local evidence query — not AI-generated/);
  assert.match(empty,/本地证据查询（非AI生成）/);
  assert.match(empty,/Dataset only — no actual run result/);
  const run={id:'frozen-run',status:'completed',request:{dataset,recipe:props.recipe,analysis:props.analysis},result:{schemaVersion:1,method:'compare',provenance:{datasetId:dataset.id,recipeApplied:false},data:{results:[]}}};
  const html=renderToStaticMarkup(React.createElement(ResultsPanel,{...props,runs:[run]}));
  assert.match(html,/not independently verified/);
  assert.match(html,/Show source excerpt/);
  assert.match(html,/Export report ZIP/);
  assert.match(html,/frozen-run/);
  assert.doesNotMatch(html,/dangerouslySetInnerHTML|<iframe/);
});
test('project switching explicitly resets results and local query component context',()=>{
  const source=readFileSync(new URL('../pages/DataAnalysisPage.jsx',import.meta.url),'utf8');
  assert.match(source,/<ResultsPanel key=\{w.contextId\}/);
});
test('closed report preview does not eagerly compose full result tables',()=>{
  const source=readFileSync(new URL('../components/analysis/AnalysisReport.jsx',import.meta.url),'utf8');
  assert.match(source,/open\s*\?\s*composeReport\(run\)\s*:\s*null/);
});
