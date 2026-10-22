// Isolated local QA only: never opens an existing profile or starts/stops services.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../..',import.meta.url));
const runtime=process.env.ANALYSIS_PLAYWRIGHT_PACKAGE||'C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json';
const {chromium}=createRequire(runtime)('playwright');
const base=process.env.ANALYSIS_BASE_URL||'http://127.0.0.1:5180/FlavorInsightAI/data-analysis/';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'QA must target a local frontend');
const output=path.resolve(process.env.ANALYSIS_QA_OUTPUT||path.join(root,'outputs/analysis-workbench-qa'));
await mkdir(output,{recursive:true});
const result={startedAt:new Date().toISOString(),base,checks:[],runs:[],limitations:['PLS/OPLS zero-permutation smoke tests are NOT permutation validation.','Isolated fresh Chrome context; no user profile or authentication bypass.']};
const browser=await chromium.launch({headless:true,executablePath:process.env.ANALYSIS_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let context,page;
const pageErrors=[],requests=[];
const button=name=>page.getByRole('button',{name,exact:true});
const select=(name,value)=>page.getByRole('combobox',{name,exact:true}).selectOption(value);
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const check=name=>page.getByRole('checkbox',{name,exact:true}).check();
const pass=(name,details={})=>{result.checks.push({name,status:'PASS',...details});console.log(`PASS ${name}`);};
let downloadIndex=0;
async function download(name){
  const pending=page.waitForEvent('download');await button(name).click();const file=await pending;
  const target=path.join(output,`${++downloadIndex}-${file.suggestedFilename().replace(/[^a-zA-Z0-9._-]/g,'_')}`);
  await file.saveAs(target);return {path:target,bytes:await readFile(target)};
}
async function portable(){return JSON.parse((await download('Export portable project')).bytes.toString());}
async function confirmImport(){
  await check('I reviewed the preview and confirm replacing the current project context.');
  await button('Confirm import').click();
}
async function method(value){await tab('Analysis');await select('Analysis method',value);}
async function actualRun(name='Run analysis',expected='completed'){
  const before=await page.getByRole('combobox',{name:'Run history',exact:true}).locator('option').count();
  await button(name).click();
  await page.waitForFunction(({before})=>{
    const options=[...document.querySelectorAll('select')].find(e=>e.closest('label')?.textContent.startsWith('Run history'))?.options;
    return options&&options.length>before&&/ · (completed|failed|cancelled) · /.test(options[options.length-1].textContent);
  },{before},{timeout:240000});
  // The selected run defaults to the newest; select explicitly for reproducible QA.
  const history=page.getByRole('combobox',{name:'Run history',exact:true});
  const options=await history.locator('option').evaluateAll(nodes=>nodes.map(n=>({value:n.value,text:n.textContent})));
  await history.selectOption(options.at(-1).value);
  const run=JSON.parse((await download('Export raw result & audit JSON')).bytes.toString());
  assert.equal(run.status,expected,JSON.stringify(run.error));
  result.runs.push({id:run.id,method:run.request.analysis.method,status:run.status,requestHash:run.requestHash,provenance:run.result?.provenance,error:run.error});
  return run;
}
async function confirmIndependent(){
  await tab('Data & groups');
  await check('I explicitly confirm the declared biological units are independent for the intended design.');
  await button('Apply metadata snapshot').click();
}
async function pair(){await button('Add comparison').click();await select('1 Control','Control');await select('1 Treatment','TreatmentA');}
async function evidence(query){await page.getByRole('textbox',{name:'Exact command, feature ID, CAS or name',exact:true}).fill(query);await button('Query local evidence').click();}

try {
  context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  await page.goto(base);await page.getByRole('heading',{name:'Data analysis',exact:true}).waitFor();
  await page.getByText('Compute service: Ready',{exact:true}).waitFor();
  pass('fresh local Chrome and normal compute session available');
  // Real paste + explicit mapping; no state injection.
  const csv='Sample,Group,Unit,F1,F2\ns1,Control,u1,1,8\ns2,Control,u2,2,7\ns3,Control,u3,3,6\ns4,TreatmentA,u4,4,5\ns5,TreatmentA,u5,5,4\ns6,TreatmentA,u6,6,3';
  await page.getByRole('textbox',{name:'Paste a delimited table',exact:true}).fill(csv);
  await button('Read pasted table').click();await select('Orientation','samples-rows');
  await select('Sample name column','0');await select('Group column','1');await select('Biological unit ID column','2');
  await page.getByRole('listbox',{name:'Measurement columns — select explicitly (Ctrl / Command for multiple)',exact:true}).selectOption(['3','4']);
  await button('Preview mapped data').click();await confirmImport();
  let project=await portable();assert.equal(project.dataset.samples.length,6);assert.equal(project.dataset.features.length,2);
  assert.ok(project.dataset.quality.cellStates.flat().every(x=>x==='unknown'));
  await method('compare');await pair();let run=await actualRun('Run analysis','failed');assert.equal(run.error.code,'INDEPENDENCE_REQUIRED');
  await confirmIndependent();await tab('Analysis');run=await actualRun();assert.ok(run.result.data.results.every(r=>r.p===null));
  pass('unknown source values not treated as measured; independent-unit gate enforced');
  await tab('Data & groups');await check('I confirm eligible finite unknown values in this generic table are measured observations, not prior imputations. Protected QC/imputed states remain excluded.');await button('Apply measured-value confirmation').click();
  await page.getByText('Bulk metadata import (exact unique ID or name)',{exact:true}).click();
  await page.getByRole('textbox',{name:'Paste metadata',exact:true}).fill('name\tgroup\tbiologicalUnitId\ns1\tControl\tu1\ns2\tControl\tu2\ns3\tControl\tu3\ns4\tTreatmentA\tu4\ns5\tTreatmentA\tu5\ns6\tTreatmentA\tu6');
  await button('Preview metadata').click();await button('Use preview as draft').click();
  await tab('Analysis');assert.equal(await button('Run analysis').isDisabled(),true);
  await confirmIndependent();await tab('Analysis');run=await actualRun();assert.ok(run.result.data.results.every(r=>r.nControl===3&&r.nTreatment===3));
  assert.equal(run.result.provenance.recipeApplied,false);pass('explicit measured confirmation, bulk metadata preview/apply and observed-only comparison');

  await button('Load SYNTHETIC example (not scientific evidence)').click();project=await portable();
  assert.equal(project.dataset.samples.length,24);assert.equal(project.dataset.features.length,8);assert.equal(project.dataset.provenance.independenceConfirmed,false);
  await confirmIndependent();
  await tab('Preprocess');await select('Scaling','uv');run=await actualRun('Run real preprocessing preview');assert.equal(run.result.method,'preprocess');pass('real fixed-order preprocessing on marked SYNTHETIC fixture');
  for(const m of ['pca','heatmap','compare','correlation','distribution']){
    await method(m);if(m==='compare')await pair();run=await actualRun();assert.equal(run.result.method,m);
    if(m==='pca'){
      assert.equal(run.result.data.featureIds.length,8);
      await evidence(project.dataset.features[0].id);await page.getByText(/loadings · \/result\/data\/loadings/).first().waitFor();
      for(const name of ['Full tables CSV ZIP','Full tables XLSX','Reproduction bundle + R runner'])await download(name);
    }
    if(m==='compare'){
      await button('comparisons').click();assert.match(await page.getByRole('region',{name:'Local evidence query',exact:true}).innerText(),/\/result\/data\/results\/0/);
      await page.getByRole('button',{name:/^Show source excerpt:/}).first().click();await page.getByRole('region',{name:'Source excerpt',exact:true}).waitFor();
      await button('Close source excerpt').click();
      const zipped=await download('Export report ZIP');const JSZip=createRequire(path.join(root,'frontend/package.json'))('jszip');const zip=await JSZip.loadAsync(zipped.bytes);
      assert.equal(JSON.parse(await zip.file('result.json').async('string')).id,run.id);assert.ok(zip.file('report.html'));assert.ok(zip.file('report.md'));
      const manifest=JSON.parse(await zip.file('table-manifest.json').async('string'));assert.equal(manifest.find(t=>t.table==='data.results').rows,run.result.data.results.length);
    }
    pass(`actual ${m} result and bound evidence`);
  }
  await method('compare');await select('Test','anova');for(const group of ['Control','TreatmentA','TreatmentB'])await check(group);
  run=await actualRun();assert.equal(run.result.data.results.length,8);assert.ok(run.result.data.posthoc.length>0);pass('actual multigroup ANOVA and posthoc tables');
  for(const m of ['plsda','oplsda']){
    await method(m);for(const group of m==='plsda'?['Control','TreatmentA','TreatmentB']:['Control','TreatmentA'])await check(group);
    await page.getByRole('spinbutton',{name:'Outer folds',exact:true}).fill('2');await page.getByRole('spinbutton',{name:'Inner folds',exact:true}).fill('2');
    await page.getByRole('spinbutton',{name:'Permutations (200 default; 1000 supported)',exact:true}).fill('0');
    await page.getByRole('textbox',{name:'Predictive candidate grid (comma-separated)',exact:true}).fill('1');
    run=await actualRun();assert.ok(run.result.data.validation);assert.ok(run.result.data.fullFit);pass(`actual ${m} nested-validation smoke ONLY, zero permutations`);
  }
  // Preserve run before settings edit; old run must stay frozen and visibly stale.
  const boundId=run.request.dataset.id;
  await tab('Preprocess');await select('Scaling','center');await tab('Results');await page.getByText(/STALE: bound to an older snapshot or settings/).waitFor();
  await evidence('summary');assert.ok((await page.getByRole('region',{name:'Local evidence query',exact:true}).innerText()).includes(boundId));pass('stale settings banner and frozen run evidence');
  const portableFile=await download('Export portable project');project=JSON.parse(portableFile.bytes.toString());
  await page.reload();await page.getByRole('heading',{name:'Data analysis',exact:true}).waitFor();
  await page.getByText('Saved local snapshots',{exact:true}).click();await select('Snapshot to restore',project.dataset.id);await button('Restore snapshot').click();await tab('Results');
  assert.equal(await page.getByRole('combobox',{name:'Run history',exact:true}).locator('option').count(),project.settings.runs.length);pass('browser IndexedDB save/reload/restore');
  await tab('Data & groups');await page.getByLabel('XLSX / CSV / TSV / ZIP / project JSON',{exact:true}).setInputFiles(portableFile.path);await confirmImport();await tab('Results');
  assert.equal(await page.getByRole('combobox',{name:'Run history',exact:true}).locator('option').count(),project.settings.runs.length);pass('portable project file import restores complete run context');
  // Genuine long job, cancelled through normal authenticated UI action.
  await tab('Analysis');await page.getByRole('spinbutton',{name:'Permutations (200 default; 1000 supported)',exact:true}).fill('200');
  await button('Run analysis').click();await button('Cancel active job').waitFor();await button('Cancel active job').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('select option')].some(n=>/OPLSDA/i.test(n.textContent)&&/ · cancelled · /.test(n.textContent)),undefined,{timeout:45000});
  pass('actual 200-permutation job cancellation (not completed validation)');
  const history=page.getByRole('combobox',{name:'Run history',exact:true});
  const completed=await history.locator('option').evaluateAll(nodes=>nodes.filter(n=>/ · completed · /.test(n.textContent)).map(n=>n.value));await history.selectOption(completed.at(-1));
  const startRequests=requests.length;await context.setOffline(true);
  await evidence('Why does ethanol cause aroma?');await page.getByText('No local evidence for this query. No answer inferred.',{exact:true}).waitFor();
  await evidence('methods');await page.getByRole('button',{name:/^Show source excerpt:/}).first().waitFor();
  await download('Export report ZIP');await context.setOffline(false);
  assert.deepEqual(requests.slice(startRequests),[]);pass('offline deterministic query/report and unsupported causal query; no model calls');
  await button('New / clear project context').click();await tab('Results');assert.equal(await page.getByRole('region',{name:'Local evidence query',exact:true}).count(),0);
  await button('Load SYNTHETIC example (not scientific evidence)').click();await tab('Results');
  await page.getByText('Dataset only — no actual run result',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Exact command, feature ID, CAS or name',exact:true}).inputValue(),'');
  await button('comparisons').click();await page.getByText('No local evidence for this query. No answer inferred.',{exact:true}).waitFor();pass('new/switch project clears local query and run evidence');
  if(process.env.ANALYSIS_HD_ARCHIVE){
    await tab('Data & groups');await select('Shimadzu ZIP matrix (required)','before-cv');await page.getByLabel('XLSX / CSV / TSV / ZIP / project JSON',{exact:true}).setInputFiles(process.env.ANALYSIS_HD_ARCHIVE);await confirmImport();
    project=await portable();assert.equal(project.dataset.samples.length,18);assert.equal(project.dataset.features.length,124);assert.equal(project.dataset.provenance.independenceConfirmed,false);
    await tab('Preprocess');await select('All-missing features','drop');await select('Fill method','median');await actualRun('Run real preprocessing preview');await method('pca');run=await actualRun();
    assert.equal(run.result.data.featureIds.length,93);assert.equal(run.result.data.rank,17);pass('read-only real HD before-cv archive, 18x124 -> 93 exploratory features / rank17');
  }else result.checks.push({name:'real HD archive',status:'SKIPPED',reason:'ANALYSIS_HD_ARCHIVE not provided; no real-data claim.'});
  assert.deepEqual(pageErrors,[]);pass('no uncaught page errors');
  result.status='PASS';await page.screenshot({path:path.join(output,'final.png'),fullPage:true});
}catch(error){result.status='FAIL';result.error=String(error.stack||error);console.error(result.error);if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{
  result.finishedAt=new Date().toISOString();result.pageErrors=pageErrors;
  // Do not record session headers, tokens or arbitrary request payloads.
  try {await writeFile(path.join(output,'acceptance.json'),JSON.stringify(result,null,2));}
  finally {try {await context?.close();}finally {await browser.close();}}
  console.log(`Acceptance ${result.status}: ${path.join(output,'acceptance.json')}`);
}
