import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runFixture} from '../../frontend/src/analysis/evidenceFixture.mjs';

test('real evidence renders reuse query results for draft/citation changes but refresh query/page/context', {timeout:45000}, async t=>{
  const {chromium}=createRequire(process.env.ANALYSIS_PLAYWRIGHT_PACKAGE||'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
  const root=fileURLToPath(new URL('../../frontend',import.meta.url));
  const {createServer}=await import(pathToFileURL(createRequire(new URL('../../frontend/package.json',import.meta.url)).resolve('vite')).href);
  const fixture=runFixture();fixture.request.dataset.quality.__memoProbe='quality';
  const vite=await createServer({root,logLevel:'silent',server:{host:'127.0.0.1',port:0},plugins:[{
    name:'evidence-memo-regression-harness',enforce:'pre',
    transform(code,id){
      // Count calls without replacing the real query implementation or changing production code.
      if(id.replaceAll('\\','/').endsWith('/src/analysis/evidence.mjs'))return code.replace('const base={context:ctx.metadata', 'globalThis.__evidenceQueryCalls = (globalThis.__evidenceQueryCalls || 0) + 1;\n  const base={context:ctx.metadata');
    },
    resolveId(id){if(id==='virtual:evidence-memo-harness')return '\0evidence-memo-harness';},
    load(id){if(id==='\0evidence-memo-harness')return `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import EvidenceAssistant from '/src/components/analysis/EvidenceAssistant.jsx';
      const seed=${JSON.stringify(fixture)};
      seed.request.dataset.quality.cellStates.__memoProbe='quality';
      function Harness(){
        const [run,setRun]=useState(seed);
        return React.createElement(React.Fragment,null,
          React.createElement('button',{onClick:()=>setRun(old=>({...old,request:{...old.request,dataset:{...old.request.dataset,id:'next-dataset'}},result:{...old.result,provenance:{...old.result.provenance,datasetId:'next-dataset'}}}))},'Change bound context'),
          React.createElement(EvidenceAssistant,{run,t:en=>en}));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Harness));
    `;},
    configureServer(server){server.middlewares.use(async(req,res,next)=>{
      if(!req.url?.endsWith('/__evidence_memo.html'))return next();
      const html=await server.transformIndexHtml(req.url,'<!doctype html><html><body><div id="root"></div><script type="module" src="/@id/virtual:evidence-memo-harness"></script></body></html>');
      res.setHeader('Content-Type','text/html');res.end(html);
    });},
  }]});
  t.after(()=>vite.close());await vite.listen();
  const browser=await chromium.launch({headless:true,executablePath:process.env.ANALYSIS_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(()=>browser.close());
  const context=await browser.newContext(),page=await context.newPage();
  await page.addInitScript(()=>{
    const stringify=JSON.stringify;
    globalThis.__evidenceSerializations={quality:0,dataset:0};
    JSON.stringify=function(value,...args){
      if(value?.__memoProbe==='quality')globalThis.__evidenceSerializations.quality++;
      if(value?.matrix&&value?.quality?.__memoProbe==='quality')globalThis.__evidenceSerializations.dataset++;
      return stringify.call(JSON,value,...args);
    };
  });
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/FlavorInsightAI/__evidence_memo.html`);
  await page.getByRole('region',{name:'Local evidence query',exact:true}).waitFor();
  const calls=()=>page.evaluate(()=>globalThis.__evidenceQueryCalls);
  const serializations=()=>page.evaluate(()=>globalThis.__evidenceSerializations);
  const baseline=await calls();assert.equal(baseline,1);
  const input=page.getByRole('textbox',{name:'Exact command, feature ID, CAS or name',exact:true});
  await input.pressSequentially('quality');
  assert.equal(await calls(),baseline,'typing draft must not rescan bound evidence');
  await page.getByRole('button',{name:/^Show source excerpt:/}).first().click();
  await page.getByRole('region',{name:'Source excerpt',exact:true}).waitFor();
  assert.equal(await calls(),baseline,'opening citation must not rescan evidence');
  await page.getByRole('button',{name:'Close source excerpt',exact:true}).click();
  assert.equal(await calls(),baseline,'closing citation must not rescan evidence');
  await page.getByRole('button',{name:'Query local evidence',exact:true}).click();
  assert.equal(await calls(),baseline+1,'submitted query must refresh');
  const qualityCount=(await serializations()).quality;assert.ok(qualityCount>0);
  await input.pressSequentially('x');
  assert.equal((await serializations()).quality,qualityCount,'draft edits must not serialize the same source-quality value again');
  await page.getByRole('button',{name:/^Show source excerpt:/}).first().click();
  const sourceCount=(await serializations()).dataset;assert.ok(sourceCount>0);
  await input.pressSequentially('y');
  assert.equal((await serializations()).dataset,sourceCount,'draft edits must not serialize the same source excerpt again');
  assert.equal(await calls(),baseline+1,'draft and citation changes must not rescan quality');
  await page.getByRole('button',{name:'Change bound context',exact:true}).click();
  assert.equal(await calls(),baseline+2,'new context must refresh even when run ID is unchanged');
  assert.equal((await serializations()).quality,qualityCount+1,'new quality object must serialize');
  await page.getByRole('button',{name:/^Show source excerpt:/}).first().click();
  assert.equal((await serializations()).dataset,sourceCount+1,'new source excerpt object must serialize');
  await page.getByRole('button',{name:'Close source excerpt',exact:true}).click();
  await page.getByRole('button',{name:'comparisons',exact:true}).click();
  assert.equal(await calls(),baseline+3,'quick query must refresh');
  await page.getByRole('button',{name:'Next evidence page',exact:true}).click();
  assert.equal(await calls(),baseline+4,'evidence page must refresh');
  assert.match(await page.getByRole('region',{name:'Local evidence query',exact:true}).innerText(),/next-dataset/);
  assert.deepEqual(errors,[]);
});
