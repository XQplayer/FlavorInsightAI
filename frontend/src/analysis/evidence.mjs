import { qualitySummary } from './workbench.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const token = v => String(v).replaceAll('~', '~0').replaceAll('/', '~1');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** A local snapshot, NOT a cryptographic verification of imported portable data. */
export function createEvidenceContext({run, dataset} = {}) {
  const source = structuredClone(run || {request: {dataset}});
  const d = source.request?.dataset;
  const malformed = !!run && (run.status !== 'completed' || !object(run.result?.data) || run.result?.method !== run.request?.analysis?.method || run.result?.provenance?.datasetId !== d?.id);
  return freeze({source, malformed, metadata: {
    mode: run ? 'selected-run' : 'dataset-only', runId: run?.id ?? null,
    datasetId: d?.id ?? null, requestHash: run?.requestHash ?? null,
    requestHashVerified: false, recipeSchemaVersion: source.request?.recipe?.schemaVersion ?? null,
    engineVersion: run?.result?.provenance?.engineVersion ?? null,
    rVersion: run?.result?.provenance?.rVersion ?? null,
    packages: source.result?.provenance?.packages ?? null,
  }});
}
export function resolveCitation(ctx, citation) {
  if (!citation || citation.runId !== ctx.metadata.runId || citation.datasetId !== ctx.metadata.datasetId || typeof citation.pointer !== 'string') return undefined;
  if (citation.pointer === '') return ctx.source;
  if (!citation.pointer.startsWith('/')) return undefined;
  let value = ctx.source;
  for (const part of citation.pointer.slice(1).split('/')) {
    const key = part.replaceAll('~1','/').replaceAll('~0','~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value,key)) return undefined;
    value=value[key];
  }
  return value;
}
function record(ctx, kind, value, pointer) {
  return {kind, value, citation: {runId:ctx.metadata.runId,datasetId:ctx.metadata.datasetId,pointer}};
}
/** Only exact commands / identities are accepted. Never perform statistical inference here. */
export function queryEvidence(ctx, text, {page=0,pageSize=20}={}) {
  const base={context:ctx.metadata,status:'no-local-evidence',entries:[],total:0,page:0,pages:1};
  if(ctx.malformed) return {...base,status:'malformed'};
  const d=ctx.source.request?.dataset;
  if(!d || !Array.isArray(d.features) || !Array.isArray(d.samples)) return base;
  const raw=String(text??'').trim(), explicitFeature=raw.startsWith('feature:'),query=explicitFeature?raw.slice(8):raw, command=explicitFeature?'':query.toLowerCase();
  let entries=[];
  try {
    if(['summary','概况','数据概况'].includes(command)) {
      entries=[record(ctx,'summary',{name:d.name,samples:d.samples.length,includedSamples:d.samples.filter(s=>s.include!==false).length,features:d.features.length,groups:[...new Set(d.samples.filter(s=>s.include!==false).map(s=>s.group))],source:d.provenance},'/request/dataset')];
    } else if(['quality','质量','质量问题'].includes(command)) {
      entries=[record(ctx,'quality',{cellStates:qualitySummary(d),independenceConfirmed:d.provenance?.independenceConfirmed===true,source:d.provenance},'/request/dataset'),record(ctx,'source-quality',d.quality,'/request/dataset/quality')];
      if(ctx.source.result?.preprocessing)entries.push(record(ctx,'preprocessing',ctx.source.result.preprocessing,'/result/preprocessing'));
    } else if(['methods','方法','分析方法'].includes(command)) {
      for(const [kind,pointer,value] of [['analysis','/request/analysis',ctx.source.request.analysis],['recipe','/request/recipe',ctx.source.request.recipe],['provenance','/result/provenance',ctx.source.result?.provenance]])if(value!==undefined)entries.push(record(ctx,kind,value,pointer));
    } else {
      const comparisons=['comparisons','比较','比较结果'].includes(command);
      const matches=comparisons?[]:d.features.map((f,i)=>({f,i})).filter(({f})=>[f.id,f.cas,f.name].some(v=>typeof v==='string'&&v===query));
      const ids=new Set(matches.map(({f})=>f.id));
      entries=matches.map(({f,i})=>record(ctx,'feature',f,`/request/dataset/features/${i}`));
      if(comparisons||ids.size) {
        function visit(value,path) {
          if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${path}/${i}`));
          else if(object(value)) {
            if(!comparisons&&Array.isArray(value.featureIds))for(const id of ids) {
              const j=value.featureIds.indexOf(id);
              if(j<0)continue;
              for(const key of ['loadings','orthogonalLoadings'])if(Array.isArray(value[key])&&value[key].length===value.featureIds.length&&Array.isArray(value[key][j]))entries.push(record(ctx,key,{featureId:id,values:value[key][j]},`${path}/${key}/${j}`));
              for(const key of ['matrix','analysisMatrix'])if(Array.isArray(value[key])&&value[key].every(row=>Array.isArray(row)&&row.length===value.featureIds.length))entries.push(record(ctx,key,{featureId:id,sampleIds:value.sampleIds??null,values:value[key].map(row=>row[j])},`${path}/${key}`));
            }
            if((comparisons&&typeof value.comparison==='string') || (!comparisons&&(ids.has(value.featureId)||ids.has(value.otherFeatureId)))) entries.push(record(ctx,'result',value,path));
            else Object.entries(value).forEach(([k,v])=>visit(v,`${path}/${token(k)}`));
          }
        }
        visit(ctx.source.result?.data,'/result/data');
      }
    }
  } catch { return {...base,status:'malformed'}; }
  const size=Math.max(1,Math.min(100,Number.isInteger(pageSize)?pageSize:20)),pages=Math.max(1,Math.ceil(entries.length/size)),current=Math.max(0,Math.min(Number.isInteger(page)?page:0,pages-1));
  return {...base,status:entries.length?'ok':'no-local-evidence',total:entries.length,page:current,pages,entries:entries.slice(current*size,(current+1)*size)};
}
