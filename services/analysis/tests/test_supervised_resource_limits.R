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
cat('RESOURCE LIMIT TESTS PASSED\n')
