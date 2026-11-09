---
name: flavor-statistical-analysis
description: Use for FlavorInsight group comparisons, PCA, OPLS-DA, differential analysis, p-value correction, and scientific statistical interpretation.
---

# Statistical analysis contract

Trigger for `services/analysis/`, `frontend/src/analysis/`, or reports that compute or interpret statistics. Read `services/analysis/requirements.md`, current Python/R functions and tests. The generic `statistical-analysis` skill can help select a method; this skill supplies project-specific sample and lineage checks.

**Inputs:** data matrix, sample metadata, biological versus technical replicate mapping, units, missingness, grouping, preprocessing and predeclared comparison/hypothesis. **Outputs:** model/test settings, retained/excluded samples and features, diagnostics, estimates/effect sizes, corrected p-values where applicable, figures and provenance.

Check sample independence, scaling/normalization, missing-value handling and method assumptions before fitting. For PCA, report explained variance and preprocessing. For supervised OPLS-DA, check class balance, group-aware validation, permutation and overfit diagnostics; exploratory separation alone is not confirmation. Define the tested family before multiple correction. Never promote technical repeats to independent biological samples or infer causality from association.

On undersized groups, failed assumptions, singular matrices or undefined corrections, return an explicit warning or stop with a reason. Preserve raw input and the chosen preprocessing record. Do not relax thresholds solely to obtain significance.

**Minimum test case:** a clearly synthetic 3-group matrix with biological sample IDs and two technical injections for one sample. Assert technical injections do not increase biological `n`, a prespecified missing value is handled as declared, corrected p-values map to the stated family, and reordering rows does not change the numerical result beyond documented tolerance.
