export const isTerminal = status => ['completed','failed','cancelled','interrupted'].includes(status)
/** Pure transition: unchanged polling does not enqueue another full snapshot save. */
export function mergeJobResponse(run,job) {
 if(isTerminal(run.status))return run
 if(job.status==='completed'&&(job.result?.schemaVersion!==1||job.result?.method!==run.request.analysis.method||job.result?.provenance?.datasetId!==run.request.dataset.id||!job.result.data||typeof job.result.data!=='object'||Array.isArray(job.result.data)))throw new Error('RESULT_LINEAGE_MISMATCH')
 if(run.id===job.id&&run.status===job.status&&run.requestHash===job.requestHash)return run
 return {...run,...job,request:run.request}
}
