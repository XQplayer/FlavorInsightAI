source('services/analysis/tests/test_engine.R')
failures<-character()
case<-function(label,expr){
  tryCatch({force(expr);cat('PASS:',label,'\n')},error=function(e){failures<<-c(failures,paste(label,conditionMessage(e),sep=': '));cat('FAIL:',tail(failures,1),'\n')})
}
case('groupwise threshold handles one retained feature',{
  d<-fixture(matrix(1:6,ncol=1))
  p<-tryCatch(fit_recipe(d,list(filter=list(maxMissing=.5,missingScope='group'))),error=function(e)NULL)
  stopifnot(!is.null(p),identical(dim(p$matrix),c(6L,1L)))
})
case('tiny positive PCA variance retains numerical rank',{
  d<-fixture(matrix((1:6)*1e-10,ncol=1))
  p<-tryCatch(analyze_dataset(d,list(),list(method='pca')),error=function(e)NULL)
  stopifnot(!is.null(p),p$data$rank==1,p$data$explained[[1]]==1)
})
case('constant Pearson and Spearman results have explicit reason',{
  d<-fixture(cbind(rep(1,6),1:6))
  for(cm in c('pearson','spearman')){
    r<-analyze_dataset(d,list(),list(method='correlation',correlation=cm))$data$results[[1]]
    stopifnot(is.na(r$r),is.na(r$p),identical(r$naReason,'INSUFFICIENT_N_OR_VARIANCE'))
  }
})
case('actual Shimadzu archive source blocks double IS normalization',{
  d<-fixture(cbind(1:6,2:7));d$features[[2]]$isInternalStandard<-TRUE
  d$provenance$source<-'shimadzu-verified-archive'
  recipe<-list(normalize=list(method='internal-standard',featureId='f2'))
  message<-tryCatch({fit_recipe(d,recipe);''},error=function(e)conditionMessage(e))
  stopifnot(identical(message,'DOUBLE_INTERNAL_STANDARD_NORMALIZATION'))
  recipe$normalize$acknowledgeDoubleNormalization<-TRUE
  stopifnot(all(is.finite(fit_recipe(d,recipe)$matrix)))
})
case('actual Shimadzu sampleForm gates liquid and solid mixtures',{
  d<-fixture(cbind(1:6,2:7))
  for(i in seq_along(d$samples))d$samples[[i]]$sourceConfiguration<-list(sampleForm=if(i<=3)'liquid'else 'solid')
  message<-tryCatch({fit_recipe(d);''},error=function(e)conditionMessage(e))
  stopifnot(identical(message,'MIXED_MATRIX_TYPES_ACKNOWLEDGEMENT_REQUIRED'))
  stopifnot(nrow(fit_recipe(d,list(filter=list(allowMixedMatrixTypes=TRUE)))$matrix)==6)
})
case('excluded internal standard cannot fail inferential log domain',{
  d<-fixture(cbind(1:6,rep(0,6)));d$features[[2]]$isInternalStandard<-TRUE
  a<-list(method='compare',control='C',treatment='T',transform=list(method='log2'))
  r<-tryCatch(analyze_dataset(d,list(),a),error=function(e)NULL)
  stopifnot(!is.null(r),length(r$data$results)==1,r$data$results[[1]]$featureId=='f1')
  a$includeInternalStandards<-TRUE
  message<-tryCatch({analyze_dataset(d,list(),a);''},error=function(e)conditionMessage(e))
  stopifnot(identical(message,'TRANSFORM_DOMAIN'))
})
if(length(failures))stop(paste(failures,collapse='\n'),call.=FALSE)
cat('ALL REVIEW REGRESSIONS PASSED\n')
