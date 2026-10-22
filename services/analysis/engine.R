#!/usr/bin/env Rscript
args<-commandArgs(trailingOnly=TRUE)
if(length(args)!=2)stop('Expected trusted service input and output files')
scriptArg<-grep('^--file=',commandArgs(),value=TRUE)[1]
base<-dirname(normalizePath(sub('^--file=','',scriptArg),mustWork=TRUE))
source(file.path(base,'preprocess.R'));source(file.path(base,'statistics.R'))
suppressPackageStartupMessages(library(jsonlite))
result<-tryCatch({
  request<-fromJSON(args[1],simplifyVector=FALSE)
  if(!is.null(request$analysis$method)&&request$analysis$method%in%c('plsda','oplsda')){
    if(!file.exists(file.path(base,'supervised.R')))fail('SUPERVISED_NOT_AVAILABLE')
    source(file.path(base,'supervised.R'));if(!exists('analyze_supervised'))fail('SUPERVISED_NOT_AVAILABLE')
    analyze_supervised(request$dataset,request$recipe%||%list(),request$analysis)
  }else analyze_dataset(request$dataset,request$recipe%||%list(),request$analysis)
},error=function(e)list(error=list(code=conditionMessage(e))))
# Contract vectors remain JSON arrays even when there is just one component.
array_fields<-c('sampleIds','featureIds','trainingSampleIds','sourceSampleIds','sourceMatrixTypes','matrixTypes','eigenvalues','explained','cumulative','rowOrder','columnOrder','order','height','labels','values','proportions','denom','normalizationReference','classOrder','responseClassOrder','testSampleIds','preprocessedFeatureIds','response','trueResponse','trainingPrevalence','distribution','seeds','reasons')
json_shape<-function(value,key='',path=''){
  if(is.matrix(value))return(value)
  if(is.atomic(value)&&(key%in%array_fields||(key=='center'&&is.numeric(value))||
     (key=='value'&&grepl('/state/impute$',path))))return(I(value))
  if(is.list(value)){nm<-names(value);return(lapply(seq_along(value),function(i)json_shape(value[[i]],if(is.null(nm))''else nm[i],paste(path,key,sep='/')))|>setNames(nm))}
  value
}
write_json(json_shape(result),args[2],auto_unbox=TRUE,na='null',null='null',digits=16,matrix='rowmajor',pretty=FALSE)
if(!is.null(result$error))quit(status=1)
