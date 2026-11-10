# Independent base-R reference. Run only to refresh the checked-in synthetic fixture.
# Browser PCA never invokes R or reads this script at runtime.
suppressPackageStartupMessages(library(jsonlite))
x <- matrix(c(
  2, 1, 8,
  4, 3, 5,
  5, 2, 9,
  7, 6, 3,
  8, 5, 7,
  10, 9, 4
), ncol=3, byrow=TRUE)
rows <- paste0('synthetic-s', seq_len(nrow(x)))
cols <- paste0('synthetic-f', seq_len(ncol(x)))
rownames(x) <- rows; colnames(x) <- cols
fit <- function(scale_method, center=TRUE) {
  means <- colMeans(x); sds <- apply(x, 2, sd)
  divisors <- switch(scale_method, none=rep(1, ncol(x)), uv=sds, pareto=sqrt(sds))
  z <- sweep(if(center) sweep(x, 2, means, '-') else x, 2, divisors, '/')
  p <- prcomp(z, center=FALSE, scale.=FALSE)
  ev <- unname(p$sdev^2)
  list(means=unname(means), sampleSd=unname(sds), divisors=unname(divisors),
       scores=unname(p$x), loadings=unname(p$rotation),
       eigenvalues=ev, explained=ev/sum(ev), cumulative=cumsum(ev/sum(ev)))
}
reference <- list(
  provenance=list(method='base::prcomp', rVersion=R.version.string,
                  fixture='synthetic 6 x 3, samples in rows', matrixOrientation='samples x features',
                  tolerance=1e-8, generatedBy='scripts/references/browser_pca_prcomp.R'),
  dataset=list(schemaVersion=1, id='synthetic-r-prcomp-6x3-v1', name='SYNTHETIC R prcomp reference',
    samples=lapply(seq_along(rows), function(i) list(id=rows[[i]], name=rows[[i]], group=if(i <= 3) 'A' else 'B')),
    features=lapply(cols, function(id) list(id=id, name=id, unit='a.u.')),
    matrix=unname(x), provenance=list(source='synthetic')),
  expected=list(none=fit('none'), uv=fit('uv'), pareto=fit('pareto'), none_uncentered=fit('none', FALSE)))
cat(toJSON(reference, auto_unbox=TRUE, digits=16, pretty=TRUE, matrix='rowmajor'))
