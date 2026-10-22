import test from 'node:test';
import assert from 'node:assert/strict';
import { composeReport, createReportBundle } from './report.mjs';
import { runFixture } from './evidenceFixture.mjs';
test('report escapes hostile data and explicitly discloses scientific and provenance limits', () => {
  const run = runFixture();
  run.request.dataset.name = '</pre><script>alert(1)</script><a href="javascript:x">';
  const report = composeReport(run);
  assert.doesNotMatch(report.html, /<script|href="javascript:/);
  assert.match(report.html, /&lt;script&gt;/);
  for (const word of ['SYNTHETIC','not AI-generated','not independently verified','recipeApplied','observed-only','VIP','technical','not held-out','No causal']) assert.ok(report.markdown.includes(word),word);
  assert.match(report.html,/href="result.json"/);
  assert.match(report.markdown,/preview.*20/i);
});
test('report bundle contains complete actual result/request/CSV attachments beyond preview cap', async () => {
  const run=runFixture(), zip=await createReportBundle(run);
  assert.equal(JSON.parse(await zip.file('result.json').async('string')).result.data.results.length,43);
  const manifest=JSON.parse(await zip.file('table-manifest.json').async('string'));
  const comparisons=manifest.find(t=>t.table==='data.results');
  assert.equal(comparisons.rows,43);
  const html=await zip.file('report.html').async('string');
  assert.ok(html.includes(`href="${comparisons.filename}"`));
  assert.ok(zip.file('report.md')); assert.ok(zip.file('request.json'));
});
test('malformed or unsupported report data yields safe fallback and raw JSON attachment', async () => {
  const run=runFixture(); run.result.data={matrix:'unsupported',rowOrder:[0]};
  const report=composeReport(run); assert.ok(report.html);
  const zip=await createReportBundle(run); assert.ok(zip.file('result.json'));
  assert.ok(zip.file('report.html'));
});
test('untrusted source IDs cannot introduce Markdown links and invalid lineage is prominently rejected',async()=>{
  const run=runFixture();run.id='[unsafe](https://example.com/upload)';
  const report=composeReport(run);
  assert.doesNotMatch(report.markdown,/(?<!<pre>)[\n ]Run \[unsafe\]\(https:/);
  assert.ok(report.markdown.includes('<pre>Run '));
  run.result.provenance.datasetId='other';
  const bad=composeReport(run);
  assert.match(bad.html,/INVALID RUN CONTEXT/);
  assert.doesNotMatch(bad.html,/Result table:/);
  const zip=await createReportBundle(run);
  assert.equal(zip.file('table-manifest.json'),null);
  assert.equal(JSON.parse(await zip.file('result.json').async('string')).result.provenance.datasetId,'other');
});
test('report provides a factual overview and bounds total preview sections',()=>{
  const run=runFixture();
  for(let i=0;i<80;i++)run.result.data[`extra${i}`]=[{value:i}];
  const report=composeReport(run);
  assert.equal(report.overview.totalSamples,24);assert.equal(report.overview.includedSamples,24);
  assert.equal(report.overview.features,8);assert.equal(report.overview.method,'compare');
  assert.equal(report.overview.comparisonRows,43);assert.equal(report.overview.recipeApplied,false);
  assert.ok(report.sections.length<=30);assert.match(report.html,/Factual overview/);
  assert.ok((report.html.match(/<section>/g)||[]).length<=30);
});
test('report citations list only existing source pointers and state CSV pointer root',()=>{
  const run=runFixture(),report=composeReport(run);
  assert.ok(!Object.hasOwn(run.result,'preprocessing'));
  assert.doesNotMatch(report.citations,/\/result\/preprocessing/);
  assert.match(report.citations,/relative to \/result/);
});
test('every exported report section including overview budgets all text while JSON remains complete',async()=>{
  const run=runFixture(),name='A'.repeat(20000),longKey='B'.repeat(20000);
  run.request.dataset.name=name;
  run.result.data[longKey]=[{text:'C'.repeat(20000)}];
  const zip=await createReportBundle(run);
  for(const filename of ['report.html','report.md']){
    const report=await zip.file(filename).async('string');
    const sections=[...report.matchAll(/<section>([\s\S]*?)<\/section>/g)];
    assert.ok(sections.length>0);
    for(const [,section] of sections){
      const text=section.replace(/<[^>]*>/g,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
      assert.ok(text.length<=12000,`${filename}: section text length ${text.length}`);
    }
    const overview=sections.find(([,section])=>section.includes('Factual overview'))[1];
    assert.match(overview,/Preview clipped/);
    assert.match(overview,/totalSamples/);assert.match(overview,/24/);
  }
  assert.equal(JSON.parse(await zip.file('request.json').async('string')).dataset.name,name);
  const full=JSON.parse(await zip.file('result.json').async('string'));
  assert.equal(full.request.dataset.name,name);
  assert.equal(full.result.data[longKey][0].text.length,20000);
});
