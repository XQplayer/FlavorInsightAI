source('services/analysis/preprocess.R')
fixture <- function(value=NULL) list(schemaVersion=1,samples=lapply(1:3,function(i)list(id=paste0('s',i),include=TRUE)),features=list(list(id='f',unit='x')),matrix=list(list(value),list(2),list(4)),quality=list(cellStates=list(list('qc-filtered'),list('observed'),list('observed')),unknownSourceMask=list(list(TRUE),list(FALSE),list(FALSE))))
for(value in list(NULL,999)) {
 d<-fixture(value);read<-read_dataset(d);stopifnot(read$q[1,1]=='qc-filtered',is.na(read$x[1,1]))
 out<-fit_recipe(d,list(impute=list(method='median')));stopifnot(is.na(out$matrix[1,1]),out$cellStates[1,1]=='qc-filtered')
}
cat('QC state/mask priority regression passed\n')
