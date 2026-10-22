# Supervised validation contract

Implementation decisions for the approved local workbench, 2026-10-23. Verified against installed R 4.6.0 and ropls 1.44.0. This is a wrapper contract, not a claim that a particular biological model is validated.

## Units and preprocessing

Require confirmed independent units and observed cell lineage. Aggregate technical repeats within biological unit and condition; preserve contributing sample IDs. Repeated-condition/paired supervised designs are unsupported in this first implementation and must be rejected, not shuffled as independent rows. Independent group labels and class order are frozen in each request.

Every inner and outer training partition independently fits feature filtering, imputation, PQN reference and scaling. Held-out values cannot alter learned preprocessing. Use stable sample/feature IDs throughout. Do not select features using full-data p values.

## Model selection and feasibility

Use explicit `predI`, `orthoI`, `permI=0`, `scaleC="none"`, `log10L=FALSE`, `fig.pdfC="none"`, `info.txtC="none"`. OPLS requires two classes, one predictive component and at least one orthogonal component. Never label `orthoI=0` as OPLS.

Before fitting require `predI + orthoI <= min(qr(processed_training_X)$rank, n_train - 1)` and every class represented. Candidate fits must produce finite held-out responses. Inner pooled out-of-fold balanced accuracy selects the candidate; deterministic ties prefer fewer components. Export selected components per outer fold separately from the final full-data fit.

Default requested outer folds: 5; do not silently lower them. Minimum two units per class is blocked. Three/four units per class require explicit exploratory acknowledgement and genuinely feasible splits. Three units/class with outer 3 and inner 2 leaves one unit/class in inner training: PLS 1 can be exploratory, but OPLS 1+1 fails centered-rank feasibility. Package success alone is insufficient.

## Continuous predictions and Q2

ropls `predict()` returns classes for factor Y, not continuous responses. Reconstruct response scores using the installed prediction method: remove `xZeroVarVi` exactly, apply model X center/scale, sequentially subtract each orthogonal score outer-product with its loading, multiply by `coefficientMN`, undo Y scale and mean. Verify class equivalence with `predict()` for binary and multiclass fixtures. Scores are not calibrated probabilities; do not clip them.

Binary coding: first fixed factor level 0, second 1; strictly greater than 0.5 selects second. Multiclass: fixed-order one-hot targets, first maximum tie rule.

`outerQ2_trainingPrevalence = 1 - PRESS / PRESS_null`, where PRESS sums squared held-out response errors and PRESS_null uses each fold's training response prevalence as predictor. Export both sums, response coding and per-observation scores/training prevalence. Zero null denominator yields null with reason; negative Q2 is retained. Never expose ropls row-round-robin internal Q2 as independent outer validation.

For repeated CV, pool held-out predictions within each repeat to compute balanced accuracy, then average repeats. Repeated predictions do not inflate independent n. Aggregate Q2 by summing both PRESS quantities over repeats.

## Permutation and reporting

Default 200 permutations, optional 1000, fixed seed. Permute independent units (or explicitly supported exchangeability blocks), rerun the entire nested selection/preprocessing procedure. Regenerate label-dependent stratified splits deterministically from each permuted label vector.

Empirical p is `(1 + exceedances)/(B + 1)`, including ties. If any required permutation fails, preserve the audit but return permutation p unavailable; do not silently resample failures or divide by completed-only counts. Export requested/completed/failed counts, seeds, distribution and failure reasons.

Full-fit scores/loadings/VIP/R2 and outer validation results must be visibly separated. VIP > 1 does not mean significance or causality. No automatic reliable-model badge based on separation or training fit.

## Regression evidence required

- Duplicating technical measurements does not change independent-unit inference or validation.
- Held-out sentinel changes do not alter corresponding training preprocessing or inner selection.
- Continuous response reconstruction agrees with ropls class prediction for binary PLS, multiclass PLS and binary OPLS, including one-row prediction.
- Tiny-sample PLS acknowledgement and OPLS rank gate work as specified.
- Exported predictions reconstruct PRESS/null PRESS/Q2 and confusion matrices.
- Candidate/permutation failures remain explicit; empirical p arithmetic is bounded and deterministic.
- Random-label data is never automatically labelled a reliable classifier; do not use a flaky assertion that every random dataset must have p > .05.

Reference: [ropls official package and source](https://bioconductor.org/packages/release/bioc/html/ropls.html).
