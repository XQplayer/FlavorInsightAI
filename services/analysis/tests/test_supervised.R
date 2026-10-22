args <- commandArgs(trailingOnly=TRUE)
base <- if(length(args)) args[[1]] else 'services/analysis'
source(file.path(base,'preprocess.R')); source(file.path(base,'statistics.R'))
check <- function(ok,label) { if(!isTRUE(ok)) stop(paste('FAIL:',label)); cat('PASS:',label,'\n') }
err <- function(expr,code) { value<-tryCatch({force(expr);''},error=function(e)conditionMessage(e)); check(grepl(code,value,fixed=TRUE),paste(code,value)) }
fixture <- function(x,groups) list(schemaVersion=1,id='supervised-public',samples=lapply(seq_len(nrow(x)),function(i)list(id=paste0('s',i),group=groups[i],biologicalUnitId=sprintf('u%02d',i),subjectId='',include=TRUE)),features=lapply(seq_len(ncol(x)),function(j)list(id=paste0('f',j),unit='mg/L')),matrix=lapply(seq_len(nrow(x)),function(i)as.list(x[i,])),quality=list(cellStates=lapply(seq_len(nrow(x)),function(i)as.list(ifelse(is.finite(x[i,]),'observed','missing')))),provenance=list(independenceConfirmed=TRUE))
check(file.exists(file.path(base,'supervised.R')),'supervised implementation exists')
source(file.path(base,'supervised.R'))
suppressPackageStartupMessages(library(ropls))
set.seed(123); x<-matrix(rnorm(24*8),24,8); groups<-rep(c('C','T','Z'),each=8)
x[,1]<-x[,1]+rep(c(0,2,4),each=8)
d<-fixture(x,groups); recipe<-list(scale=list(method='uv'),impute=list(method='median'))
opts<-list(method='plsda',outerFolds=4,innerFolds=3,predictiveComponents=c(1,2),permutations=2,seed=41)
z<-supervised_dataset(d,opts)
check(nrow(read_dataset(z$dataset)$x)==24,'independent aggregation')
dup<-d; dup$samples<-c(d$samples,lapply(d$samples,function(s){s$id<-paste0(s$id,'b');s}));dup$matrix<-c(d$matrix,d$matrix);dup$quality$cellStates<-c(d$quality$cellStates,d$quality$cellStates)
check(identical(read_dataset(supervised_dataset(dup,opts)$dataset)$x,read_dataset(z$dataset)$x),'technical duplication preserves aggregate')
qc<-d; qc$quality$cellStates[[1]][[1]]<-'qc-filtered'; qc$matrix[[1]][[1]]<-999
check(read_dataset(supervised_dataset(qc,opts)$dataset)$q[1,1]=='qc-filtered','QC lineage survives aggregation')
err(analyze_supervised(qc,recipe,opts),'SUPERVISED_REQUIRES_COMPLETE_FINITE_MATRIX')
bad<-d;bad$provenance$independenceConfirmed<-FALSE;err(supervised_dataset(bad,opts),'INDEPENDENCE_REQUIRED')
bad<-d;bad$samples[[9]]$biologicalUnitId<-bad$samples[[1]]$biologicalUnitId;err(supervised_dataset(bad,opts),'PAIRED_SUPERVISED_UNSUPPORTED')
bad<-d;for(i in c(1,9))bad$samples[[i]]$subjectId<-'paired';err(supervised_dataset(bad,opts),'PAIRED_SUPERVISED_UNSUPPORTED')
err(supervised_options(modifyList(opts,list(outerFolds=2.2))),'OUTER_FOLDS')
err(supervised_options(modifyList(opts,list(predictiveComponents=list(TRUE,2)))),'COMPONENT_GRID')
err(supervised_dataset(d,modifyList(opts,list(groups=list()))),'SUPERVISED_GROUPS')
err(supervised_options(modifyList(opts,list(mixedMatrixTypesReason=list(why='mixed')))),'MIXED_MATRIX_REASON')
err(supervised_dataset(d,list(method='oplsda')),'OPLS_REQUIRES_TWO_CLASSES')

# Continuous response must agree with installed ropls prediction, including one row.
for(kind in c('binary','multi','orthogonal')) {
  ii<-if(kind=='multi')1:24 else 1:16; lev<-if(kind=='multi')c('Z','T','C')else c('T','C')
  xx<-scale(x[ii,,drop=FALSE]); yy<-factor(groups[ii],levels=lev)
  fit<-supervised_fit(xx,yy,list(predictive=1L,orthogonal=if(kind=='orthogonal')1L else 0L))$model
  for(rows in list(1L,1:3)) {
    continuous<-supervised_response(fit,xx[rows,,drop=FALSE])
    # Installed ropls single-row OPLS predict has a vector-promotion bug;
    # duplicate the held-out row for the package reference, then take row one.
    referenceRows<-if(kind=='orthogonal'&&length(rows)==1)rep(rows,2)else rows
    expected<-as.character(predict(fit,xx[referenceRows,,drop=FALSE]))[seq_along(rows)]
    check(identical(supervised_class(continuous,lev),expected),paste('response equivalence',kind,length(rows)))
    if(kind=='orthogonal'&&length(rows)==1) {
      upstream<-tryCatch({predict(fit,xx[rows,,drop=FALSE]);''},error=function(e)conditionMessage(e))
      check(grepl('non-conformable',upstream),'document installed ropls single-row OPLS limitation')
      check(max(abs(continuous-supervised_response(fit,xx[rep(rows,2),,drop=FALSE])[1,,drop=FALSE]))<1e-12,'shape-safe one-row matches multirow formula')
    }
  }
  check(all(fit@xMeanVn==0),'ropls does not duplicate wrapper centering')
}
check(identical(supervised_class(matrix(.5,1,1),c('T','C')),'T'),'binary threshold tie uses first class')
check(identical(supervised_class(matrix(c(.6,.6,.2),1),c('Z','T','C')),'Z'),'multiclass tie uses first class')

r<-analyze_supervised(d,recipe,opts); rd<-analyze_supervised(dup,recipe,opts)
check(identical(r$data$validation,rd$data$validation),'technical duplicates do not change metrics or CV audit')
check(identical(r$data$permutation,rd$data$permutation),'technical duplicates do not change permutations')
v<-r$data$validation; oof<-v$predictions
press<-sum(vapply(oof,function(p)sum((p$response-p$trueResponse)^2),0))
null<-sum(vapply(oof,function(p)sum((p$trainingPrevalence-p$trueResponse)^2),0))
check(abs(press-v$PRESS)<1e-12&&abs(null-v$PRESS_null)<1e-12,'PRESS reconstructs from continuous responses')
check(abs(v$Q2_trainingPrevalence-(1-press/null))<1e-12,'Q2 training-prevalence denominator')
cm<-table(factor(vapply(oof,function(p)p$trueClass,''),levels=r$data$classOrder),factor(vapply(oof,function(p)p$predictedClass,''),levels=r$data$classOrder))
check(all(cm==v$confusion),'confusion reconstructs from OOF')
check(abs(mean(diag(cm)/rowSums(cm))-v$balancedAccuracy)<1e-12,'pooled OOF balanced accuracy')
check(!any(grepl('reliable',names(r$data),ignore.case=TRUE)),'no reliability badge from separation')
check(r$data$permutation$p==(1+sum(r$data$permutation$distribution>=v$balancedAccuracy))/(opts$permutations+1),'permutation plus-one formula counts ties')
check(identical(r$data$permutation,analyze_supervised(d,recipe,opts)$data$permutation),'permutations deterministic')

# Mutating an outer held-out sentinel cannot change that fold's learned recipe or selection.
held<-v$folds[[1]]$testSampleIds[1]; aggregate<-supervised_dataset(d,opts)$dataset
mutated<-aggregate; k<-match(held,vapply(aggregate$samples,function(s)s$id,''));mutated$matrix[[k]][[1]]<-1e6
cfg<-supervised_options(opts)
first<-supervised_nested(aggregate,recipe,cfg,r$data$classOrder,cfg$seed)
second<-supervised_nested(mutated,recipe,cfg,r$data$classOrder,cfg$seed)
check(identical(first$folds[[1]]$preprocessing,second$folds[[1]]$preprocessing),'heldout sentinel cannot change outer preprocessing')
check(identical(first$folds[[1]]$selection,second$folds[[1]]$selection),'heldout sentinel cannot change inner selection')

small<-fixture(x[c(1:3,9:11),],rep(c('C','T'),each=3))
err(analyze_supervised(small,recipe,list(method='plsda',permutations=0)),'EXPLORATORY_ACKNOWLEDGEMENT_REQUIRED')
smallopts<-list(method='plsda',outerFolds=3,innerFolds=2,predictiveComponents=1,permutations=0,acknowledgeExploratory=TRUE)
check(analyze_supervised(small,recipe,smallopts)$data$independentN==6,'n3 explicit exploratory PLS real ropls')
err(analyze_supervised(small,recipe,modifyList(smallopts,list(method='oplsda'))),'NO_VALID_CANDIDATE')
tiny<-fixture(x[c(1:2,9:10),],rep(c('C','T'),each=2));err(analyze_supervised(tiny,recipe,smallopts),'INSUFFICIENT_INDEPENDENT_UNITS')
err(analyze_supervised(small,recipe,modifyList(smallopts,list(outerFolds=5))),'OUTER_FOLDS_INFEASIBLE')

check(analyze_supervised(small,recipe,smallopts)$data$permutation$pNaReason=='PERMUTATION_NOT_REQUESTED','zero permutations explicitly unvalidated')
failedData<-fixture(outer(c(1,1,1,2,3,4),1:3),rep(c('C','T'),each=3))
failedPerm<-analyze_supervised(failedData,recipe,modifyList(smallopts,list(permutations=10)))$data$permutation
check(failedPerm$failed>0&&failedPerm$completed+failedPerm$failed==10,'real permutation failures counted without replacement')
check(is.na(failedPerm$p)&&failedPerm$pNaReason=='REQUIRED_PERMUTATION_FAILED'&&failedPerm$denominator==11,'failed permutation makes p unavailable')
check(length(failedPerm$failures[[1]]$candidates)>0,'failed permutation preserves candidate audit')
ties<-supervised_permutation_summary(c(.5,.5,.4),1:3,list(),.5,3)
check(ties$p==.75&&ties$exceedances==2,'ties counted in plus-one permutation p')

repeated<-analyze_supervised(d,recipe,modifyList(opts,list(repeats=2,permutations=0)))$data
check(repeated$independentN==24&&length(repeated$validation$predictions)==48,'repeated CV does not inflate independent N')
check(repeated$validation$balancedAccuracy==mean(vapply(repeated$validation$byRepeat,function(v)v$balancedAccuracy,0)),'repeated balanced accuracy is mean of pooled-repeat metrics')
check(abs(repeated$validation$PRESS-sum(vapply(repeated$validation$predictions,function(p)sum((p$response-p$trueResponse)^2),0)))<1e-12,'repeated PRESS pools all heldout responses')

opls<-analyze_supervised(d,recipe,modifyList(opts,list(method='oplsda',groups=c('T','C'),predictiveComponents=1,orthogonalComponents=c(1,2),permutations=1)))$data
check(identical(opls$classOrder,c('T','C'))&&opls$fullFit$components$orthogonal>=1,'binary OPLS retains requested class order and actual orthogonal component')
check(identical(opls$fullFit$featureIds,rownames(opls$fullFit$loadings))&&all(vapply(opls$fullFit$VIP,function(v)v$featureId,'')%in%opls$fullFit$featureIds),'full-fit VIP and loadings map to feature IDs')

# The near-zero removal branch must match the package with original/reduced X.
constantX<-cbind(scale(x[1:16,]),constant=7)
constantFit<-supervised_fit(constantX,factor(groups[1:16]),list(predictive=1,orthogonal=0))$model
check(length(constantFit@xZeroVarVi)==1,'near-zero exclusion handled explicitly')
check(max(abs(supervised_response(constantFit,constantX[1:3,])-supervised_response(constantFit,constantX[1:3,-9,drop=FALSE])))<1e-12,'predict near-zero removal matches installed dimension semantics')

positive<-fixture(abs(x)+1,groups);positive$matrix[[2]][[1]]<-NA_real_;positive$quality$cellStates[[2]][[1]]<-'missing'
agg<-supervised_dataset(positive,opts)$dataset
pRecipe<-modifyList(recipe,list(normalize=list(method='pqn')))
partition<-supervised_partition(agg,pRecipe,1:12,13:24)
check(abs(partition$training$state$impute$value[1]-median(vapply(agg$matrix[1:12],function(row)row[[1]],0),na.rm=TRUE))<1e-12,'median learned exclusively from training units')
altered<-agg;altered$matrix[[13]][[1]]<-1e9
check(identical(partition$training,supervised_partition(altered,pRecipe,1:12,13:24)$training),'heldout sentinel leaves PQN median and scaling unchanged')

semi<-d;semi$provenance$source<-'shimadzu-verified-archive'
agg<-supervised_dataset(semi,opts)$dataset
err(supervised_partition(agg,list(normalize=list(method='internal-standard',featureId='f1')),1:16),'DOUBLE_INTERNAL_STANDARD_NORMALIZATION')
mix<-d;for(i in 1:24)mix$samples[[i]]$sourceConfiguration<-list(matrixType=if(i<=8)'liquid'else 'solid')
err(supervised_dataset(mix,opts),'MIXED_MATRIX_TYPES_ACKNOWLEDGEMENT_REQUIRED')
check(supervised_dataset(mix,modifyList(opts,list(allowMixedMatrixTypes=TRUE)))$matrixStrata$acknowledged,'mixed matrix acknowledgement audited')
check(supervised_dataset(mix,modifyList(opts,list(groups=c('T','Z'))))$independentN==16,'unused matrix group excluded before validation')
set.seed(998);random<-d;randomLabels<-sample(groups);for(i in 1:24)random$samples[[i]]$group<-randomLabels[i]
randomResult<-analyze_supervised(random,recipe,modifyList(opts,list(permutations=0)))$data
check('VIP_IS_NOT_A_P_VALUE_OR_EVIDENCE_OF_CAUSALITY'%in%unlist(randomResult$warnings)&&is.null(randomResult$reliable),'random labels never acquire reliability claim')
cat('ALL SUPERVISED TESTS PASSED\n')
