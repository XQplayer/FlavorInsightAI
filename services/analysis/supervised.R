# Supervised models use independent, observed-only biological-unit means.
# Learned preprocessing and component selection live inside every CV partition.
supervised_integer <- function(value, default, low, high, code) {
  value <- value %||% default
  if(!is.numeric(value) || length(value)!=1 || !is.finite(value) ||
     value!=floor(value) || value<low || value>high) fail(code)
  as.integer(value)
}

supervised_options <- function(a) {
  allowed <- c('method','groups','classOrder','allowMixedMatrixTypes','mixedMatrixTypesReason',
               'acknowledgeExploratory','outerFolds','innerFolds','repeats','seed','permutations',
               'predictiveComponents','orthogonalComponents')
  if(!is.list(a) || any(!names(a)%in%allowed)) fail('SUPERVISED_OPTIONS')
  method <- choice(a$method,c('plsda','oplsda'),'UNSUPPORTED_METHOD')
  for(key in c('allowMixedMatrixTypes','acknowledgeExploratory'))
    if(!is.null(a[[key]]) && (!is.logical(a[[key]]) || length(a[[key]])!=1 || is.na(a[[key]]))) fail('SUPERVISED_BOOLEAN')
  if(!is.null(a$mixedMatrixTypesReason) && (!is.character(a$mixedMatrixTypesReason)||
     length(a$mixedMatrixTypesReason)!=1||is.na(a$mixedMatrixTypesReason))) fail('MIXED_MATRIX_REASON')
  grid <- function(value,default,low,high) {
    if(is.list(value)&&any(!vapply(value,function(v)is.numeric(v)&&length(v)==1,logical(1)))) fail('COMPONENT_GRID')
    value <- unlist(value %||% default,use.names=FALSE)
    if(!is.numeric(value)||!length(value)||length(value)>5||any(!is.finite(value))||
       any(value!=floor(value))||any(value<low|value>high)||anyDuplicated(value)) fail('COMPONENT_GRID')
    sort(as.integer(value))
  }
  pred <- grid(a$predictiveComponents,if(method=='oplsda')1 else c(1,2),1,5)
  ortho <- grid(a$orthogonalComponents,if(method=='oplsda')1 else 0,0,5)
  if(method=='oplsda'&&(!identical(pred,1L)||any(ortho<1))) fail('OPLS_COMPONENTS')
  if(method=='plsda'&&!identical(ortho,0L)) fail('PLS_ORTHOGONAL_COMPONENTS')
  candidates <- lapply(seq_along(pred),function(i)lapply(ortho,function(o)list(predictive=pred[i],orthogonal=o)))
  candidates <- unlist(candidates,recursive=FALSE)
  candidates <- candidates[order(vapply(candidates,function(c)c$predictive+c$orthogonal,0),
                                 vapply(candidates,function(c)c$predictive,0))]
  cfg <- list(method=method,outerFolds=supervised_integer(a$outerFolds,5,2,10,'OUTER_FOLDS'),
              innerFolds=supervised_integer(a$innerFolds,3,2,10,'INNER_FOLDS'),
              repeats=supervised_integer(a$repeats,1,1,10,'CV_REPEATS'),
              seed=supervised_integer(a$seed,20261023,0,2147000000,'RANDOM_SEED'),
              permutations=supervised_integer(a$permutations,200,0,1000,'PERMUTATIONS'),
              candidates=candidates)
  cfg$estimatedFits <- (cfg$permutations+1)*cfg$repeats*cfg$outerFolds*
    (cfg$innerFolds*length(candidates)+1)+cfg$innerFolds*length(candidates)+1
  if(cfg$estimatedFits>200000) fail('SUPERVISED_FIT_BUDGET')
  cfg
}

supervised_labels <- function(value,code) {
  if(is.list(value)&&any(!vapply(value,function(v)is.character(v)&&length(v)==1,logical(1)))) fail(code)
  value<-unlist(value,use.names=FALSE)
  if(!is.character(value)||!length(value)||anyNA(value)||any(!nzchar(value))||anyDuplicated(value)) fail(code)
  value
}

supervised_dataset <- function(dataset,a) {
  method <- choice(a$method,c('plsda','oplsda'),'UNSUPPORTED_METHOD')
  selected <- if(is.null(a$groups)) NULL else supervised_labels(a$groups,'SUPERVISED_GROUPS')
  z <- prepare_independent(dataset,require_confirmation=TRUE,
                           allow_mixed_matrix_types=isTRUE(a$allowMixedMatrixTypes),groups=selected)
  groups <- vapply(z$samples,function(s)s$group,'')
  units <- vapply(z$samples,function(s)s$biologicalUnitId,'')
  subjects <- vapply(z$samples,function(s)s$subjectId,'')
  if(anyDuplicated(units)||anyDuplicated(subjects[nzchar(subjects)])) fail('PAIRED_SUPERVISED_UNSUPPORTED')
  classes <- supervised_labels(a$classOrder %||% selected %||% unique(groups),'CLASS_ORDER')
  if(!setequal(classes,groups)) fail('CLASS_ORDER')
  if(length(classes)<2) fail('SUPERVISED_REQUIRES_TWO_CLASSES')
  if(method=='oplsda'&&length(classes)!=2) fail('OPLS_REQUIRES_TWO_CLASSES')
  counts <- table(factor(groups,levels=classes))
  if(any(counts<=2)) fail('INSUFFICIENT_INDEPENDENT_UNITS')
  exploratory <- any(counts<5)
  if(exploratory&&!isTRUE(a$acknowledgeExploratory)) fail('EXPLORATORY_ACKNOWLEDGEMENT_REQUIRED')

  # IDs and order depend on units, not the number/order of technical replicates.
  ord <- order(units,method='radix'); z$samples<-z$samples[ord]; z$matrix<-z$matrix[ord,,drop=FALSE]
  raw <- read_dataset(dataset)
  q <- matrix('missing',nrow(z$matrix),ncol(z$matrix))
  lineage <- vector('list',nrow(z$matrix))
  for(i in seq_len(nrow(z$matrix))) {
    s <- z$samples[[i]]; idx <- match(s$sourceSampleIds,raw$sampleIds)
    z$samples[[i]]$id <- paste0('unit:',s$biologicalUnitId)
    hasQC <- colSums(raw$q[idx,,drop=FALSE]=='qc-filtered')>0
    q[i,hasQC] <- 'qc-filtered'; q[i,is.finite(z$matrix[i,])] <- 'observed'
    lineage[[i]] <- list(sampleId=z$samples[[i]]$id,sourceSampleIds=s$sourceSampleIds,
                         sourceCellStates=raw$q[idx,,drop=FALSE])
  }
  aggregated <- dataset
  aggregated$samples <- z$samples; aggregated$features <- z$features
  aggregated$matrix <- lapply(seq_len(nrow(z$matrix)),function(i)as.list(z$matrix[i,]))
  aggregated$quality <- list(cellStates=lapply(seq_len(nrow(q)),function(i)as.list(q[i,])))
  z$audit$reason <- a$mixedMatrixTypesReason %||% NULL
  list(dataset=aggregated,classOrder=classes,independentN=nrow(z$matrix),
       counts=as.list(setNames(as.integer(counts),classes)),exploratory=exploratory,
       matrixStrata=z$audit,sourceCellLineage=lineage)
}

supervised_fit <- function(x,y,components) {
  if(any(!is.finite(x))) fail('SUPERVISED_REQUIRES_COMPLETE_FINITE_MATRIX')
  if(!is.factor(y)||any(table(y)==0)) fail('TRAINING_CLASS_ABSENT')
  rank <- min(qr(x)$rank,nrow(x)-1L)
  if(components$predictive+components$orthogonal>rank) fail('COMPONENT_RANK_EXCEEDED')
  warnings <- character()
  model <- withCallingHandlers(ropls::opls(x,y,predI=components$predictive,
               orthoI=components$orthogonal,permI=0,scaleC='none',log10L=FALSE,
               crossvalI=min(7L,nrow(x)),fig.pdfC='none',info.txtC='none'),
               warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart('muffleWarning')})
  if(nrow(model@summaryDF)!=1||model@summaryDF[1,'pre']!=components$predictive||
     model@summaryDF[1,'ort']!=components$orthogonal) fail('REQUESTED_COMPONENTS_NOT_FITTED')
  if(any(!is.finite(model@coefficientMN))) fail('NONFINITE_MODEL_COEFFICIENTS')
  list(model=model,audit=list(rank=rank,components=components,
       roplsCrossvalI=min(7L,nrow(x)),warnings=as.list(unique(warnings))))
}

# Exact finite-X branch of the installed ropls predict(opls) method. These are
# unbounded continuous discriminant responses, NOT class labels/probabilities.
supervised_response <- function(model,newdata) {
  expected <- as.numeric(model@descriptionMC['X_variables',])
  if(ncol(newdata)!=expected) {
    if(length(model@xZeroVarVi)>0 && ncol(newdata)-expected==
       as.numeric(model@descriptionMC['near_zero_excluded_X_variables',]))
      newdata <- newdata[,-model@xZeroVarVi,drop=FALSE]
    else fail('PREDICTION_FEATURE_DIMENSIONS')
  }
  xt <- scale(newdata,model@xMeanVn,model@xSdVn)
  for(j in seq_len(as.integer(model@summaryDF[1,'ort']))) {
    score <- xt %*% model@orthoWeightMN[,j]
    # Explicit column shape also handles a one-row held-out matrix. ropls 1.44
    # predict() itself errors here for one row under R 4.6 (vector promotion).
    xt <- xt-tcrossprod(score,matrix(model@orthoLoadingMN[,j],ncol=1))
  }
  response <- sweep(sweep(xt %*% model@coefficientMN,2,model@ySdVn,'*'),2,model@yMeanVn,'+')
  if(any(!is.finite(response))) fail('NONFINITE_MODEL_PREDICTION')
  response
}

supervised_class <- function(response,classes) {
  if(length(classes)==2) return(classes[as.integer(response[,1]>.5)+1L])
  classes[max.col(response,ties.method='first')]
}

supervised_truth <- function(y,classes) {
  if(length(classes)==2) return(matrix(as.numeric(y==classes[2]),ncol=1))
  outer(y,classes,'==')*1
}

supervised_subset <- function(dataset,idx) {
  d <- dataset;d$samples<-d$samples[idx];d$matrix<-d$matrix[idx]
  d$quality$cellStates<-d$quality$cellStates[idx];d
}

supervised_recipe_audit <- function(p) {
  # KNN references are training-only and necessary for full reconstruction.
  list(trainingSampleIds=p$sampleIds,featureIds=p$featureIds,audit=p$audit,state=p$state)
}

supervised_partition <- function(dataset,recipe,training,test=NULL) {
  ids <- vapply(dataset$samples,function(s)s$id,'')
  p <- fit_recipe(dataset,recipe,training_ids=ids[training])
  if(any(!is.finite(p$matrix))) fail('SUPERVISED_REQUIRES_COMPLETE_FINITE_MATRIX')
  dimnames(p$matrix) <- list(p$sampleIds,p$featureIds)
  held <- if(is.null(test)) NULL else apply_recipe(supervised_subset(dataset,test),p$state)
  if(!is.null(held)) {
    if(any(!is.finite(held$matrix))) fail('SUPERVISED_REQUIRES_COMPLETE_FINITE_MATRIX')
    dimnames(held$matrix) <- list(held$sampleIds,held$featureIds)
  }
  list(training=p,test=held)
}

supervised_full_fit <- function(dataset,recipe,cfg,classes) {
  y <- vapply(dataset$samples,function(s)s$group,'')
  selection <- supervised_select(dataset,recipe,cfg,classes,supervised_seed(cfg$seed,90001L))
  p <- supervised_partition(dataset,recipe,seq_along(y))$training
  fitted <- supervised_fit(p$matrix,factor(y,levels=classes),selection$selected)
  m <- fitted$model
  featureIds <- rownames(m@loadingMN)
  list(selection=selection,components=selection$selected,fitAudit=fitted$audit,
       sampleIds=p$sampleIds,featureIds=featureIds,preprocessedFeatureIds=p$featureIds,
       R2X=unname(m@summaryDF[1,'R2X(cum)']),R2Y=unname(m@summaryDF[1,'R2Y(cum)']),
       scores=m@scoreMN,loadings=m@loadingMN,orthogonalScores=m@orthoScoreMN,
       orthogonalLoadings=m@orthoLoadingMN,
       VIP=lapply(seq_along(m@vipVn),function(j)list(featureId=names(m@vipVn)[j],value=unname(m@vipVn[j]))),
       preprocessing=supervised_recipe_audit(p))
}

analyze_supervised <- function(dataset,recipe=list(),analysis) {
  cfg <- supervised_options(analysis)
  if(!requireNamespace('ropls',quietly=TRUE)) fail('SUPERVISED_NOT_AVAILABLE')
  z <- supervised_dataset(dataset,analysis)
  if(cfg$estimatedFits*z$independentN*length(z$dataset$features)>2e9) fail('SUPERVISED_CELL_FIT_BUDGET')
  # One explicit acknowledgement covers the same matrix mixture in every partition.
  recipe <- recipe_defaults(recipe)
  recipe$filter$allowMixedMatrixTypes <- isTRUE(analysis$allowMixedMatrixTypes)
  validation <- supervised_nested(z$dataset,recipe,cfg,z$classOrder,cfg$seed)
  full <- supervised_full_fit(z$dataset,recipe,cfg,z$classOrder)
  permutation <- supervised_permutations(z$dataset,recipe,cfg,z$classOrder,validation$balancedAccuracy)
  warnings <- c('EXPLORATORY_DISCRIMINANT_MODEL_NOT_CAUSAL',
                'VIP_IS_NOT_A_P_VALUE_OR_EVIDENCE_OF_CAUSALITY',
                'CONTINUOUS_RESPONSES_ARE_NOT_PROBABILITIES',
                if(z$exploratory)'SMALL_N_EXPLORATORY_ACKNOWLEDGED',
                if(cfg$permutations<200)'LOW_PERMUTATION_COUNT',
                unlist(z$matrixStrata$warnings))
  data <- list(classOrder=z$classOrder,responseClassOrder=if(length(z$classOrder)==2)z$classOrder[2]else z$classOrder,
               responseEncoding=if(length(z$classOrder)==2)'first-class=0; second-class=1; strictly >0.5 selects second'else 'fixed-order one-hot; first argmax',
               independentN=z$independentN,classCounts=z$counts,exploratory=z$exploratory,
               samples=z$dataset$samples,sourceCellLineage=z$sourceCellLineage,
               matrixStrata=z$matrixStrata,options=cfg,fullFit=full,validation=validation,
               permutation=permutation,warnings=as.list(warnings))
  list(schemaVersion=1,method=cfg$method,data=data,preprocessing=full$preprocessing,
       provenance=list(engineVersion='1.0.0',datasetId=dataset$id %||% NULL,
         rVersion=as.character(getRversion()),packages=list(stats=as.character(packageVersion('stats')),ropls=as.character(packageVersion('ropls'))),
         recipeSchemaVersion=recipe$schemaVersion,recipeApplied=TRUE,
         source='observed-only independent biological-unit-condition means',
         matrixStrata=z$matrixStrata,validation='wrapper nested stratified independent-unit CV; not ropls internal CV'))
}

supervised_source_frames <- Filter(function(frame)!is.null(frame$ofile),sys.frames())
source(file.path(dirname(tail(supervised_source_frames,1)[[1]]$ofile),'supervised_validation.R'))
rm(supervised_source_frames)
