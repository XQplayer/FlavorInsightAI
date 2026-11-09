# Public external reference: Bioconductor ropls 1.44.0 vignette, sections 4.2-4.4.
# https://bioconductor.org/packages/release/bioc/vignettes/ropls/inst/doc/ropls-vignette.html
# The published table reports three decimal places (R2Y to two); tolerate
# rounding, not a change in the modeled dataset or component selection.
if (!requireNamespace('ropls', quietly=TRUE)) stop('ropls is required for the published reference')
if (as.character(packageVersion('ropls')) != '1.44.0') stop('review published reference for this ropls version')
suppressPackageStartupMessages(library(ropls))
data(sacurine, package='ropls')
x <- sacurine[['dataMatrix']]
y <- sacurine[['sampleMetadata']][['gender']]
stopifnot(identical(dim(x), c(183L,109L)), length(y)==183L)
near <- function(actual, expected, tol, label) {
  if (!is.finite(actual) || abs(actual-expected)>tol) stop(paste('published reference mismatch:',label,actual,expected))
  cat('PASS:',label,'\n')
}
component <- function(model, predictive, orthogonal, label) {
  stopifnot(model@summaryDF[1,'pre']==predictive, model@summaryDF[1,'ort']==orthogonal)
  cat('PASS:',label,'components\n')
}

pca <- opls(x, fig.pdfC='none', info.txtC='none')
component(pca, 8, 0, 'PCA')
near(pca@summaryDF[1,'R2X(cum)'], .501, .0005, 'PCA published R2X')

set.seed(1)
plsda <- opls(x,y,permI=0,fig.pdfC='none',info.txtC='none')
component(plsda, 3, 0, 'PLS-DA')
near(plsda@summaryDF[1,'R2X(cum)'], .275, .0005, 'PLS-DA published R2X')
near(plsda@summaryDF[1,'R2Y(cum)'], .73, .005, 'PLS-DA published R2Y')
near(plsda@summaryDF[1,'Q2(cum)'], .584, .0005, 'PLS-DA published Q2')

set.seed(1)
oplsda <- opls(x,y,predI=1,orthoI=NA,permI=0,fig.pdfC='none',info.txtC='none')
component(oplsda, 1, 2, 'OPLS-DA')
near(oplsda@summaryDF[1,'R2X(cum)'], .275, .0005, 'OPLS-DA published R2X')
near(oplsda@summaryDF[1,'R2Y(cum)'], .73, .005, 'OPLS-DA published R2Y')
near(oplsda@summaryDF[1,'Q2(cum)'], .602, .0005, 'OPLS-DA published Q2')
cat('ROPLS PUBLISHED REFERENCES PASSED\n')
