import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runFixture} from '../../frontend/src/analysis/evidenceFixture.mjs';

test('actual IndexedDB save/reopen plus portable restore preserves a completed run with broker cleanup warning',{timeout:30000},async t=>{
  const {chromium}=createRequire(process.env.ANALYSIS_PLAYWRIGHT_PACKAGE||'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
  const {createServer}=await import(pathToFileURL(createRequire(new URL('../../frontend/package.json',import.meta.url)).resolve('vite')).href);
  const vite=await createServer({root:fileURLToPath(new URL('../../frontend',import.meta.url)),configFile:false,appType:'custom',logLevel:'silent',server:{host:'127.0.0.1',port:0},plugins:[{
    name:'local-restore-regression',configureServer(server){server.middlewares.use((req,res,next)=>{
      if(req.url!=='/restore.html')return next();
      res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated restore regression</title>');
    });},
  }]});
  t.after(()=>vite.close());await vite.listen();
  const browser=await chromium.launch({headless:true,executablePath:process.env.ANALYSIS_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/restore.html`);
  const run=runFixture();run.logs=['legacy status',{code:'TEMP_CLEANUP_FAILED'}];
  const answer=await page.evaluate(async run=>{
    const [{createDatasetStore},{restoreSettings},{exportProject,importProject}]=await Promise.all([
      import('/src/analysis/storage.mjs'),import('/src/analysis/workbench.mjs'),import('/src/analysis/exports.mjs'),
    ]);
    const databaseName='isolated-cleanup-warning-regression';
    const store=createDatasetStore({databaseName});
    await store.save(run.request.dataset,{schemaVersion:1,runs:[run]});await store.close();
    const reopened=createDatasetStore({databaseName});
    try {
      const entry=await reopened.load(run.request.dataset.id);
      const saved=restoreSettings(entry.settings);
      const portable=importProject(exportProject(entry.dataset,saved));
      return {saved:saved.runs[0],portable:restoreSettings(portable.settings).runs[0]};
    }finally {await reopened.close();}
  },run);
  for(const restored of [answer.saved,answer.portable]){
    assert.equal(restored.status,'completed');assert.deepEqual(restored.logs,run.logs);assert.deepEqual(restored.result,run.result);
  }
});
