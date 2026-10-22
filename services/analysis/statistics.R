# Inference deliberately uses observed independent units, never exploratory fills.
prepare_independent <- function(dataset, require_confirmation=TRUE, allow_mixed_matrix_types=FALSE, groups=NULL) {
  if(require_confirmation&&!isTRUE(dataset$provenance$independenceConfirmed))fail('INDEPENDENCE_REQUIRED')
  z<-read_dataset(dataset);rows<-which(vapply(z$samples,function(s)!identical(s$include,FALSE),logical(1)))
  if(!is.null(groups)){
    available<-vapply(z$samples[rows],function(s)s$group%||%'',character(1))
    if(!length(groups)||any(!groups%in%available))fail('REQUESTED_GROUP_HAS_NO_INCLUDED_SAMPLES')
    rows<-rows[available%in%groups]
  }
  if(!length(rows))fail('NO_SAMPLES')
  samples<-z$samples[rows];x<-z$x[rows,,drop=FALSE];q<-z$q[rows,,drop=FALSE];x[q!='observed']<-NA_real_
  matrixTypes<-unique(unlist(lapply(samples,sample_matrix_types),use.names=FALSE))
  mixed<-length(matrixTypes)>1
  if(mixed&&!isTRUE(allow_mixed_matrix_types))fail('MIXED_MATRIX_TYPES_ACKNOWLEDGEMENT_REQUIRED')
  group<-vapply(samples,function(s)s$group%||%'',character(1));unit<-vapply(samples,function(s)s$biologicalUnitId%||%'',character(1));subject<-vapply(samples,function(s)s$subjectId%||%'',character(1))
  if(require_confirmation&&(any(!nzchar(group))||any(!nzchar(unit))))fail('GROUP_AND_BIOLOGICAL_UNIT_REQUIRED')
  if(!require_confirmation)unit[!nzchar(unit)]<-z$sampleIds[rows][!nzchar(unit)]
  keys<-paste(nchar(unit),unit,nchar(group),group,sep=':');uniq<-unique(keys)
  xx<-matrix(NA_real_,length(uniq),ncol(x));meta<-vector('list',length(uniq))
  mixedTechnicalUnits<-list()
  for(i in seq_along(uniq)){
    idx<-which(keys==uniq[i]);subj<-unique(subject[idx]);if(length(subj)>1)fail('TECHNICAL_REPEAT_SUBJECT_CONFLICT')
    xx[i,]<-colMeans(x[idx,,drop=FALSE],na.rm=TRUE);xx[i,!is.finite(xx[i,])]<-NA_real_
    configs<-lapply(samples[idx],function(s)s$sourceConfiguration%||%list())
    sourceTypes<-unique(unlist(lapply(samples[idx],sample_matrix_types),use.names=FALSE))
    shared<-configs[[1]]
    for(key in names(shared))if(!all(vapply(configs,function(config)identical(config[[key]],shared[[key]]),logical(1))))shared[[key]]<-NULL
    if(length(sourceTypes)==1)shared$matrixType<-sourceTypes[[1]]
    if(length(sourceTypes)>1){
      shared$matrixType<-'mixed';shared$sampleForm<-'mixed'
      mixedTechnicalUnits[[length(mixedTechnicalUnits)+1]]<-list(biologicalUnitId=unit[idx[1]],group=group[idx[1]],matrixTypes=sourceTypes,sourceSampleIds=z$sampleIds[rows[idx]])
    }
    meta[[i]]<-list(id=paste0('unit-',i),name=unit[idx[1]],group=group[idx[1]],biologicalUnitId=unit[idx[1]],subjectId=subj[1],include=TRUE,sourceSampleIds=z$sampleIds[rows[idx]],sourceConfiguration=shared,sourceConfigurations=configs,sourceMatrixTypes=sourceTypes)
  }
  audit<-list(matrixTypes=matrixTypes,mixed=mixed,acknowledged=isTRUE(allow_mixed_matrix_types),sourceSampleIds=z$sampleIds[rows],mixedTechnicalUnits=mixedTechnicalUnits,warnings=if(mixed)list('MIXED_MATRIX_TYPES_ACKNOWLEDGED')else list())
  list(matrix=xx,samples=meta,featureIds=z$featureIds,features=z$features,audit=audit)
}
summary_values <- function(x){x<-x[is.finite(x)];list(n=length(x),mean=if(length(x))mean(x)else NA_real_,sd=if(length(x)>1)sd(x)else NA_real_,median=if(length(x))median(x)else NA_real_,iqr=if(length(x))IQR(x,type=7)else NA_real_)}
adjust_rows <- function(rows,method,scope='comparison') {
  choice(method,c('BH','holm','bonferroni','none'),'ADJUST_METHOD');choice(scope,c('comparison','all'),'ADJUST_SCOPE')
  fam<-if(scope=='all')rep('all',length(rows))else vapply(rows,function(r)r$comparison,character(1))
  for(f in unique(fam)){idx<-which(fam==f);p<-vapply(rows[idx],function(r)r$p,numeric(1));adj<-p.adjust(p,method=method);for(k in seq_along(idx))rows[[idx[k]]]$padj<-adj[k]};rows
}
compare_data <- function(dataset,a) {
  test<-a$test%||%'welch';choice(test,c('welch','student','paired-t','wilcoxon','paired-wilcoxon','anova','welch-anova','kruskal'),'TEST_METHOD')
  paired<-test%in%c('paired-t','paired-wilcoxon');multi<-test%in%c('anova','welch-anova','kruskal')
  available<-unique(vapply(Filter(function(s)!identical(s$include,FALSE),dataset$samples),function(s)s$group%||%'',character(1)))
  if(multi){
    selected<-unlist(a$groups%||%available)
    if(length(unique(selected))<3||anyDuplicated(selected)||any(!selected%in%available))fail('MULTIGROUP_REQUIRES_THREE_GROUPS')
    comparisons<-list(list(control=paste(selected,collapse='|'),treatment='omnibus',groups=selected))
  }else{
    comparisons<-a$comparisons%||%list(list(control=a$control,treatment=a$treatment))
    if(!length(comparisons))fail('EXPLICIT_COMPARISON_REQUIRED')
    for(cmp in comparisons)if(length(cmp$control)!=1||length(cmp$treatment)!=1||identical(cmp$control,cmp$treatment)||!all(c(cmp$control,cmp$treatment)%in%available))fail('EXPLICIT_COMPARISON_REQUIRED')
    selected<-unique(unlist(lapply(comparisons,function(cmp)c(cmp$control,cmp$treatment)),use.names=FALSE))
  }
  # Adjustment families and UI selections use these exact display labels.
  # Reject duplicate/ambiguous labels before aggregation or any statistical fit.
  comparisonLabels<-vapply(comparisons,function(cmp)paste(cmp$treatment,'vs',cmp$control),character(1))
  posthocPairs<-if(multi)combn(selected,2,simplify=FALSE)else list()
  posthocLabels<-vapply(posthocPairs,function(pair)paste(pair[2],'vs',pair[1]),character(1))
  if(anyDuplicated(c(comparisonLabels,posthocLabels)))fail('AMBIGUOUS_COMPARISON_LABEL')
  z<-prepare_independent(dataset,allow_mixed_matrix_types=isTRUE(a$allowMixedMatrixTypes),groups=selected)
  cols<-which(vapply(z$features,function(f)!isTRUE(f$isInternalStandard)||isTRUE(a$includeInternalStandards),logical(1)))
  if(!length(cols))fail('NO_FEATURES')
  z$matrix<-z$matrix[,cols,drop=FALSE];z$features<-z$features[cols];z$featureIds<-z$featureIds[cols]
  x<-z$matrix;s<-z$samples;groups<-vapply(s,function(t)t$group,character(1));units<-vapply(s,function(t)t$biologicalUnitId,character(1));subjects<-vapply(s,function(t)t$subjectId,character(1))
  if(!paired&&(anyDuplicated(units)||anyDuplicated(subjects[nzchar(subjects)])))fail('REPEATED_CONDITION_REQUIRES_PAIRED_METHOD')
  direction<-a$alternative%||%'two.sided';choice(direction,c('two.sided','less','greater'),'ALTERNATIVE')
  inferenceTransform<-a$transform%||%list(method='none',pseudocount=0);inferenceTransform<-modifyList(list(method='none',pseudocount=0),inferenceTransform);choice(inferenceTransform$method,c('none','log2','log10','ln','sqrt'),'TRANSFORM_METHOD');tx<-transform_matrix(x,inferenceTransform)
  results<-list();posthoc<-list()
  for(cmp in comparisons){
    if(!multi&&(is.null(cmp$control)||is.null(cmp$treatment)||identical(cmp$control,cmp$treatment)||!all(c(cmp$control,cmp$treatment)%in%groups)))fail('EXPLICIT_COMPARISON_REQUIRED')
    ci<-which(groups==cmp$control);ti<-which(groups==cmp$treatment)
    if(paired){if(any(!nzchar(subjects[c(ci,ti)])))fail('PAIRED_SUBJECT_REQUIRED');if(anyDuplicated(subjects[ci])||anyDuplicated(subjects[ti])||!setequal(subjects[ci],subjects[ti]))fail('PAIRED_SUBJECT_MISMATCH');ti<-ti[match(subjects[ci],subjects[ti])]}
    for(j in seq_len(ncol(x))){
      if(isTRUE(z$features[[j]]$isInternalStandard)&&!isTRUE(a$includeInternalStandards))next
      cval<-x[ci,j];tval<-x[ti,j];ct<-tx[ci,j];tt<-tx[ti,j]
      if(paired){ok<-is.finite(ct)&is.finite(tt);ct<-ct[ok];tt<-tt[ok];cval<-cval[ok];tval<-tval[ok]}
      cs<-summary_values(cval);ts<-summary_values(tval);fc<-if(is.finite(cs$mean)&&is.finite(ts$mean)&&cs$mean>0&&ts$mean>0)ts$mean/cs$mean else NA_real_
      row<-list(featureId=z$featureIds[j],comparison=paste(cmp$treatment,'vs',cmp$control),control=cmp$control,treatment=cmp$treatment,method=test,alternative=direction,nControl=cs$n,nTreatment=ts$n,controlSummary=cs,treatmentSummary=ts,effect=summary_values(tt)$mean-summary_values(ct)$mean,effectScale=inferenceTransform$method,rawMeanDifference=ts$mean-cs$mean,ciLow=NA_real_,ciHigh=NA_real_,foldChange=fc,log2FoldChange=log2(fc),fcNaReason=if(is.finite(fc))NULL else if(!is.finite(cs$mean)||!is.finite(ts$mean))'NO_OBSERVED_GROUP_MEAN'else 'NONPOSITIVE_GROUP_MEAN',p=NA_real_,padj=NA_real_,naReason=NULL)
      fit<-tryCatch({
        if(multi){idx<-which(groups%in%cmp$groups&is.finite(tx[,j]));v<-tx[idx,j];g<-factor(groups[idx],levels=cmp$groups);if(any(table(g)<2))fail('INSUFFICIENT_EFFECTIVE_N');row$groupSummaries<-setNames(lapply(cmp$groups,function(k)summary_values(x[groups==k,j])),cmp$groups);switch(test,anova=oneway.test(v~g,var.equal=TRUE),'welch-anova'=oneway.test(v~g,var.equal=FALSE),kruskal=kruskal.test(v~g))}
        else {ct<-ct[is.finite(ct)];tt<-tt[is.finite(tt)];if(length(ct)<2||length(tt)<2)fail('INSUFFICIENT_EFFECTIVE_N');if(test%in%c('welch','student','paired-t'))t.test(tt,ct,paired=paired,var.equal=test=='student',alternative=direction)else suppressWarnings(wilcox.test(tt,ct,paired=paired,alternative=direction,exact=FALSE,conf.int=FALSE))}
      },error=function(e){row$naReason<<-conditionMessage(e);NULL})
      if(!is.null(fit)){row$p<-as.numeric(fit$p.value);if(!is.null(fit$conf.int)){row$ciLow<-fit$conf.int[1];row$ciHigh<-fit$conf.int[2]};if(!is.finite(row$p))row$naReason<-'UNDEFINED_TEST'}
      if(multi&&!is.null(fit)){
        for(pair in posthocPairs){ii<-which(groups==pair[1]&is.finite(tx[,j]));jj<-which(groups==pair[2]&is.finite(tx[,j]));pv<-tryCatch({if(test=='anova'){df<-sum(is.finite(tx[,j])&groups%in%cmp$groups)-length(cmp$groups);mse<-sum(vapply(cmp$groups,function(g){w<-tx[groups==g,j];sum((w-mean(w,na.rm=TRUE))^2,na.rm=TRUE)},0))/df;tstat<-(mean(tx[jj,j])-mean(tx[ii,j]))/sqrt(mse*(1/length(ii)+1/length(jj)));2*pt(-abs(tstat),df)}else if(test=='welch-anova')t.test(tx[jj,j],tx[ii,j])$p.value else suppressWarnings(wilcox.test(tx[jj,j],tx[ii,j],exact=FALSE)$p.value)},error=function(e)NA_real_)
          posthoc[[length(posthoc)+1]]<-list(featureId=z$featureIds[j],comparison=paste(pair[2],'vs',pair[1]),method=switch(test,anova='pooled-variance-t','welch-anova'='pairwise-welch',kruskal='pairwise-wilcoxon'),p=pv,padj=NA_real_)
        }
      }
      results[[length(results)+1]]<-row
    }
  }
  adjust<-a$adjust%||%'BH';scope<-a$adjustScope%||%'comparison'
  list(results=adjust_rows(results,adjust,scope),posthoc=if(length(posthoc))adjust_rows(posthoc,adjust,scope)else list(),adjust=adjust,adjustScope=scope,warnings=c(z$audit$warnings,if(adjust=='none')list('MULTIPLE_TESTING_UNADJUSTED')else list()),matrixStrata=z$audit,inferenceSource='observed-only biological-unit-condition means',transform=inferenceTransform,foldChangeSource='unscaled untransformed observed positive group means')
}
analysis_pair_budget <- function(n,limit,code) {
  if(as.double(n)*(n-1)/2>limit)fail(code)
  invisible(TRUE)
}
cluster_axis <- function(x,distance,linkage) {
  if(nrow(x)<2)return(list(order=seq_len(nrow(x)),merge=matrix(integer(),0,2),height=numeric(),labels=character()))
  analysis_pair_budget(nrow(x),1000000,'CLUSTER_DISTANCE_LIMIT')
  choice(distance,c('euclidean','manhattan','pearson','spearman'),'DISTANCE');choice(linkage,c('average','complete','single','ward.D2'),'LINKAGE')
  if(linkage=='ward.D2'&&distance!='euclidean')fail('WARD_REQUIRES_EUCLIDEAN')
  d<-if(distance%in%c('euclidean','manhattan'))dist(x,method=distance)else as.dist(1-cor(t(x),method=distance))
  if(any(!is.finite(d)))fail('DISTANCE_UNDEFINED');h<-hclust(d,method=linkage);list(order=h$order,merge=h$merge,height=h$height,labels=h$labels%||%as.character(seq_len(nrow(x))))
}
analyze_dataset <- function(dataset,recipe=list(),analysis=list(method='preprocess')) {
  method<-choice(analysis$method,c('preprocess','pca','heatmap','compare','correlation','distribution'),'UNSUPPORTED_METHOD')
  if(method%in%c('compare','correlation','distribution')) {
    p<-NULL
    if(method=='compare')data<-compare_data(dataset,analysis)
    if(method=='distribution'){
      z<-prepare_independent(dataset,FALSE,allow_mixed_matrix_types=isTRUE(analysis$allowMixedMatrixTypes));cols<-which(vapply(z$features,function(f)!isTRUE(f$isInternalStandard)||isTRUE(analysis$includeInternalStandards),logical(1)));z$matrix<-z$matrix[,cols,drop=FALSE];z$featureIds<-z$featureIds[cols];z$features<-z$features[cols];g<-vapply(z$samples,function(s)s$group,character(1));data<-list(points=lapply(seq_len(nrow(z$matrix)),function(i)list(sampleId=z$samples[[i]]$id,biologicalUnitId=z$samples[[i]]$biologicalUnitId,group=g[i],values=z$matrix[i,])),featureIds=z$featureIds,summaries=lapply(seq_len(ncol(z$matrix)),function(j)list(featureId=z$featureIds[j],groups=setNames(lapply(unique(g),function(k)summary_values(z$matrix[g==k,j])),unique(g)))),source='observed-only biological-unit-condition means')
      units<-unique(vapply(z$features,function(f)f$unit%||%'',character(1)));mixed<-length(units[nzchar(units)])>1
      data$composition<-lapply(seq_len(nrow(z$matrix)),function(i){v<-z$matrix[i,];reason<-if(mixed)'MIXED_UNITS'else if(any(!is.finite(v)))'INCOMPLETE_VALUES'else if(any(v<0))'NEGATIVE_VALUES'else if(sum(v)<=0)'ZERO_TOTAL'else NULL;list(sampleId=z$samples[[i]]$id,group=g[i],proportions=if(is.null(reason))v/sum(v)else rep(NA_real_,length(v)),naReason=reason)})
    }
    if(method=='correlation'){
      z<-prepare_independent(dataset,allow_mixed_matrix_types=isTRUE(analysis$allowMixedMatrixTypes));units<-vapply(z$samples,function(s)s$biologicalUnitId,character(1));subjects<-vapply(z$samples,function(s)s$subjectId,character(1));if(anyDuplicated(units)||anyDuplicated(subjects[nzchar(subjects)]))fail('REPEATED_CONDITION_REQUIRES_PAIRED_METHOD');cols<-which(vapply(z$features,function(f)!isTRUE(f$isInternalStandard)||isTRUE(analysis$includeInternalStandards),logical(1)));z$matrix<-z$matrix[,cols,drop=FALSE];z$featureIds<-z$featureIds[cols];if(ncol(z$matrix)<2)fail('CORRELATION_FEATURES');analysis_pair_budget(ncol(z$matrix),250000,'CORRELATION_PAIR_LIMIT');cm<-analysis$correlation%||%'pearson';choice(cm,c('pearson','spearman'),'CORRELATION_METHOD');rows<-list();pairs<-combn(seq_len(ncol(z$matrix)),2)
      for(k in seq_len(ncol(pairs))){
        i<-pairs[1,k];j<-pairs[2,k]
        ok<-is.finite(z$matrix[,i])&is.finite(z$matrix[,j]);n<-sum(ok)
        fit<-if(n>=3)tryCatch(suppressWarnings(cor.test(z$matrix[ok,i],z$matrix[ok,j],method=cm,exact=FALSE)),error=function(e)NULL)else NULL
        valid<-!is.null(fit)&&is.finite(fit$estimate)&&is.finite(fit$p.value)
        rows[[k]]<-list(featureId=z$featureIds[i],otherFeatureId=z$featureIds[j],comparison='all-correlations',n=n,r=if(valid)unname(fit$estimate)else NA_real_,p=if(valid)fit$p.value else NA_real_,padj=NA_real_,naReason=if(valid)NULL else 'INSUFFICIENT_N_OR_VARIANCE')
      }
      data<-list(results=adjust_rows(rows,analysis$adjust%||%'BH','all'),method=cm,source='observed-only biological-unit-condition means')
    }
  }else{
    p<-fit_recipe(dataset,recipe);x<-p$matrix
    if(method=='preprocess')data<-list(matrix=x,sampleIds=p$sampleIds,featureIds=p$featureIds)
    if(method=='pca'){
      if(any(!is.finite(x)))fail('PCA_REQUIRES_COMPLETE_FINITE_MATRIX');if(nrow(x)<2||ncol(x)<1)fail('PCA_DIMENSIONS')
      centered<-p$state$recipe$scale$axis=='feature'&&p$state$recipe$scale$method%in%c('center','uv','pareto')
      center<-if(centered)FALSE else analysis$center%||%TRUE
      pc<-prcomp(x,center=center,scale.=FALSE);ev<-pc$sdev^2
      if(any(!is.finite(ev))||!is.finite(sum(ev)))fail('PCA_NONFINITE_VARIANCE')
      rank<-sum(pc$sdev>max(pc$sdev)*sqrt(.Machine$double.eps))
      if(sum(ev)<=0||rank<1)fail('PCA_ZERO_RANK')
      ncomp<-analysis$components%||%rank
      if(length(ncomp)!=1||ncomp<1||ncomp>rank||ncomp!=as.integer(ncomp))fail('PCA_COMPONENTS')
      data<-list(scores=pc$x[,seq_len(ncomp),drop=FALSE],loadings=pc$rotation[,seq_len(ncomp),drop=FALSE],eigenvalues=ev,explained=ev/sum(ev),cumulative=cumsum(ev/sum(ev)),rank=rank,center=pc$center,sampleIds=p$sampleIds,featureIds=p$featureIds)
    }
    if(method=='heatmap'){
      if(any(!is.finite(x)))fail('HEATMAP_REQUIRES_COMPLETE_FINITE_MATRIX');display<-analysis$displayScale%||%'none';choice(display,c('none','feature-z','sample-z'),'DISPLAY_SCALE')
      shown<-switch(display,none=x,'feature-z'=scale(x),'sample-z'=t(scale(t(x))));if(any(!is.finite(shown)))fail('DISPLAY_SCALE_UNDEFINED')
      rt<-if(isFALSE(analysis$clusterRows))NULL else cluster_axis(shown,analysis$rowDistance%||%'euclidean',analysis$rowLinkage%||%'average');ct<-if(isFALSE(analysis$clusterColumns))NULL else cluster_axis(t(shown),analysis$columnDistance%||%'euclidean',analysis$columnLinkage%||%'average')
      data<-list(matrix=shown,analysisMatrix=x,rowOrder=if(is.null(rt))seq_len(nrow(x))else rt$order,columnOrder=if(is.null(ct))seq_len(ncol(x))else ct$order,rowTree=rt,columnTree=ct,sampleIds=p$sampleIds,featureIds=p$featureIds,displayScale=display)
    }
  }
  if(method%in%c('compare','correlation','distribution')){
    if(method!='compare'){data$matrixStrata<-z$audit;data$warnings<-z$audit$warnings}
    data$matrixStrata$reason<-analysis$mixedMatrixTypesReason%||%NULL
  }
  list(schemaVersion=1,method=method,data=data,preprocessing=p,provenance=list(engineVersion='1.0.0',datasetId=dataset$id%||%NULL,recipeSchemaVersion=recipe$schemaVersion%||%1,recipeApplied=!is.null(p),matrixStrata=data$matrixStrata%||%NULL,rVersion=as.character(getRversion()),packages=list(stats=as.character(packageVersion('stats')))))
}
