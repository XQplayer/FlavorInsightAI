/** Raw arrays stay fully accessible; matrix values are never packed into a truncated cell. */
export function resultTable(values, {name='', context={}}={}) {
  const matrix=values.length>0&&values.every(row=>Array.isArray(row))
  if(!matrix)return {rows:values.map((value,i)=>value!==null&&typeof value==='object'?value:{index:i+1,value})}
  const width=values.reduce((max,row)=>Math.max(max,row.length),0)
  const featureColumns=['matrix','analysisMatrix','cellStates'].includes(name)&&Array.isArray(context.featureIds)&&context.featureIds.every(id=>typeof id==='string')&&context.featureIds.length===width
  const loadingRows=['loadings','orthogonalLoadings'].includes(name)
  const sampleRows=['matrix','analysisMatrix','cellStates','scores','orthogonalScores'].includes(name)
  const rowKey=loadingRows?'featureId':sampleRows?'sampleId':null
  const ids=loadingRows?context.featureIds:sampleRows?context.sampleIds:null
  const identified=rowKey&&Array.isArray(ids)&&ids.length===values.length
  const columns=Array.from({length:width},(_,j)=>`[${j+1}]${featureColumns?' '+context.featureIds[j]:''}`)
  return {
    rows:values.map((row,i)=>({row:i+1,...(identified?{[rowKey]:ids[i]}:{}),...Object.fromEntries(columns.map((key,j)=>[key,row[j]]))})),
    columns:['row',...(identified?[rowKey]:[]),...columns],
    pinnedColumns:['row',...(identified?[rowKey]:[])],
    columnAxis:featureColumns?'featureIds':'one-based column index',
    rowAxis:identified?rowKey:'one-based row index',width,
  }
}
export function pageGroups(groups,query,page,size=30) {
  const filtered=groups.filter(group=>group.toLowerCase().includes(query.toLowerCase()))
  const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.max(0,Math.min(page,pages-1))
  return {items:filtered.slice(current*size,current*size+size),page:current,pages,total:filtered.length}
}
export function toggleGroup(selected,group,include) {
  return include?[...new Set([...selected,group])]:selected.filter(value=>value!==group)
}
export function textPage(text,page,size=500) {
  const pages=Math.max(1,Math.ceil(text.length/size)),current=Math.max(0,Math.min(page,pages-1))
  return {text:text.slice(current*size,current*size+size),page:current,pages}
}
