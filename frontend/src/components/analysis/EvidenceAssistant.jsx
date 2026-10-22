import { useMemo, useState } from 'react';
import { createEvidenceContext, queryEvidence, resolveCitation } from '../../analysis/evidence.mjs';
import { casHref } from '../../analysis/casLink.mjs';
import { DataTable, Field } from './Controls.jsx';

export default function EvidenceAssistant({run,dataset,t}) {
  const ctx=useMemo(()=>createEvidenceContext({run,dataset}),[run,dataset]);
  const [query,setQuery]=useState('summary'),[draft,setDraft]=useState(''),[page,setPage]=useState(0),[citation,setCitation]=useState(null);
  const answer=queryEvidence(ctx,query,{page}),excerpt=citation?resolveCitation(ctx,citation):undefined;
  const ask=value=>{setQuery(value);setPage(0);setCitation(null);};
  return <section className="analysis-section" aria-label="Local evidence query">
    <h3>Local evidence query — not AI-generated / 本地证据查询（非AI生成）</h3>
    <p>{t('Deterministic read-only lookup. No model, keys, network lookup, or new inference.','确定性只读查询，不使用模型、密钥、网络检索，也不重新计算推断统计量。')}</p>
    <p>{ctx.metadata.mode==='dataset-only'?t('Dataset only — no actual run result','仅当前数据集——无实际运行结果'):t('Selected completed run — frozen request and result','选中已完成运行——冻结请求与结果')}</p>
    <DataTable rows={[ctx.metadata]} caption={t('Evidence context','证据上下文')} t={t}/>
    <p>{t('Request hash is reported metadata, not independently verified. Imported portable data are not cryptographically verified.','请求哈希仅为记录的元数据，未独立验证；导入便携项目未经过密码学验证。')}</p>
    <div className="analysis-toolbar">{[['summary','数据概况'],['quality','质量问题'],['comparisons','比较结果'],['methods','分析方法']].map(([en,zh])=><button key={en} onClick={()=>ask(en)}>{t(en,zh)}</button>)}</div>
    <form onSubmit={e=>{e.preventDefault();ask(draft);}}>
      <Field label={t('Exact command, feature ID, CAS or name','精确命令、特征 ID、CAS 或名称')}><input value={draft} onChange={e=>setDraft(e.target.value)} /></Field>
      <button type="submit">{t('Query local evidence','查询本地证据')}</button>
    </form>
    <p>{t('Supported: summary, quality, methods, comparisons, or an exact feature ID/CAS/name. Use feature: before an identity that matches a command. Causal/general questions have no local answer.','支持：summary、quality、methods、comparisons，或精确特征 ID/CAS/名称。身份与命令重名时加 feature: 前缀。因果或常识问题不作答。')}</p>
    {answer.status!=='ok'?<p role="status">{answer.status==='malformed'?t('Malformed result: evidence unavailable. Export raw result & audit JSON for inspection.','结果格式异常：无法查询证据，请导出原始结果及审计 JSON 检查。'):t('No local evidence for this query. No answer inferred.','此查询无本地证据，不推测答案。')}</p>:<>
      <p>{answer.total} {t('actual evidence entries; all accessible by paging. NA is not zero.','条实际证据；可分页访问全部。NA 不等于零。')}</p>
      {answer.entries.map((entry,i)=><article key={`${entry.citation.pointer}-${i}`}>
        <DataTable rows={[entry.value && typeof entry.value==='object' && !Array.isArray(entry.value)?entry.value:{value:entry.value}]} caption={`${entry.kind} · ${entry.citation.pointer}`} t={t}/>
        <button onClick={()=>setCitation(entry.citation)}>{t('Show source excerpt','查看来源片段')}: {entry.citation.runId??entry.citation.datasetId} {entry.citation.pointer}</button>
        {entry.kind==='feature'&&casHref(entry.value.cas,import.meta.env.BASE_URL)&&<a href={casHref(entry.value.cas,import.meta.env.BASE_URL)} target="_blank" rel="noopener noreferrer">{t('Open CAS database search (user initiated; separate evidence)','打开 CAS 数据库搜索（手动触发；独立证据）')}</a>}
      </article>)}
      <div className="analysis-toolbar"><button disabled={!answer.page} onClick={()=>setPage(answer.page-1)}>{t('Previous evidence page','上一证据页')}</button><span>{answer.page+1}/{answer.pages}</span><button disabled={answer.page+1>=answer.pages} onClick={()=>setPage(answer.page+1)}>{t('Next evidence page','下一证据页')}</button></div>
    </>}
    {citation&&<section aria-label="Source excerpt"><h4>{t('Real source excerpt','实际来源片段')}: {citation.pointer}</h4><DataTable rows={[{runId:citation.runId,datasetId:citation.datasetId,JSONPointer:citation.pointer,source:excerpt??'SOURCE_NOT_FOUND'}]} caption={t('Bound local JSON source (complete value paged)','绑定本地 JSON 来源（完整内容分页）')} t={t}/><button onClick={()=>setCitation(null)}>{t('Close source excerpt','关闭来源片段')}</button></section>}
  </section>;
}
