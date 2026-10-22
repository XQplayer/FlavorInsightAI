# Local analysis workbench (unreleased)

This worktree implements local analysis at `http://127.0.0.1:5180/FlavorInsightAI/data-analysis/`. It is not a public-deployment, security-certification, or AI-model claim. The original 5174 frontend remains unchanged. The original handoff task is `019fb7d8-f158-7ec3-9e28-82571a114705`.

## Start and runtime

Reuse existing services when they are already healthy; do not start a duplicate instance. From this worktree root, start the analysis service using Python (no PowerShell startup script is required):

```text
python services/analysis/server.py --port 8890 --rscript D:/R-4.6.0/bin/Rscript.exe --rlibs E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library --timeout 1200
```

From `frontend`, the isolated development preview is:

```text
pnpm run dev --host 127.0.0.1 --port 5180
```

If the local Codex shell's package-manager fallback cannot resolve Vite on PATH, use the direct Node entry point from `frontend` instead (with dependencies already installed):

```text
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180
```

This is an alternative launch command, not an additional service; reuse the healthy 5180 instance rather than running both commands.

The frontend compute endpoint is deliberately fixed to `http://127.0.0.1:8890`. The local service uses its normal session-token and origin checks; do not bypass them. R/package availability is reported by `/health`; the request/recipe schema is version 1 and current engine provenance reports engine 1.0.0. Actual R and package versions are recorded per result, not inferred from this document. A missing R package makes its capability unavailable. There are no model credentials, model calls, automatic database lookups, or data uploads from the local evidence/report features.

## Workflow

1. Import XLSX, CSV/TSV/delimited text, a portable project JSON, or a verified-format Shimadzu archive. Choose `before-cv` or `after-cv` explicitly for ZIP. Preview mapping, orientation, measurement columns and units, then confirm replacement. Each archive import creates a new snapshot. Generic finite values start with unknown lineage; explicitly confirm eligible measured values only if they really are measured. QC-filtered and original-imputed values remain protected.
2. Set groups, biological-unit IDs, subjects and inclusion metadata. Bulk metadata accepts exact unique sample ID or name. Preview it, use it as a draft, then apply. Technical replicates share a biological-unit ID. Independence must be scientifically justified, explicitly confirmed and applied; loading the SYNTHETIC fixture deliberately resets confirmation to false. Draft metadata blocks runs until applied/discarded.
3. Choose an exploratory recipe: filter → fill → sample normalization → transform → scale. Defaults perform no fill, normalization, transform or scaling; internal standards are excluded by default (`includeInternalStandards=false`). All-missing features default to an error, and zero-variance features default to keep. The source matrix is immutable. All-missing/zero-variance behavior, internal-standard inclusion, mixed units/matrix types and repeat normalization require explicit settings. Run the real preprocessing preview before relying on the recipe.
4. Run PCA, heatmap, two-group or multigroup comparisons, correlation, distributions, PLS-DA or OPLS-DA. Choose explicit groups/comparisons, test, multiplicity correction and scope. Observed-only comparisons/correlations/distributions do not use exploratory fills or scales: inspect actual `recipeApplied=false`. Their reported biological-unit N is not the number of technical measurements.
5. Review actual service status, selected run, bound dataset ID and request hash. Editing the dataset/settings marks old runs STALE; results and local evidence remain bound to that run's request, never the newer dataset. Retry creates a new run. Cancel acts on the actual active job, not a simulated progress bar.
6. Use Local evidence query — not AI-generated / 本地证据查询（非AI生成）. Quick commands are `summary`, `quality`, `methods`, `comparisons`; Chinese equivalents work. Exact feature ID/CAS/name queries return separate matches with stable IDs. Prefix `feature:` if an identity equals a command. Comparison rows, feature-indexed loadings/matrices and their real JSON pointers are read from the bound results without recomputation. Click a citation to inspect the actual local JSON excerpt. General/causal questions return no local evidence. Dataset-only queries explicitly have no run results. Clearing/switching a project resets query context.

## Scientific boundaries

- SYNTHETIC examples are software demonstrations, not experimental evidence. The 24 × 8 fixture has three groups. Real HD source archives are read-only inputs, not evidence of independent samples by themselves.
- Missing, unknown, original-imputed and QC-filtered cells are not interchangeable; NA is not zero. Do not rename technical repeats as independent biological units.
- PCA and heatmaps are exploratory. Supervised full-fit plots/loadings/VIP are descriptive, not held-out validation. VIP is not a p value or causal evidence. Inspect nested validation, folds, confusion matrices, out-of-fold predictions, preprocessing scope, permutation failures and reasons separately.
- OPLS-DA requires exactly two selected classes; PLS-DA supports explicit multiclass scope. Training-only preprocessing and component selection are repeated inside validation. Infeasible folds/rank/budgets fail instead of silently reducing settings. Small-N warnings are not waived by a good-looking plot.
- No result establishes causal mechanism, sensory importance, odor activity or authoritative “key aroma” compounds. Existing annotations are source data only; CAS database navigation and seven curated public-reference links are user-activated, separate evidence. No search API, embedded remote iframe or automatic upload is added.
- A request hash is service-reported/imported metadata. Portable projects are schema-checked but are not independently cryptographically verified. Do not present them as authenticated experimental records.

## Persistence, export and limits

The Python service has in-memory job history; restarting it loses that service history. The browser saves dataset snapshots, settings and runs to IndexedDB for this origin/profile. Reload the page and explicitly restore a saved snapshot. A different port, browser or profile has a different store. Export portable project JSON for a backup; it includes actual run requests/results and is limited to 32 MiB. Large runs must be exported separately, not silently removed. Replacing/clearing active context does not delete saved snapshots.

Result tables are paged (20 rows / up to eight displayed columns, long text in 500-character pages). Graph subsets/labels have explicit limits; complete tables remain accessible. Exports include CSV ZIP, XLSX, raw request/result JSON, SVG/PNG and reproduction bundles. XLSX cell/sheet limits cause a clear error; use complete CSV/JSON instead. Formula-like spreadsheet text is escaped. Reproduction uses the matching trusted local engine and recorded versions, never executes source strings as code, and does not bundle R/dependencies.

The report ZIP contains safe `report.html`, `report.md`, exact `request.json`, full `result.json`, complete CSV tables and `table-manifest.json`. Links are relative and must stay together after extraction. Report preview is limited to 20 rows per table, 30 sections, and 12,000 text characters per entire section, including the factual overview, headings, labels and clipping notices (headings are capped at 512 characters); complete attachments are not truncated. The UI uses bounded paged text. Invalid context or unsupported table shapes retain raw JSON and explain unavailable tables. No PDF or guaranteed publication-resolution claim is made. All user text is escaped, not executable HTML or model instructions.

## Repeatable acceptance

Run from the worktree root while the existing 5180/8890 services are healthy:

```text
node scripts/e2e/verify_analysis_workbench.mjs
```

The script launches a fresh headless Chrome context, never the user's profile, and closes only its own browser. `ANALYSIS_BASE_URL`, `ANALYSIS_CHROME_PATH`, `ANALYSIS_PLAYWRIGHT_PACKAGE`, `ANALYSIS_QA_OUTPUT` and optional `ANALYSIS_HD_ARCHIVE` configure the runner; they do not change the frontend's fixed compute endpoint. No authentication bypass or service restart is performed. Without `ANALYSIS_HD_ARCHIVE`, the real-HD scenario is explicitly skipped. PLS/OPLS with zero permutations are smoke tests only, not permutation validation; the separate 200-permutation job tests real cancellation. Final acceptance requires the script's actual pass record, frontend tests/lint/build and the separately maintained Python/R engine tests. Model configuration remains deferred.
