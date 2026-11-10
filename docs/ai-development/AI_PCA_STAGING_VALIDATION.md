# Hosted PCA Staging validation — 2026-11-10

**Scope:** approved Staging only. The user approved the exact 43-line SQL preview for `FlavorInsightAI-Staging` (`zwbzyrshzegwlgcaxudo`, organization slug `wkbburugozvjmhjgwjsz`). No production SQL or secret was changed.

## Applied change

- Source: `supabase/migrations/20261110090000_ai_pca_jobs.sql`, SHA-256 `36873E47D15FB0BB5179FFF22A9732AA9F1C19A91F8F34889269081004D22174`.
- Staging migration record: version `20261110014237`, name `ai_pca_jobs_20261110090000`.
- The Management migration endpoint owns the transaction; the apply script removed only the source file's `begin`/`commit` wrapper and leading comments. The DDL body was unchanged.
- Read-back: `public.ai_pca_jobs` exists, RLS enabled, one owner SELECT policy, authenticated SELECT granted, authenticated INSERT and anon SELECT denied, service_role INSERT granted. `public.profiles` existed before application. No Storage, existing table or production object was changed.
- Command: `node --env-file=<ignored Staging file> scripts/e2e/apply_ai_pca_staging.mjs`. The script rechecks project ref/name/organization/status and exact SQL hash before writing. It is idempotent after the migration record exists.

## Real JWT and R engine probe

Command: set local `ANALYSIS_RSCRIPT` and `R_LIBS_USER`, then run `node --env-file=<ignored Staging file> scripts/e2e/verify_ai_pca_staging.mjs`. Both runs used the actual Staging Auth and RLS policies. A first run exposed a **test expectation error**: anon SELECT is rejected with SQL `42501` due the explicit grant revoke, instead of returning an empty row set. The probe now accepts either safe denial and was rerun successfully.

Final run: exact project identity PASS; two approved non-admin synthetic users and real JWTs PASS; local hosted HTTP and actual R engine ready PASS; foreign/invalid/anonymous HTTP reads denied PASS; owner direct RLS read PASS; foreign/anonymous direct table read and ordinary-user write denied PASS; real R PCA completed with six synthetic scores and persisted result PASS; test user and cascaded job cleanup PASS. No tokens, passwords, keys or raw matrices were printed.

`python -m unittest services.analysis.tests.test_hosted -q` passed **8/8**, including restart interruption and persisted 20-job daily quota tests. With the local R environment, `python -m unittest services.analysis.tests.test_hosted_real_r -q` passed **1/1**. The full frontend analysis suite passed **110/110**; the selected Python Gateway/tools/analysis contracts passed **42/42**. The local R independent-reference script passed. Lint and build passed, with existing RDKit/externalization and bundle warnings. `pnpm audit --prod --json` reported zero advisories. Docker is not installed locally; remote [Actions Run 42739316283](https://github.com/XQplayer/FlavorInsightAI/actions/runs/42739316283) passed its R container job, Python job and frontend job at Head `313b1e01faa8f95765b48d3d69bf53891431e9ac`. A later head requires its own CI result.

## Boundaries

The probe used clearly labeled synthetic input; it did not test production users or production RLS. Staging's scoped PAT returned HTTP **403** for the production project metadata, so production schema/RLS comparison remains unverified. The hosted service is disabled by default, requires explicit single-instance mode, and has not been deployed. Dataset rows have a 30-day `expires_at` but no approved automatic purge; production retention and recovery operations require a separate reviewed plan. The browser path has not yet been tested against the hosted service with an approved Staging login.
