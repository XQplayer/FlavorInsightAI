# Public synthetic reference values calculated by hand, not copied from engine output.
source('services/analysis/tests/test_engine.R')

# Centered vector -3,-1,1,3: sum of squares = 20, sample variance = 20/3.
# A one-variable PCA has explained variance 1; the score sign is arbitrary.
simple <- fixture(matrix(c(-3,-1,1,3), ncol=1))
pc <- analyze_dataset(simple, list(), list(method='pca', components=1))$data
check(abs(pc$eigenvalues[[1]] - 20/3) < 1e-12, 'independent PCA sample variance 20/3')
check(abs(pc$explained[[1]] - 1) < 1e-12, 'independent one-variable PCA explained fraction')
check(max(abs(abs(pc$scores[,1]) - c(3,1,1,3))) < 1e-12, 'PCA scores sign-invariant')

# Independent 2-variable diagonal example: centered cross-product is diag(8,2).
# With n=4, sample-covariance eigenvalues are 8/3 and 2/3, hence 80%/20%.
diagonal <- fixture(matrix(c(-2,0, 2,0, 0,-1, 0,1), nrow=4, byrow=TRUE))
two <- analyze_dataset(diagonal, list(), list(method='pca', components=2))$data
check(max(abs(two$eigenvalues[1:2] - c(8/3,2/3))) < 1e-12, 'independent two-axis PCA eigenvalues')
check(max(abs(two$explained[1:2] - c(.8,.2))) < 1e-12, 'independent PC1/PC2 explained fractions')
check(max(abs(abs(two$scores) - matrix(c(2,0,2,0,0,1,0,1),nrow=4,byrow=TRUE))) < 1e-12, 'independent two-axis PCA scores up to sign')
check(max(abs(abs(two$loadings) - diag(2))) < 1e-12, 'independent two-axis PCA loadings up to sign')

# Adding a constant offset must not change centered PCA scores/explained variance.
shifted <- fixture(matrix(c(8,5, 12,5, 10,4, 10,6), nrow=4, byrow=TRUE))
shift <- analyze_dataset(shifted, list(), list(method='pca', components=2))$data
check(max(abs(abs(shift$scores) - abs(two$scores))) < 1e-12, 'centering removes a feature offset')
check(max(abs(shift$explained[1:2] - c(.8,.2))) < 1e-12, 'centering preserves explained fractions')

# BH for sorted p=(.01,.03,.04): min(3p1, 3p2/2, p3)=.03;
# adjusted sorted values are (.03,.04,.04), then restored to input order.
rows <- lapply(c(.01,.04,.03), function(p) list(p=p, comparison='B vs A'))
adjusted <- adjust_rows(rows, 'BH')
check(max(abs(vapply(adjusted, function(row) row$padj, 0.0) - c(.03,.04,.04))) < 1e-12,
      'independent BH three-test reference')

# Duplicate subject IDs in unpaired comparison must not inflate independent n.
repeated <- fixture(matrix(c(1,2,3,4), ncol=1))
repeated$samples[[3]]$subjectId <- 'subject-1'
repeated$samples[[1]]$subjectId <- 'subject-1'
err(analyze_dataset(repeated, list(), list(method='compare', control='C', treatment='T')),
    'REPEATED_CONDITION_REQUIRES_PAIRED_METHOD')
cat('INDEPENDENT REFERENCE TESTS PASSED\n')
