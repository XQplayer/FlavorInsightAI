// Synthetic fixture shared by unit tests only. Not imported by application code.
import {readFileSync} from 'node:fs';
export const dataset=JSON.parse(readFileSync(new URL('../../../services/analysis/tests/fixtures/synthetic-3groups.json',import.meta.url)));
export function runFixture(){
  const d=structuredClone(dataset);
  d.features[0]={...d.features[0],name:'<script>same</script>',cas:'64-17-5'};
  d.features[1]={...d.features[1],name:'<script>same</script>',cas:'64-17-5'};
  return {id:'run-1',status:'completed',requestHash:'reported-only',request:{dataset:d,recipe:{schemaVersion:1},analysis:{method:'compare',test:'welch'}},result:{schemaVersion:1,method:'compare',provenance:{datasetId:d.id,engineVersion:'1.0.0',rVersion:'4.6.0',recipeApplied:false},data:{results:Array.from({length:43},(_,i)=>({featureId:d.features[i%2].id,comparison:'B vs A',p:i?0.2:null,padj:i?0.4:null,nControl:8,nTreatment:8,effect:0.12,naReason:i?null:'INSUFFICIENT_N'}))}}};
}
