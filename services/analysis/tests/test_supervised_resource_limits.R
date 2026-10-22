args<-commandArgs(trailingOnly=TRUE)
base<-if(length(args))args[[1]]else 'services/analysis'
source(file.path(base,'preprocess.R'));source(file.path(base,'statistics.R'))
check<-function(ok,label){if(!isTRUE(ok))stop(paste('FAIL:',label));cat('PASS:',label,'\n')}
err<-function(expr,code){message<-tryCatch({force(expr);''},error=function(e)conditionMessage(e));check(identical(message,code),code)}
check(exists('analysis_pair_budget'),'quadratic allocation guard exists')
check(analysis_pair_budget(707,250000,'CORRELATION_PAIR_LIMIT'),'correlation within pair budget')
err(analysis_pair_budget(708,250000,'CORRELATION_PAIR_LIMIT'),'CORRELATION_PAIR_LIMIT')
check(analysis_pair_budget(1414,1000000,'CLUSTER_DISTANCE_LIMIT'),'clustering within distance budget')
err(analysis_pair_budget(1415,1000000,'CLUSTER_DISTANCE_LIMIT'),'CLUSTER_DISTANCE_LIMIT')
# Only small vectors/matrices: guards run before any combn/cor/dist allocation.
features<-lapply(1:708,function(i)list(id=paste0('f',i)))
d<-list(schemaVersion=1,id='public-pair-limit',samples=lapply(1:3,function(i)list(id=paste0('s',i),group='C',biologicalUnitId=paste0('u',i))),features=features,matrix=rep(list(as.list(seq_len(708))),3),quality=list(cellStates=rep(list(as.list(rep('observed',708))),3)),provenance=list(independenceConfirmed=TRUE))
err(analyze_dataset(d,list(),list(method='correlation')),'CORRELATION_PAIR_LIMIT')
err(cluster_axis(matrix(seq_len(1415),ncol=1),'euclidean','average'),'CLUSTER_DISTANCE_LIMIT')

source(file.path(base,'supervised.R'))
# Adjacent permutation counts straddle the fit budget; option validation does
# not load data or fit models.
budgetOptions<-list(method='plsda',outerFolds=10,innerFolds=10,repeats=10,
                    predictiveComponents=1:5,permutations=38)
budgetConfig<-supervised_options(budgetOptions)
check(budgetConfig$estimatedFits==198951,'supervised fit budget permits 198951 estimated fits')
err(supervised_options(modifyList(budgetOptions,list(permutations=39))),'SUPERVISED_FIT_BUDGET')

# Only ~10000 public synthetic cells. Deliberately invalid recipe stops the
# within-budget case immediately AFTER the cell-fit guard and BEFORE any CV,
# preprocessing or model fit; the over-budget case must take precedence.
budgetDataset<-function(p)list(schemaVersion=1,id='public-cell-fit-budget',
  samples=lapply(1:10,function(i)list(id=paste0('s',i),group=if(i<=5)'C'else 'T',biologicalUnitId=paste0('u',i))),
  features=lapply(seq_len(p),function(i)list(id=paste0('f',i))),
  matrix=rep(list(as.list(seq_len(p))),10),
  quality=list(cellStates=rep(list(as.list(rep('observed',p))),10)),
  provenance=list(independenceConfirmed=TRUE))
check(budgetConfig$estimatedFits*10*1005<=2e9&&budgetConfig$estimatedFits*10*1006>2e9,
      'adjacent feature counts straddle supervised cell-fit budget')
stopBeforeFitting<-list(scale=list(method='test-only-stop-before-fitting'))
err(analyze_supervised(budgetDataset(1005),stopBeforeFitting,budgetOptions),'SCALE_METHOD')
err(analyze_supervised(budgetDataset(1006),stopBeforeFitting,budgetOptions),'SUPERVISED_CELL_FIT_BUDGET')
cat('RESOURCE LIMIT TESTS PASSED\n')
