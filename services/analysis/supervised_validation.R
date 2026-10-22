# Deterministic nested cross-validation. The package's internal row-roundrobin
# cross-validation is required for fitting, but is never reported as validation.
supervised_seed <- function(seed,offset) as.integer((as.double(seed)+as.double(offset)*104729)%%2147483646)

supervised_folds <- function(y,classes,k,seed,code) {
  if(any(table(factor(y,levels=classes))<k)) fail(code)
  set.seed(seed); folds<-integer(length(y))
  for(g in classes) {
    idx<-which(y==g)
    folds[idx[sample.int(length(idx))]]<-rep(seq_len(k),length.out=length(idx))
  }
  folds
}

supervised_accuracy <- function(truth,predicted,classes) {
  cm<-table(factor(truth,levels=classes),factor(predicted,levels=classes))
  list(confusion=matrix(as.integer(cm),length(classes),length(classes)),
       balancedAccuracy=mean(diag(cm)/rowSums(cm)))
}

supervised_select <- function(dataset,recipe,cfg,classes,seed,audit=TRUE) {
  y<-vapply(dataset$samples,function(s)s$group,'')
  folds<-supervised_folds(y,classes,cfg$innerFolds,seed,'INNER_FOLDS_INFEASIBLE')
  results<-vector('list',length(cfg$candidates))
  for(j in seq_along(cfg$candidates)) {
    candidate<-cfg$candidates[[j]]; predicted<-rep(NA_character_,length(y)); parts<-list(); failures<-list()
    for(f in seq_len(cfg$innerFolds)) {
      train<-which(folds!=f);test<-which(folds==f)
      attempt<-tryCatch({
        p<-supervised_partition(dataset,recipe,train,test)
        fit<-supervised_fit(p$training$matrix,factor(y[train],levels=classes),candidate)
        response<-supervised_response(fit$model,p$test$matrix)
        predicted[test]<-supervised_class(response,classes)
        if(audit) parts[[length(parts)+1]]<-list(fold=f,testSampleIds=p$test$sampleIds,
          preprocessing=supervised_recipe_audit(p$training),fit=fit$audit)
        TRUE
      },error=function(e){failures[[length(failures)+1]]<<-list(fold=f,code=conditionMessage(e));FALSE})
    }
    valid<-!length(failures)&&!anyNA(predicted)
    results[[j]]<-list(components=candidate,valid=valid,
      balancedAccuracy=if(valid)supervised_accuracy(y,predicted,classes)$balancedAccuracy else NA_real_,
      failures=failures,folds=parts)
  }
  valid<-which(vapply(results,function(r)r$valid,logical(1)))
  if(!length(valid)) {
    reasons<-unique(unlist(lapply(results,function(r)vapply(r$failures,function(f)f$code,''))))
    condition<-structure(list(message='NO_VALID_CANDIDATE',call=NULL,candidates=results,reasons=reasons),class=c('supervised_selection_error','error','condition'))
    stop(condition)
  }
  scores<-vapply(results[valid],function(r)r$balancedAccuracy,0)
  winner<-valid[which.max(scores)] # candidates sorted by increasing component count
  list(selected=cfg$candidates[[winner]],criterion='pooled inner OOF balanced accuracy',
       seed=seed,candidates=results)
}

supervised_nested <- function(dataset,recipe,cfg,classes,seed,audit=TRUE) {
  y<-vapply(dataset$samples,function(s)s$group,'');predictions<-list();foldAudit<-list()
  repeatResults<-vector('list',cfg$repeats)
  for(repetition in seq_len(cfg$repeats)) {
    outerSeed<-supervised_seed(seed,repetition)
    folds<-supervised_folds(y,classes,cfg$outerFolds,outerSeed,'OUTER_FOLDS_INFEASIBLE')
    predicted<-rep(NA_character_,length(y))
    for(f in seq_len(cfg$outerFolds)) {
      train<-which(folds!=f);test<-which(folds==f)
      innerSeed<-supervised_seed(seed,100L*repetition+f)
      selection<-supervised_select(supervised_subset(dataset,train),recipe,cfg,classes,innerSeed,audit)
      p<-supervised_partition(dataset,recipe,train,test)
      fitted<-supervised_fit(p$training$matrix,factor(y[train],levels=classes),selection$selected)
      response<-supervised_response(fitted$model,p$test$matrix)
      truth<-supervised_truth(y[test],classes)
      prevalence<-colMeans(supervised_truth(y[train],classes))
      predicted[test]<-supervised_class(response,classes)
      for(i in seq_along(test)) {
        sample<-dataset$samples[[test[i]]]
        predictions[[length(predictions)+1]]<-list(sampleId=sample$id,biologicalUnitId=sample$biologicalUnitId,
          repetition=repetition,fold=f,trueClass=y[test[i]],trueResponse=unname(truth[i,]),
          response=unname(response[i,]),trainingPrevalence=unname(prevalence),predictedClass=predicted[test[i]])
      }
      foldAudit[[length(foldAudit)+1]]<-if(audit)list(repetition=repetition,fold=f,outerSeed=outerSeed,innerSeed=innerSeed,
        testSampleIds=p$test$sampleIds,trainingSampleIds=p$training$sampleIds,
        selection=selection,preprocessing=supervised_recipe_audit(p$training),fit=fitted$audit)
      else list(repetition=repetition,fold=f,outerSeed=outerSeed,innerSeed=innerSeed)
    }
    repeatResults[[repetition]]<-c(list(repetition=repetition),supervised_accuracy(y,predicted,classes))
  }
  press<-sum(vapply(predictions,function(p)sum((p$response-p$trueResponse)^2),0))
  null<-sum(vapply(predictions,function(p)sum((p$trainingPrevalence-p$trueResponse)^2),0))
  list(balancedAccuracy=mean(vapply(repeatResults,function(r)r$balancedAccuracy,0)),
       confusion=Reduce('+',lapply(repeatResults,function(r)r$confusion)),
       confusionDefinition='sum of OOF counts across repeats, not independent sample size',
       byRepeat=repeatResults,PRESS=press,PRESS_null=null,
       Q2_trainingPrevalence=if(null>0)1-press/null else NA_real_,
       Q2NaReason=if(null>0)NULL else 'ZERO_NULL_PRESS',
       predictions=predictions,folds=foldAudit)
}

supervised_permutation_summary <- function(distribution,seeds,failures,observed,requested) {
  failed<-length(failures);completed<-sum(is.finite(distribution))
  exceedances<-sum(distribution>=observed,na.rm=TRUE)
  list(statistic='mean repeated pooled outer OOF balanced accuracy',observed=observed,
       requested=requested,completed=completed,failed=failed,
       p=if(requested>0&&failed==0&&completed==requested)(1+exceedances)/(requested+1)else NA_real_,
       pNaReason=if(requested==0)'PERMUTATION_NOT_REQUESTED'else if(failed>0||completed!=requested)'REQUIRED_PERMUTATION_FAILED'else NULL,
       exceedances=exceedances,distribution=distribution,seeds=seeds,failures=failures,
       denominator=requested+1,tiesCountAsExceedances=TRUE)
}

supervised_permutations <- function(dataset,recipe,cfg,classes,observed) {
  distribution<-rep(NA_real_,cfg$permutations);seeds<-integer(cfg$permutations);failures<-list()
  y<-vapply(dataset$samples,function(s)s$group,'')
  for(b in seq_len(cfg$permutations)) {
    seeds[b]<-supervised_seed(cfg$seed,100000L+b);set.seed(seeds[b])
    permuted<-dataset;labels<-y[sample.int(length(y))]
    for(i in seq_along(labels))permuted$samples[[i]]$group<-labels[i]
    # Splits are regenerated after permutation; no learned state is reused.
    result<-tryCatch(supervised_nested(permuted,recipe,cfg,classes,seeds[b],audit=FALSE),
      error=function(e){
        failures[[length(failures)+1]]<<-list(permutation=b,seed=seeds[b],code=conditionMessage(e),
                                             candidates=e$candidates %||% NULL,reasons=e$reasons %||% NULL)
        NULL
      })
    if(!is.null(result))distribution[b]<-result$balancedAccuracy
  }
  supervised_permutation_summary(distribution,seeds,failures,observed,cfg$permutations)
}
