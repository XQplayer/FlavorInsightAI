source('services/analysis/tests/test_engine.R')
suppressPackageStartupMessages(library(jsonlite))
synthetic<-fromJSON('services/analysis/tests/fixtures/synthetic-3groups.json',simplifyVector=FALSE)
for(test in c('anova','welch-anova','kruskal')){
 r<-analyze_dataset(synthetic,list(),list(method='compare',test=test,groups=c('Control','TreatmentA','TreatmentB')))
 check(length(r$data$results)==8&&length(r$data$posthoc)==24,paste(test,'omnibus and posthoc dimensions'))
 check(all(vapply(r$data$results,function(v)is.finite(v$p)&&is.finite(v$padj),logical(1))),paste(test,'finite adjusted p'))
}
for(method in c('median','pqn')){
 p<-fit_recipe(synthetic,list(normalize=list(method=method)))
 check(all(is.finite(p$matrix)),paste(method,'finite normalization'))
 same<-apply_recipe(synthetic,p$state);check(max(abs(same$matrix-p$matrix))<1e-12,paste(method,'fitted apply identical'))
}
for(method in c('center','uv','pareto','minmax','robust'))for(axis in c('feature','sample')){
 p<-fit_recipe(synthetic,list(scale=list(method=method,axis=axis)));check(all(is.finite(p$matrix)),paste(method,axis,'scale'))
}
for(distance in c('euclidean','manhattan','pearson','spearman')){
 h<-analyze_dataset(synthetic,list(),list(method='heatmap',rowDistance=distance,columnDistance=distance))
 check(setequal(h$data$rowOrder,1:24)&&setequal(h$data$columnOrder,1:8),paste(distance,'valid clustering orders'))
}
for(test in c('welch','student','wilcoxon')){
 r<-analyze_dataset(synthetic,list(),list(method='compare',test=test,control='Control',treatment='TreatmentA',adjust='holm'))
 check(length(r$data$results)==8,paste(test,'feature count'))
}
for(cm in c('pearson','spearman')){
 r<-analyze_dataset(synthetic,list(),list(method='correlation',correlation=cm));check(length(r$data$results)==28&&r$data$results[[1]]$n==24,paste(cm,'pairwise n'))
}
missing<-synthetic;missing$matrix[[1]][[1]]<-NULL
# Preserve list dimensions for an R representation of JSON null.
missing$matrix[[1]]<-append(synthetic$matrix[[1]][-1],list(NULL),after=0)
missing$quality$cellStates[[1]][[1]]<-'missing'
g<-fit_recipe(missing,list(filter=list(maxMissing=.1,missingScope='group')))
check(!'synthetic-f1'%in%g$featureIds,'groupwise missing filter uses worst group')
bad<-fixture(matrix(c(1,2,3,4,2,4,6,8),4));bad$quality$cellStates[[1]][[1]]<-'missing'
check(is.na(prepare_independent(bad)$matrix[1,1]),'missing label overrides nonnull observed inference')
err(fit_recipe(bad,list(schemaVersion=2)),'RECIPE_SCHEMA_VERSION')
cat('METHOD TESTS PASSED\n')
