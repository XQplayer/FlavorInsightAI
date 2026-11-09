---
name: flavor-ml-validation
description: Use for FlavorInsight predictive-model training, cross-validation, leakage checks, held-out metrics, and explanation of model outputs.
---

# ML validation contract

Trigger for predictive training/evaluation code, model selection or claims in the AI Models area. A placeholder UI does not imply a trained or validated model. Read data provenance, subject/batch/group IDs, preprocessing and existing tests before model work.

**Inputs:** labeled dataset with sample identity, target definition, groups/batches/time, feature origin, preprocessing plan, split policy and metric. **Outputs:** versioned split IDs, training-only fit parameters, model/dependency versions, seed, held-out predictions and metrics with uncertainty, leakage audit and limits of interpretation.

Split by the real unit of independence before imputation, scaling, feature selection or tuning. Keep all technical replicates, derivative features and linked samples in one fold. Fit every learned transform inside training folds. Use nested or separate validation for model choice and a genuinely untouched test set for final claims. Report class imbalance and per-group performance where relevant; explanation weights are model behavior, not biochemical causation.

If independent grouping cannot be established, do not claim generalization. If leakage or duplicate samples are detected, stop evaluation and preserve a diagnostic report. Synthetic examples must be labeled and never mixed with real training results.

**Minimum test case:** synthetic rows with duplicate injections of each biological sample and a feature deliberately encoding the label. Assert group-disjoint folds, that the suspicious feature is flagged or excluded by the declared policy, and that preprocessing fit sees training rows only. Re-run with a fixed seed and verify identical split IDs and predictions.
