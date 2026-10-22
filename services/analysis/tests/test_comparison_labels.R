source('services/analysis/tests/test_engine.R')

# Display labels currently define adjustment families and plot selections. Reject
# collisions before aggregation/inference instead of silently merging contrasts.
labels <- c('A vs B','C','B','C vs A')
d <- fixture(cbind(1:12,c(2,5,3,8,6,11,9,14,10,17,13,20)),rep(labels,each=3))
before <- serialize(d,NULL)
contrasts <- list(list(control='A vs B',treatment='C'),list(control='B',treatment='C vs A'))
err(analyze_dataset(d,list(),list(method='compare',comparisons=contrasts)), 'AMBIGUOUS_COMPARISON_LABEL')
err(analyze_dataset(d,list(),list(method='compare',comparisons=contrasts,adjustScope='all')), 'AMBIGUOUS_COMPARISON_LABEL')
err(analyze_dataset(d,list(),list(method='compare',comparisons=rep(contrasts[1],2))), 'AMBIGUOUS_COMPARISON_LABEL')
for(method in c('anova','welch-anova','kruskal')){
  err(analyze_dataset(d,list(),list(method='compare',test=method,groups=labels)), 'AMBIGUOUS_COMPARISON_LABEL')
}
unconfirmed <- d;unconfirmed$provenance$independenceConfirmed <- FALSE
err(analyze_dataset(unconfirmed,list(),list(method='compare',comparisons=contrasts)), 'AMBIGUOUS_COMPARISON_LABEL')
check(identical(before,serialize(d,NULL)), 'collision rejection preserves source data and group names')

# A name containing "vs" is not banned when the requested labels are unambiguous.
normal <- list(list(control='A vs B',treatment='C'),list(control='A vs B',treatment='B'))
r <- analyze_dataset(d,list(),list(method='compare',comparisons=normal))$data
check(length(r$results)==4,'distinct explicit contrasts retain all result rows')
for(cmp in normal){
  label <- paste(cmp$treatment,'vs',cmp$control)
  rows <- Filter(function(row)identical(row$comparison,label),r$results)
  raw <- vapply(seq_len(2),function(j){
    values <- vapply(d$matrix,function(row)row[[j]],0)
    groups <- vapply(d$samples,function(s)s$group,'')
    t.test(values[groups==cmp$treatment],values[groups==cmp$control])$p.value
  },0)
  check(max(abs(vapply(rows,function(row)row$p,0)-raw))<1e-12,'distinct contrast p values unchanged')
  check(max(abs(vapply(rows,function(row)row$padj,0)-p.adjust(raw,'BH')))<1e-12,'distinct contrast BH family unchanged')
}
for(method in c('anova','welch-anova','kruskal')){
  r <- analyze_dataset(d,list(),list(method='compare',test=method,groups=labels[1:3]))$data
  check(length(r$results)==2&&length(r$posthoc)==6,paste(method,'unambiguous omnibus/posthoc rows unchanged'))
  for(label in unique(vapply(r$posthoc,function(row)row$comparison,''))){
    rows <- Filter(function(row)identical(row$comparison,label),r$posthoc)
    check(max(abs(vapply(rows,function(row)row$padj,0)-p.adjust(vapply(rows,function(row)row$p,0),'BH')))<1e-12,'unambiguous posthoc BH family unchanged')
  }
}
cat('ALL COMPARISON LABEL REGRESSIONS PASSED\n')
