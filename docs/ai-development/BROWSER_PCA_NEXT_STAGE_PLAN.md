# Browser PCA next-stage implementation plan

**Current boundary:** `codex/browser-pca` has a local Browser PCA implementation, a v1 result protocol, a source-only browser Agent adapter and persistence design. This plan authorizes no push, merge, deployment or production database change.

## 1. Release candidate and actual Pages acceptance

1. Refresh read-only remote branch/PR status when authorized to prepare release. Inspect `main...codex/browser-pca` commit and file diff: the local branch currently has an AI assistant release-candidate dependency chain before the PCA commits. Keep PR #24/#25 untouched and choose a reviewable release sequence so Browser PCA does not carry unreviewed changes into `main`.
2. Freeze the exact commit and lockfile. Run frozen install, full frontend suite, R `prcomp` reference comparison, security audit, lint/build, static route test and production-build Chrome/Edge E2E using only synthetic data.
3. After separate authorization for remote operations, push the reviewed branch and use a Draft PR for CI. Record head SHA, required job results and any failed logs. A local production-build pass is not a Pages pass.
4. After separate release approval, let the existing `main` Pages workflow deploy. Record deployment run ID and SHA; from the real `https://xqplayer.github.io/FlavorInsightAI/data-analysis/` URL, verify the Worker URL/status, dynamic chunk, CSV/XLSX import, four figures and SVG/PNG/CSV/JSON exports. Never upload a real research workbook for this smoke test. Roll back via the approved previous Pages commit if a gate fails.

## 2. Agents SAI end-to-end orchestration

1. Add an authenticated Gateway **plan-generation** endpoint that accepts only a user-approved bounded `inspect_dataset` summary, validates the exact `flavor-pca-plan/1` schema, limits model output/cost and logs the plan ID without raw matrix content. The Gateway cannot call a browser Worker.
2. Add frontend plan UI and a visible confirmation step. Only a user click invokes the adapter's `confirm_pca`; `run_browser_pca` then runs the Worker. Show original options, warnings, units and source identity before execution.
3. Add a separate explanation-sharing UI showing the exact bounded facts; only another user click invokes `confirm_explanation`. The Gateway receives the checked v1 result excerpt and returns interpretation with source/version and uncertainty boundaries. Test prompt injection in spreadsheet cells and model-supplied `approved`/`share_with_gateway` fields.
4. Test with synthetic data: unconfirmed plan denial, invalid schema/foreign dataset denial, cancel/timeout, repeated runs, model text that tries to invent scores, and a real Gateway round trip once the deployment/auth environment is available. Do not claim Agent integration from adapter unit tests alone.

## 3. Save, restore and recompute

1. Implement opt-in IndexedDB storage from `BROWSER_PCA_PERSISTENCE_DESIGN.md`. Version stores separately for dataset snapshots and result envelopes, with owner namespace, expiration and quota/error handling. Keep memory-only as default.
2. Add restore UI and portable archive export/import. Validate schema version, bound IDs, source hash and finite numbers before displaying. Require an included numeric dataset snapshot or a matching re-import to recompute; result-only JSON is insufficient.
3. Recompute creates a new run ID and preserves the prior result. Compare scores/loadings with sign alignment, retain both engine versions and flag changed numerical results.
4. Treat Supabase as a separate optional project: write a staging schema/RLS/Storage preview, test real JWT cross-user denial, obtain migration authorization, then add an explicit cloud-save action. No automatic upload of raw or derived research data.

## Gates before claiming completion

- Actual Pages Worker execution on the deployed commit; at least Chrome plus a non-Chromium engine when available, with mobile viewport and download checks.
- End-to-end Gateway plan → UI confirmation → browser Worker → checked result → separate sharing confirmation → explanation, with no model-generated PCA numbers.
- Refresh restore, corruption rejection, archive round trip and recomputation from the same parameters and source snapshot.
- Independent R reference comparison, version/provenance audit, no GC-MS/R-workbench regression, clean CI and reviewed rollback.
