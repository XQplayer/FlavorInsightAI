# Pure, training-fitted preprocessing. No files, globals, or source mutation.
`%||%` <- function(x,y) if (is.null(x)) y else x
fail <- function(code) stop(code,call.=FALSE)
choice <- function(x, allowed, code) { if(length(x)!=1 || !x %in% allowed) fail(code); x }
as_rows <- function(rows, n, p, mode='numeric') {
  if(length(rows)!=n || any(lengths(rows)!=p)) fail('MATRIX_DIMENSIONS')
  vals<-unlist(lapply(rows,function(r) lapply(r,function(v) if(is.null(v)) NA else v)),recursive=TRUE,use.names=FALSE)
  if(mode=='numeric' && (!is.numeric(vals) && !all(is.na(vals)))) fail('MATRIX_VALUE')
  m<-matrix(vals,n,p,byrow=TRUE); if(mode=='numeric') {storage.mode(m)<-'double';if(any(!is.finite(m)&!is.na(m)))fail('MATRIX_VALUE')};m
}
read_dataset <- function(d) {
  if(!identical(as.integer(d$schemaVersion),1L))fail('SCHEMA_VERSION')
  n<-length(d$samples);p<-length(d$features);if(!n||!p)fail('EMPTY_DATASET')
  ids<-function(items) {z<-vapply(items,function(i)i$id %||% '',character(1));if(any(!nzchar(z))||anyDuplicated(z))fail('INVALID_OR_DUPLICATE_ID');z}
  si<-ids(d$samples);fi<-ids(d$features);x<-as_rows(d$matrix,n,p)
  qs<-d$quality$cellStates
  q<-if(is.null(qs))ifelse(is.na(x),'missing','unknown')else as_rows(qs,n,p,'character')
  if(any(!q %in% c('observed','missing','original-imputed','qc-filtered','unknown')))fail('QUALITY_VALUE')
  protected_qc<-q=='qc-filtered'
  for(k in c('originalImputedMask','unknownSourceMask','qcFilteredMask')) if(!is.null(d$quality[[k]])) {
    z<-as_rows(d$quality[[k]],n,p,'logical');if(anyNA(z)||!is.logical(z))fail('QUALITY_VALUE')
    q[z]<-switch(k,originalImputedMask='original-imputed',unknownSourceMask='unknown',qcFilteredMask='qc-filtered')
    if(k=='qcFilteredMask')protected_qc<-protected_qc|z
  }
  q[protected_qc]<-'qc-filtered'
  x[q%in%c('qc-filtered','missing')]<-NA_real_
  list(x=x,q=q,samples=d$samples,features=d$features,sampleIds=si,featureIds=fi)
}
recipe_defaults <- function(r=list()) {
  defaults<-list(schemaVersion=1,filter=list(includeInternalStandards=FALSE,maxMissing=NULL,missingScope='global',allMissing='error',zeroVariance='keep',allowMixedUnits=FALSE,allowMixedMatrixTypes=FALSE),impute=list(method='none',value=0,k=3),normalize=list(method='none',target=1,featureId=NULL,acknowledgeDoubleNormalization=FALSE),transform=list(method='none',pseudocount=0),scale=list(method='none',axis='feature'))
  if(!is.list(r))fail('INVALID_RECIPE');r<-modifyList(defaults,r)
  if(!identical(as.integer(r$schemaVersion),1L))fail('RECIPE_SCHEMA_VERSION')
  choice(r$impute$method,c('none','constant','median','half-minimum','knn'),'IMPUTE_METHOD')
  choice(r$normalize$method,c('none','sum','median','pqn','internal-standard'),'NORMALIZE_METHOD')
  choice(r$transform$method,c('none','log2','log10','ln','sqrt'),'TRANSFORM_METHOD')
  choice(r$scale$method,c('none','center','uv','pareto','minmax','robust'),'SCALE_METHOD');choice(r$scale$axis,c('feature','sample'),'SCALE_AXIS')
  choice(r$filter$allMissing,c('error','drop'),'ALL_MISSING_POLICY');choice(r$filter$zeroVariance,c('keep','drop'),'ZERO_VARIANCE_POLICY');choice(r$filter$missingScope,c('global','group'),'MISSING_SCOPE')
  if(!is.null(r$filter$maxMissing)&&(!is.numeric(r$filter$maxMissing)||length(r$filter$maxMissing)!=1||!is.finite(r$filter$maxMissing)||r$filter$maxMissing<0||r$filter$maxMissing>1))fail('MISSING_THRESHOLD')
  r
}
transform_matrix <- function(x,r) {
  if(r$method=='none')return(x)
  if(length(r$pseudocount)!=1||!is.numeric(r$pseudocount)||!is.finite(r$pseudocount)||r$pseudocount<0)fail('PSEUDOCOUNT')
  z<-x+r$pseudocount
  if(any(z<0,na.rm=TRUE)||(r$method!='sqrt'&&any(z<=0,na.rm=TRUE)))fail('TRANSFORM_DOMAIN')
  switch(r$method,log2=log2(z),log10=log10(z),ln=log(z),sqrt=sqrt(z))
}
scale_parameters <- function(x,method) {
  center<-switch(method,none=rep(0,ncol(x)),minmax=apply(x,2,min,na.rm=TRUE),robust=apply(x,2,median,na.rm=TRUE),colMeans(x,na.rm=TRUE))
  denom<-switch(method,uv=apply(x,2,sd,na.rm=TRUE),pareto=sqrt(apply(x,2,sd,na.rm=TRUE)),minmax=apply(x,2,function(z)diff(range(z,na.rm=TRUE))),robust=apply(x,2,IQR,na.rm=TRUE,type=7),rep(1,ncol(x)))
  if(any(!is.finite(center))||any(!is.finite(denom)|denom==0))fail('SCALE_ZERO_OR_UNDEFINED')
  list(center=center,denom=denom)
}
fill_matrix <- function(x,q,impute,state=NULL) {
  targets<-is.na(x)&q!='qc-filtered';method<-impute$method
  learned<-state
  if(is.null(learned)) {
    value<-switch(method,constant=rep(impute$value,ncol(x)),median=apply(x,2,median,na.rm=TRUE),'half-minimum'=apply(x,2,function(z){z<-z[is.finite(z)&z>0];if(length(z))min(z)/2 else NA_real_}),rep(NA_real_,ncol(x)))
    learned<-list(value=value,references=x,k=impute$k)
  }
  if(method=='knn') {
    k<-learned$k;if(length(k)!=1||!is.numeric(k)||!is.finite(k)||k<1||k!=as.integer(k))fail('KNN_K')
    original<-x;ref<-learned$references
    for(i in seq_len(nrow(x)))for(j in which(targets[i,])) {
      dist<-apply(ref,1,function(row){ok<-is.finite(row)&is.finite(original[i,]);ok[j]<-FALSE;if(!any(ok))Inf else sqrt(mean((row[ok]-original[i,ok])^2))})
      eligible<-which(is.finite(dist)&is.finite(ref[,j]));if(!length(eligible))fail('KNN_NO_TRAINING_NEIGHBORS')
      near<-eligible[order(dist[eligible])][seq_len(min(k,length(eligible)))];x[i,j]<-mean(ref[near,j])
    }
  } else if(method!='none') {
    if(length(learned$value)!=ncol(x)||any(!is.finite(learned$value[colSums(targets)>0])))fail('IMPUTATION_UNDEFINED')
    for(j in seq_len(ncol(x)))x[targets[,j],j]<-learned$value[j]
  }
  q[targets&!is.na(x)]<-'analysis-imputed'
  list(x=x,q=q,state=learned)
}
normalize_matrix <- function(x,r,reference=NULL,internal=NULL) {
  if(r$method=='none')return(list(x=x,reference=NULL,factors=rep(1,nrow(x))))
  if(length(r$target)!=1||!is.numeric(r$target)||!is.finite(r$target)||r$target<=0)fail('NORMALIZATION_TARGET')
  if(r$method=='pqn'&&is.null(reference)) reference<-apply(x,2,median,na.rm=TRUE)
  factors<-switch(r$method,sum=rowSums(x,na.rm=TRUE),median=apply(x,1,median,na.rm=TRUE),pqn=apply(sweep(x,2,reference,'/'),1,function(z){z<-z[is.finite(z)&z>0];if(length(z))median(z)else NA_real_}),'internal-standard'=internal)
  if(length(factors)!=nrow(x)||any(!is.finite(factors)|factors<=0))fail('NORMALIZATION_DENOMINATOR')
  list(x=x/factors*r$target,reference=reference,factors=factors)
}
internal_values <- function(raw,rows,r,d) {
  if(r$method!='internal-standard')return(NULL)
  j<-match(r$featureId,raw$featureIds);if(length(j)!=1||is.na(j))fail('INTERNAL_STANDARD_REQUIRED')
  semi<-isTRUE(d$provenance$semiQuantitative)||identical(d$provenance$matrixType,'semiquantitative')||identical(d$provenance$source,'shimadzu-verified-archive')
  if(semi&&!isTRUE(r$acknowledgeDoubleNormalization))fail('DOUBLE_INTERNAL_STANDARD_NORMALIZATION')
  raw$x[rows,j]
}
sample_matrix_types <- function(sample) {
  types<-unlist(sample$sourceMatrixTypes,use.names=FALSE)
  if(!length(types)){
    config<-sample$sourceConfiguration
    kind<-config$matrixType%||%''
    if(!nzchar(kind))kind<-config$sampleForm%||%''
    types<-kind
  }
  unique(types[nzchar(types)])
}
fit_recipe <- function(dataset,recipe=list(),training_ids=NULL) {
  raw<-read_dataset(dataset);r<-recipe_defaults(recipe)
  rows<-which(vapply(raw$samples,function(s)!identical(s$include,FALSE),logical(1)))
  if(!is.null(training_ids)){if(any(!training_ids %in% raw$sampleIds))fail('UNKNOWN_TRAINING_ID');rows<-rows[raw$sampleIds[rows]%in%training_ids]}
  if(!length(rows))fail('NO_SAMPLES')
  cols<-seq_along(raw$features);initialDropped<-list()
  if(!isTRUE(r$filter$includeInternalStandards)){is<-vapply(raw$features,function(f)isTRUE(f$isInternalStandard),logical(1));initialDropped<-lapply(which(is),function(j)list(id=raw$featureIds[j],reason='internal-standard'));cols<-cols[!is]}
  if(!is.null(r$filter$featureIds)){if(any(!r$filter$featureIds%in%raw$featureIds))fail('UNKNOWN_FEATURE_ID');removed<-cols[!raw$featureIds[cols]%in%r$filter$featureIds];initialDropped<-c(initialDropped,lapply(removed,function(j)list(id=raw$featureIds[j],reason='explicit-selection')));cols<-cols[raw$featureIds[cols]%in%r$filter$featureIds]}
  if(!length(cols))fail('NO_FEATURES')
  units<-unique(vapply(raw$features[cols],function(f)f$unit%||%'',character(1)));units<-units[nzchar(units)]
  if(length(units)>1&&!isTRUE(r$filter$allowMixedUnits))fail('MIXED_UNITS_ACKNOWLEDGEMENT_REQUIRED')
  types<-unique(unlist(lapply(raw$samples[rows],sample_matrix_types),use.names=FALSE))
  if(length(types)>1&&!isTRUE(r$filter$allowMixedMatrixTypes))fail('MIXED_MATRIX_TYPES_ACKNOWLEDGEMENT_REQUIRED')
  x<-raw$x[rows,cols,drop=FALSE];q<-raw$q[rows,cols,drop=FALSE];ratios<-colMeans(is.na(x));drop<-rep(FALSE,ncol(x));reasons<-rep('',ncol(x))
  if(!is.null(r$filter$maxMissing)) {
    metric<-ratios
    if(r$filter$missingScope=='group'){
      groups<-vapply(raw$samples[rows],function(s)s$group%||%'',character(1))
      if(any(!nzchar(groups)))fail('GROUP_REQUIRED')
      groupRatios<-lapply(unique(groups),function(g)colMeans(is.na(x[groups==g,,drop=FALSE])))
      metric<-Reduce(pmax,groupRatios)
    }
    drop<-metric>r$filter$maxMissing;reasons[drop]<-'missing-threshold'
  }
  allmissing<-colSums(!is.na(x))==0
  if(any(allmissing&!drop)&&r$filter$allMissing=='error')fail('ALL_MISSING_FEATURE')
  drop<-drop|allmissing;reasons[allmissing]<-'all-missing'
  zero<-vapply(seq_len(ncol(x)),function(j)length(unique(x[is.finite(x[,j]),j]))<=1,logical(1))
  if(r$filter$zeroVariance=='drop'){drop<-drop|zero;reasons[zero&!allmissing]<-'zero-variance'}
  if(all(drop))fail('NO_FEATURES')
  audit<-list(order=c('filter','fill','sample-normalize','transform','scale'),inputSamples=length(raw$samples),inputFeatures=length(raw$features),missingRatios=setNames(as.list(ratios),raw$featureIds[cols]),droppedFeatures=c(initialDropped,lapply(which(drop),function(j)list(id=raw$featureIds[cols[j]],reason=reasons[j]))))
  cols<-cols[!drop];x<-x[,!drop,drop=FALSE];q<-q[,!drop,drop=FALSE]
  filled<-fill_matrix(x,q,r$impute);norm<-normalize_matrix(filled$x,r$normalize,internal=internal_values(raw,rows,r$normalize,dataset));x<-transform_matrix(norm$x,r$transform)
  scaleState<-if(r$scale$axis=='feature')scale_parameters(x,r$scale$method)else NULL
  if(r$scale$axis=='feature')x<-sweep(sweep(x,2,scaleState$center,'-'),2,scaleState$denom,'/')else{sp<-scale_parameters(t(x),r$scale$method);x<-t(sweep(sweep(t(x),2,sp$center,'-'),2,sp$denom,'/'))}
  state<-list(schemaVersion=1,recipe=r,featureIds=raw$featureIds[cols],trainingSampleIds=raw$sampleIds[rows],impute=filled$state,normalizationReference=norm$reference,scale=scaleState)
  list(matrix=x,cellStates=filled$q,sampleIds=raw$sampleIds[rows],featureIds=raw$featureIds[cols],audit=audit,state=state)
}
apply_recipe <- function(dataset,state) {
  raw<-read_dataset(dataset);r<-state$recipe;rows<-which(vapply(raw$samples,function(s)!identical(s$include,FALSE),logical(1)));cols<-match(state$featureIds,raw$featureIds)
  if(anyNA(cols))fail('FITTED_FEATURE_MISSING')
  filled<-fill_matrix(raw$x[rows,cols,drop=FALSE],raw$q[rows,cols,drop=FALSE],r$impute,state$impute)
  norm<-normalize_matrix(filled$x,r$normalize,state$normalizationReference,internal_values(raw,rows,r$normalize,dataset));x<-transform_matrix(norm$x,r$transform)
  sp<-if(r$scale$axis=='feature')state$scale else scale_parameters(t(x),r$scale$method)
  if(r$scale$axis=='feature')x<-sweep(sweep(x,2,sp$center,'-'),2,sp$denom,'/')else x<-t(sweep(sweep(t(x),2,sp$center,'-'),2,sp$denom,'/'))
  list(matrix=x,cellStates=filled$q,sampleIds=raw$sampleIds[rows],featureIds=state$featureIds,audit=list(appliedTrainingSampleIds=state$trainingSampleIds),state=state)
}
