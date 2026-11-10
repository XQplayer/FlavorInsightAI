# Agents SAI: scientific interpretation and future read-only tools

Date: 2026-11-10. This is a local development result, not a production permission approval. No raw workbook, seven-stage Worker calculation, database migration or R statistical formula was changed.

## Delivered GC-MS interpretation

`get_analysis_summary` now reads the existing authenticated result ZIP after row ownership, Storage JWT, exact path, expiry, size and archive SHA-256 checks. It checks each projected Stage 4 and Stage 5 JSON against the corresponding manifest `outputHashes` before using a value. The response is bounded and source-tagged with both stage hashes.

| Evidence | Current output and boundary |
| --- | --- |
| Detected compounds and classes | Stage 4 screened CAS row count and at most 12 identified rows; class counts from those rows. The count can include configured internal standards and is not a claim about every analyte in a sample. |
| Semi-quantitative concentrations | At most 12 existing `Calculated` cells, with sample and `μg/mL` analysis-system unit. Other existing concentration status counts are shown separately. No conversion to solid-sample `μg/g`. |
| Parallel sample differences | At most 12 Stage 5 `groupStatistics` records, each with up to three existing parallel concentrations, Mean, sample SD, CV, CV threshold, screening state and sample group. `NA` remains null. These are descriptive technical-parallel results; no significance or biological independence is inferred. |
| QC and missing results | Stage 5 status comes from the stored stage summary or Stage 5 manifest, while `qc_summary` is treated as counts. Stage 4 missing concentration count, Stage 5 all-NA/incomplete/CV-filtered group counts are separate. A Stage 5 PASS does not mean no CV filtering or independent method validation. |
| Missing or altered evidence | Missing Stage 5 yields `unavailable`; mismatched archive/stage hash fails closed. Numbers are not recomputed to fill missing fields. |

The system prompt now tells the model to report only source-backed finite values and to distinguish actual platform records, descriptive statistics, QC warnings and inference. It prohibits invented p-values, OAV, statistical significance and extra compounds. The read-only `get_analysis_summary` schema is the only changed tool description; no new write or arbitrary-code tool was added.

The real-model demonstration used **synthetic** Stage 4/5 data: three parallels `2.0`, `2.5`, `3.0 μg/mL`; existing Stage 5 Mean `2.5 μg/mL`, SD `0.5 μg/mL`, CV `20%`, Stage 5 QC PASS and zero filtered groups. The final call after the QC wording review invoked `get_analysis_summary` and accurately identified the values as synthetic, semi-quantitative, descriptive, and not OAV or significance evidence. Final usage: 2,297 input and 883 output tokens. One earlier development call used 2,246 input and 752 output tokens. The direct script did not load model pricing rates, so its estimated cost is `null`, not zero. The final answer and tool evidence are in ignored `_local/verification/ai-synthetic-summary-live-result.json`.

## Audit of current statistical services

`services/analysis/server.py` exposes local `/session`, `/jobs`, `/jobs/<id>` and `/health`. It currently accepts bounded analysis requests for preprocess, PCA, heatmap, comparison, correlation, distribution and, when the startup probe finds ropls, supervised methods. `services/analysis/statistics.R` and related R files perform calculations. The broker keeps jobs and tokens **only in memory** and uses an origin-bound local token; it is not bound to a Supabase user, project authorization record or persistent immutable result. The AI Gateway therefore does not call it. The browser analysis workbench retains local snapshots; no current authenticated server-side result query contract exists for the Agent.

Proposed future tools must first query an immutable, user-authorized saved analysis run, not submit a new analysis request:

| Proposed read-only tool | Required input | Bounded output | Required checks |
| --- | --- | --- | --- |
| `get_pca_result` | saved `project_id`, `run_id`, optional component IDs | method/recipe, centering/scaling, sample/feature direction, explained variance, bounded scores/loadings, warnings and result hash | owner/admin access, immutable run version, model version, missing-data handling, no invented rotation/sign equivalence |
| `get_statistical_result` | saved run and comparison/feature IDs | existing test name, independent-unit basis, `n`, effect, p and adjusted p, NA reason, transformation and source | query only computed rows; preserve multiplicity family, assumptions and small-sample limitations |
| `get_correlation_result` | saved run and feature-pair IDs | existing coefficient, method, valid pair count, adjusted p where produced and warnings | source matrix/snapshot, exclusions, no causal inference |
| `get_differential_result` | saved run and contrast ID | existing fold change, means, p/padj, NA reason and units | compare method, group labels, independent samples, adjustment scope and source hash |
| `get_model_evaluation` | saved model/run ID and evaluation set ID | existing external/holdout or nested/group CV metrics, sample counts, seed, warnings | prevent leakage; never substitute training fit or a full-data score for predictive performance |

Every response needs `status` (`available`, `unavailable`, `incomplete`), source run/snapshot ID, schema/engine versions, input and result hashes, units, exclusions, warnings, query timestamp and a per-field missing state. Tools must verify JWT, project ownership and field-level projection server-side, cap rows/bytes, and return a generic absent/unauthorized error. The model must not receive raw matrices by default. A tool that starts PCA, correlation, model fitting or any other new computation needs a **separate** endpoint, scoped permission, resource budget, explicit user confirmation, audit event and cancellation contract; it is not part of this read-only phase.

## Knowledge extension

No deployed SAG service or authenticated research-knowledge API was found in this worktree or available tool inventory. A local book OCR/index pipeline exists, but its files are not an Agent-accessible, licensed, user-authorized citation service. `search_research_knowledge` remains deliberately absent from model `TOOL_SCHEMAS`; a direct call returns `KNOWLEDGE_UNAVAILABLE`. A future replaceable adapter may accept `{query, scope, max_results}`, and return bounded passages with document ID, title, version, page/section, DOI or URL only when present, rights/access status, and exact retrieval timestamp. It must reject unavailable backends and strip instructions embedded in retrieved text. No citation is generated from the model's memory or an unconnected index.

## Verification status and risks

The focused Python tests cover valid Stage 5 projection, incomplete triplicates, unit preservation, redaction, archive/path/hash rejection and QC WARN/PASS provenance. Tests were written and first run red (`qc_status` absent; altered Stage 5 hash accepted), then the read-only projection made them green. The actual Worker Stage 5 archive directory was checked in `shimadzuPipeline.js` before implementation.

| Command | Actual result |
| --- | --- |
| `python -m unittest discover -s scripts/tests -p 'test_*.py' -q` | 175 tests, all passed. |
| `cd frontend; pnpm exec node --test` | 462 total: 461 passed, 1 skipped, 0 failed. |
| `cd frontend; pnpm run test:shimadzu-browser` | 130 tests passed, including the unchanged seven-stage Worker and Stage 5 regression tests. |
| `R_LIBS_USER=<existing project-local R library> D:/R-4.6.0/bin/Rscript.exe --vanilla services/analysis/tests/test_reference_values.R` | Independent PCA/BH references and existing engine review regressions passed; R printed locale startup warnings. |
| `node scripts/e2e/verify_ai_task_context.mjs` with existing local Playwright/Chrome paths | Desktop 1440 and mobile 390 passed; no auto model call or horizontal overflow. |
| `node scripts/e2e/verify_processing_feedback.mjs` with local Playwright | Browser Worker desktop completion and mobile failure passed. |
| `cd frontend; pnpm run lint`; `pnpm run build`; `pnpm audit --prod` | All exited 0; audit reported `No known vulnerabilities found`. Build retained existing RDKit/3Dmol and chunk-size warnings. |
| `node --check scripts/e2e/verify_ai_supabase_rls.mjs`; `node scripts/e2e/verify_ai_supabase_rls.mjs` | Syntax passed; actual real-RLS run exited 2 with `NOT_RUN` because nonproduction credentials are absent. |

The real Supabase permission gate remains **NOT_RUN**; see `AI_RLS_REAL_VALIDATION.md`. Archive integrity and the synthetic model demonstration do not establish independent analytical reference values or production authorization. Review was serial in this turn; no independent subagent or external security review is claimed.
