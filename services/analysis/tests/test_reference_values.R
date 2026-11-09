# Public synthetic reference values calculated by hand, not copied from engine output.
source('services/analysis/tests/test_engine.R')

# Centered vector -3,-1,1,3: sum of squares = 20, sample variance = 20/3.
# A one-variable PCA has explained variance 1; the score sign is arbitrary.
simple <- fixture(matrix(c(-3,-1,1,3), ncol=1))
pc <- analyze_dataset(simple, list(), list(method='pca', components=1))$data
check(abs(pc$eigenvalues[[1]] - 20/3) < 1e-12, 'independent PCA sample variance 20/3')
check(abs(pc$explained[[1]] - 1) < 1e-12, 'independent one-variable PCA explained fraction')
check(max(abs(abs(pc$scores[,1]) - c(3,1,1,3))) < 1e-12, 'PCA scores sign-invariant')

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
