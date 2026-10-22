args <- commandArgs(trailingOnly=TRUE)
base <- if (length(args)) args[[1]] else 'services/analysis'
check <- function(ok, label) { if (!isTRUE(ok)) stop(paste('FAIL:',label)); cat('PASS:',label,'\n') }
check(file.exists(file.path(base,'preprocess.R')), 'preprocess implementation exists')
source(file.path(base,'preprocess.R')); source(file.path(base,'statistics.R'))
fixture <- function(x, groups=rep(c('C','T'),each=nrow(x)/2)) list(schemaVersion=1,id='synthetic',samples=lapply(seq_len(nrow(x)),function(i) list(id=paste0('s',i),group=groups[i],include=TRUE,biologicalUnitId=paste0('u',i),subjectId='')),features=lapply(seq_len(ncol(x)),function(i) list(id=paste0('f',i),unit='mg/L',isInternalStandard=FALSE)),matrix=lapply(seq_len(nrow(x)),function(i) as.list(x[i,])),quality=list(cellStates=lapply(seq_len(nrow(x)),function(i) as.list(ifelse(is.na(x[i,]),'missing','observed')))),provenance=list(independenceConfirmed=TRUE))
err <- function(expr,code) { v<-tryCatch({force(expr);''},error=function(e) conditionMessage(e)); check(grepl(code,v,fixed=TRUE),code) }
x<-matrix(c(1,2,4,8,2,5,7,12,3,4,8,14),6,2)
d<-fixture(x); p<-fit_recipe(d,list(scale=list(method='pareto')))
check(isTRUE(all.equal(p$matrix,scale(x,center=TRUE,scale=sqrt(apply(x,2,sd))),check.attributes=FALSE)), 'Pareto uses sample SD')
p<-fit_recipe(d,list(scale=list(method='uv'))); pc<-analyze_dataset(d,list(scale=list(method='uv')),list(method='pca'))
check(max(abs(pc$data$scores %*% t(pc$data$loadings)-p$matrix))<1e-10,'PCA reconstruction sign invariant')
check(max(abs(pc$data$eigenvalues-prcomp(p$matrix,center=FALSE,scale.=FALSE)$sdev^2))<1e-10,'PCA eigenvalues')
err(fit_recipe(fixture(matrix(c(-1,2,3,4),2)),list(transform=list(method='log2'))),'TRANSFORM_DOMAIN')
err(fit_recipe(fixture(matrix(c(NA,NA,1,2),2)),list()),'ALL_MISSING_FEATURE')
err(analyze_dataset(fixture(matrix(1,4,2)),list(),list(method='pca')),'PCA_ZERO_RANK')
q<-fixture(matrix(c(1,NA,3,4,2,4,5,8),4)); q$quality$cellStates[[2]][[1]]<-'qc-filtered'
pq<-fit_recipe(q,list(impute=list(method='constant',value=99)))
check(is.na(pq$matrix[2,1]),'QC filtered not revived')
train<-fixture(matrix(c(1,2,3,1,2,3),3)); train$samples<-lapply(seq_len(3),function(i)list(id=paste0('s',i),group='C',include=TRUE))
kn<-fit_recipe(train,list(impute=list(method='knn',k=1)))
held<-fixture(matrix(c(NA,2.1),1),groups='T'); held$samples[[1]]$id<-'held'
kh<-apply_recipe(held,kn$state); check(kh$matrix[1,1]==2,'KNN uses fitted training references')
rr<-analyze_dataset(d,list(),list(method='compare',test='welch',control='C',treatment='T'))
pv<-vapply(seq_len(2),function(j)t.test(x[4:6,j],x[1:3,j])$p.value,0)
check(max(abs(vapply(rr$data$results,function(r)r$p,0)-pv))<1e-12,'Welch reference')
check(max(abs(vapply(rr$data$results,function(r)r$padj,0)-p.adjust(pv,'BH')))<1e-12,'BH full feature family')
dup<-d; dup$samples<-c(d$samples,lapply(d$samples,function(s){s$id<-paste0(s$id,'b');s})); dup$matrix<-c(d$matrix,d$matrix); dup$quality$cellStates<-c(d$quality$cellStates,d$quality$cellStates)
rd<-analyze_dataset(dup,list(),list(method='compare',test='welch',control='C',treatment='T'))
check(rd$data$results[[1]]$nControl==3 && abs(rd$data$results[[1]]$p-pv[1])<1e-12,'technical duplicates preserve n')
err(analyze_dataset(d,list(),list(method='compare',test='paired-t',control='C',treatment='T')),'PAIRED_SUBJECT_REQUIRED')
d$provenance$independenceConfirmed<-FALSE; err(analyze_dataset(d,list(),list(method='compare',control='C',treatment='T')),'INDEPENDENCE_REQUIRED')
cat('ALL ENGINE TESTS PASSED\n')

# Separate regression cases for reviewed scientific edge conditions.
d<-fixture(x)
logged<-analyze_dataset(d,list(),list(method='compare',control='C',treatment='T',transform=list(method='log2')))$data$results[[1]]
check(abs(logged$effect-(mean(log2(x[4:6,1]))-mean(log2(x[1:3,1]))))<1e-12,'effect matches transformed CI scale')
check(logged$effectScale=='log2' && abs(logged$rawMeanDifference-(mean(x[4:6,1])-mean(x[1:3,1])))<1e-12,'raw mean difference separately reported')
rankone<-fixture(cbind(1:6,2*(1:6)))
check(ncol(analyze_dataset(rankone,list(),list(method='pca'))$data$scores)==1,'PCA default components restricted to numerical rank')
err(analyze_dataset(rankone,list(),list(method='pca',components=2)),'PCA_COMPONENTS')
repeatd<-d; repeatd$samples[[4]]$biologicalUnitId<-repeatd$samples[[1]]$biologicalUnitId
err(analyze_dataset(repeatd,list(),list(method='correlation')),'REPEATED_CONDITION_REQUIRES_PAIRED_METHOD')
isd<-fixture(cbind(x,1:6));isd$features[[3]]$isInternalStandard<-TRUE
check(length(analyze_dataset(isd,list(),list(method='correlation'))$data$results)==1,'correlation excludes internal standards')
isnorm<-fit_recipe(isd,list(normalize=list(method='internal-standard',featureId='f3')))
check(isTRUE(all.equal(isnorm$matrix,x/(1:6),check.attributes=FALSE)),'IS reference remains available before feature exclusion')
check(any(vapply(isnorm$audit$droppedFeatures,function(z)z$id=='f3'&&z$reason=='internal-standard',logical(1))),'IS removal in audit')
negative<-fixture(cbind(c(-1,-2,-3,4,5,6),1:6))
check(analyze_dataset(negative,list(),list(method='compare',control='C',treatment='T'))$data$results[[1]]$fcNaReason=='NONPOSITIVE_GROUP_MEAN','FC undefined reason explicit')
cat('REVIEW REGRESSIONS PASSED\n')
