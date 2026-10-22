source('services/analysis/tests/test_review_regressions.R')
failures<-character()
mixed_fixture<-function(){
  d<-fixture(cbind(1:6,c(1,3,2,7,5,8)))
  for(i in 1:6)d$samples[[i]]$sourceConfiguration<-list(sampleForm=if(i<=3)'liquid'else 'solid',preparation='synthetic')
  d
}
for(method in c('compare','correlation','distribution'))case(paste(method,'mixed matrices require analysis acknowledgement'),{
  d<-mixed_fixture();a<-list(method=method,control='C',treatment='T')
  msg<-tryCatch({analyze_dataset(d,list(),a);''},error=function(e)conditionMessage(e))
  stopifnot(identical(msg,'MIXED_MATRIX_TYPES_ACKNOWLEDGEMENT_REQUIRED'))
  a$allowMixedMatrixTypes<-TRUE;a$mixedMatrixTypesReason<-'Synthetic cross-matrix demonstration'
  r<-analyze_dataset(d,list(),a)
  stopifnot('MIXED_MATRIX_TYPES_ACKNOWLEDGED'%in%unlist(r$data$warnings))
  stopifnot(isTRUE(r$provenance$matrixStrata$acknowledged),setequal(r$provenance$matrixStrata$matrixTypes,c('liquid','solid')))
  stopifnot(r$provenance$matrixStrata$reason==a$mixedMatrixTypesReason)
})
case('independent aggregation preserves source configuration and audits mixed technical units',{
  d<-mixed_fixture();d$samples[[2]]$biologicalUnitId<-d$samples[[1]]$biologicalUnitId
  d$samples[[2]]$sourceConfiguration$sampleForm<-'solid'
  msg<-tryCatch({prepare_independent(d);''},error=function(e)conditionMessage(e))
  stopifnot(identical(msg,'MIXED_MATRIX_TYPES_ACKNOWLEDGEMENT_REQUIRED'))
  z<-prepare_independent(d,allow_mixed_matrix_types=TRUE)
  stopifnot(z$samples[[1]]$sourceConfiguration$sampleForm=='mixed')
  stopifnot(length(z$samples[[1]]$sourceConfigurations)==2)
  stopifnot(setequal(z$samples[[1]]$sourceMatrixTypes,c('liquid','solid')))
  stopifnot(z$samples[[2]]$sourceConfiguration$sampleForm=='liquid')
  stopifnot(length(z$audit$mixedTechnicalUnits)==1)
})
case('per-feature inference does not conflate differing feature units with matrix types',{
  d<-fixture(cbind(1:6,2:7));d$features[[2]]$unit<-'peak area'
  r<-analyze_dataset(d,list(),list(method='compare',control='C',treatment='T'))
  stopifnot(length(r$data$results)==2,all(vapply(r$data$results,function(x)is.finite(x$p),logical(1))))
})
case('explicit contrast transforms only participating groups and preserves source',{
  d<-fixture(cbind(c(1:6,0,0,0),c(2:7,0,0,0)),rep(c('C','T','Unused'),each=3))
  before<-serialize(d,NULL)
  r<-tryCatch(analyze_dataset(d,list(),list(method='compare',control='C',treatment='T',transform=list(method='log2'))),error=function(e)NULL)
  stopifnot(!is.null(r),abs(r$data$results[[1]]$p-t.test(log2(4:6),log2(1:3))$p.value)<1e-12)
  stopifnot(length(r$data$results)==2,identical(before,serialize(d,NULL)))
})
case('unused repeated and conflicting technical metadata do not block selected contrast',{
  d<-fixture(cbind(1:9,2:10),rep(c('C','T','Unused'),each=3))
  d$samples[[7]]$biologicalUnitId<-'u1'
  d$samples[[8]]$biologicalUnitId<-'u1'
  d$samples[[7]]$subjectId<-'unrelated1';d$samples[[8]]$subjectId<-'unrelated2'
  r<-tryCatch(analyze_dataset(d,list(),list(method='compare',control='C',treatment='T')),error=function(e)NULL)
  stopifnot(!is.null(r),r$data$results[[1]]$nControl==3,r$data$results[[1]]$nTreatment==3)
})
case('explicit contrast list uses union and retains full per-contrast BH family',{
  d<-fixture(cbind(c(1:9,0,0,0),c(2:10,0,0,0)),rep(c('C','T','T2','Unused'),each=3))
  a<-list(method='compare',comparisons=list(list(control='C',treatment='T'),list(control='C',treatment='T2')),transform=list(method='log2'))
  r<-tryCatch(analyze_dataset(d,list(),a),error=function(e)NULL)
  stopifnot(!is.null(r),length(r$data$results)==4)
  for(cmp in unique(vapply(r$data$results,function(x)x$comparison,''))){rows<-Filter(function(x)x$comparison==cmp,r$data$results);stopifnot(max(abs(vapply(rows,function(x)x$padj,0)-p.adjust(vapply(rows,function(x)x$p,0),'BH')))<1e-12)}
})
case('explicit multigroup and paired tests ignore unused invalid groups',{
  d<-fixture(matrix(c(1:9,0,0,0),ncol=1),rep(c('C','T','T2','Unused'),each=3))
  r<-tryCatch(analyze_dataset(d,list(),list(method='compare',test='anova',groups=c('C','T','T2'),transform=list(method='log2'))),error=function(e)NULL)
  stopifnot(!is.null(r),is.finite(r$data$results[[1]]$p))
  for(i in 1:6)d$samples[[i]]$subjectId<-paste0('pair',(i-1)%%3+1)
  r<-tryCatch(analyze_dataset(d,list(),list(method='compare',test='paired-t',control='C',treatment='T',transform=list(method='log2'))),error=function(e)NULL)
  stopifnot(!is.null(r),r$data$results[[1]]$nControl==3)
})
if(length(failures))stop(paste(failures,collapse='\n'),call.=FALSE)
cat('ALL QUALITY REGRESSIONS PASSED\n')
