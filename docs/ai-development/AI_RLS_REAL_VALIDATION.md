# Agents SAI: real Supabase permission gate

Status at 2026-11-10: **STAGING API REACHABLE / identity and real JWT/RLS gate NOT_RUN**. The user identified a new project named `FlavorInsightAI-Staging` in `XQplayer's Org` and configured an ignored local file with its URL, ref and API keys. A read-only Auth settings call returned HTTP 200, but the scoped Management API token is absent, so project name, organization and empty-schema claims have not been independently verified. No remote SQL, Auth user, Storage object or service-role write request was sent. Private task retrieval remains **not production ready**. Earlier in-memory two-user tests remain unit evidence only.

## Audited boundary

- The working branch is `codex/ai-research-assistant` in its isolated worktree at starting commit `81f1630a79a79d2fc39d55f4a2fa43e7e0a09e`; the repository root has unrelated uncommitted work and was not edited. `supabase`, Docker and `psql` are unavailable here, so the staging setup uses the official Management API migration endpoint, with a project-scoped PAT and read-only identity checks before writes.
- `supabase/migrations/20260803070000_shimadzu_browser_analysis.sql` defines `profiles`, `shimadzu_jobs`, events, owner/admin SELECT, approved-owner INSERT, and a private `shimadzu-results` bucket. `is_shimadzu_admin()` reads the caller's profile through a security-definer function. The initial first-user admin bootstrap is removed by `20260803080000_shimadzu_admin_bootstrap.sql` before test identities are created.
- `supabase/migrations/20260807090000_shimadzu_partial_results_admin_retention.sql` replaces Storage SELECT with owner **or** admin and expands approved-owner/admin task updates. The deployed project must be checked for these exact migrations before the real test. Reviewing SQL files does not prove deployed policy state.
- The gateway verifies each bearer token through Supabase `/auth/v1/user`. `ResearchTools._task` scopes the first query to the authenticated user ID and consults the caller's profile for a verified admin fallback. Foreign and absent IDs use the same `TASK_NOT_FOUND`. Result ZIP reads use that caller's JWT and an exact `owner/task/result.zip` path; the model cannot supply an arbitrary storage path or user ID.
- Conversation ownership is checked in the Python gateway. Sessions and quotas are memory-only; a restart clears them, and this is not a distributed production session store or Supabase chat table.

## Prepared real probe

`scripts/e2e/verify_ai_supabase_rls.mjs` uses the installed `@supabase/supabase-js` and JSZip. It now requires a scoped Management API token and confirms the **exact Staging project name and organization before creating any user**. It rejects the project ref embedded in the production retention migration. It creates a synthetic admin, two ordinary approved users, signed-in JWTs, two completed synthetic tasks and two result ZIPs. The secret key is used for provisioning and cleanup only; owner, foreign, Storage and Agent checks use ordinary signed-in JWTs. It now checks both directions of task isolation, anonymous/invalid-JWT denial and direct real-JWT `ResearchTools` calls including forged tool arguments and a forged `Principal.admin` flag. It also checks gateway conversation isolation. With `FLAVOR_RLS_TEST_RUN_MODEL=true`, it makes at most three bounded paid model requests: foreign, absent and owner task. It then removes only generated test archives and users; deleting those users cascades their synthetic rows. The ignored evidence file is `_local/verification/ai-supabase-rls-real.json`. Failed cleanup fails the gate.

Local preflight executed: `node --check scripts/e2e/verify_ai_supabase_rls.mjs`, `node --check scripts/e2e/setup_ai_supabase_staging.mjs` and `python -m py_compile scripts/e2e/verify_ai_tool_rls.py` passed. Running either remote script without ignored local config must return `NOT_RUN`/`REFUSED`; this is a safe refusal, **not** a real RLS pass.

To run later, create the ignored private file `.env.rls-test.local` in this worktree with the variables below. Fill values only on the local machine; do not send keys, passwords or JWTs in chat or commit them. Get the URL/ref and API keys in the **FlavorInsightAI-Staging** project's Connect / Project Settings → API Keys view. Create a project-scoped Personal Access Token in account Access Tokens with Project Settings Read, Database Read, Database Migrations Write and organization list Read. The token is used to verify the target's exact name and organization. A publishable/legacy anon key is for ordinary JWT calls; a secret/legacy service-role key is only for provisioning and cleanup. Add the same Staging URL and low-privilege key as `FLAVOR_AI_SUPABASE_URL` and `FLAVOR_AI_SUPABASE_ANON_KEY` to this worktree's existing ignored `.env.local`, then restart the local AI Gateway. Do not set the service key or Management token in the Gateway.

```dotenv
FLAVOR_RLS_TEST_URL=https://<nonproduction-project-ref>.supabase.co
FLAVOR_RLS_TEST_ANON_KEY=<test-project-anon-key>
FLAVOR_RLS_TEST_SERVICE_ROLE_KEY=<test-project-server-only-admin-key>
FLAVOR_RLS_TEST_MANAGEMENT_TOKEN=<staging-project-scoped-personal-access-token>
FLAVOR_RLS_TEST_PROJECT_REF=<nonproduction-project-ref>
FLAVOR_RLS_TEST_ENVIRONMENT=nonproduction
FLAVOR_RLS_STAGING_APPLY=false
FLAVOR_RLS_TEST_GATEWAY_URL=http://127.0.0.1:18887
FLAVOR_RLS_TEST_GATEWAY_ORIGIN=http://127.0.0.1:5195
FLAVOR_RLS_TEST_RUN_MODEL=true
```

The user's current private file instead uses `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_ANON_KEY`, and `SUPABASE_STAGING_SERVICE_ROLE_KEY`. Both scripts now accept those aliases without copying or printing the key values. Add `SUPABASE_STAGING_MANAGEMENT_TOKEN` to that same ignored file; `SUPABASE_STAGING_ENVIRONMENT=nonproduction` and `FLAVOR_RLS_STAGING_APPLY=false` were added locally as nonsecret safety markers. The latter must remain `false` for the preview run.
The supplied URL initially ended in `/rest/v1/`; it was normalized **inside the ignored private file only** to the project's API origin, which is required by the Supabase client. The API key values were preserved. An alias-mapping preflight bug that converted an absent Management token into the literal string `undefined` was found and fixed before any remote write. A subsequent private-file invocation now safely reports the missing Management token with exit code 2.

```powershell
# Preview exact migrations and verify the target with read-only Management API calls.
node --env-file=.env.rls-test.local scripts/e2e/setup_ai_supabase_staging.mjs
# After reviewing the preview, set FLAVOR_RLS_STAGING_APPLY=true only in the ignored file and rerun the setup command.
# Start the Gateway after its private .env.local contains the same Staging URL and anon key.
& ./scripts/start_ai_local.ps1
# In another shell, from this worktree root (Node 20.6+):
node --env-file=.env.rls-test.local scripts/e2e/verify_ai_supabase_rls.mjs
```

The probe should not be pointed at production. If it fails after creating fixtures, inspect `_local/verification/ai-supabase-rls-real.json` for generated IDs and cleanup status; no secret is written there. A future passing artifact needs real project ref, timestamp, all check outcomes and successful cleanup. Only then may the real RLS gate be considered for approval. A local model demonstration using an in-memory fake store does **not** satisfy it.

Official API references used to design the harness: [Supabase server-side admin user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), and [private Storage download](https://supabase.com/docs/reference/javascript/file-buckets-download).

## Staging schema preview and risk

The staging setup script prints the exact source filenames and SHA-256 hashes before writing. It verifies that public business tables, Auth users, Shimadzu buckets, policies, functions and Auth triggers are absent. Only then, with `FLAVOR_RLS_STAGING_APPLY=true`, it applies five existing migrations in order through the [Management API migration endpoint](https://supabase.com/docs/reference/api/v1-apply-a-migration): `20260803070000`, `20260803080000`, `20260803083000`, `20260807090000`, and `20260921090000`. It does not edit the original SQL files. It verifies three RLS-enabled tables, two private buckets and cleanup-function privilege denial after application. A partial failure is **not** automatically rolled back or silently retried.

Local source SHA-256 preview (order above): `7cc7bef63308d0b41ce736c4681ac0c1769cb8368ce9e78dcf5ea7569e6ddc9f`, `70b4d77900c30371a83c5f722307167938a11646b7ea4c87209ed2dd1fa59e27`, `96be3f9745dac1cab4aa562247ec55ebbc4b9f88c71f834213682019c2d873ae`, `9dc3224e660c22cfe8c12c94adfd072ec24d55449e0a5bd6a5139ef611a44fcf`, `044746a5831b2f1582f1dd4278e399e0f266e4a65ba386e8cbf775fa8d991075`. These hash the original repository files; the staging execution copy has the privilege substitution described below.

Three migrations are deliberately excluded from the limited Agent permissions test:

| Migration | Reason |
| --- | --- |
| `20260730043000_search_analytics.sql`, `20260730050000_daily_analytics.sql` | Public analytics are outside private Agent task access. |
| `20260803073000_shimadzu_retention_schedule.sql` | Contains a cron HTTP target hard-coded to another Supabase project URL; deploying it to Staging would cross the environment boundary. |

The base migration grants `EXECUTE` on the `SECURITY DEFINER` cleanup function to `authenticated`; PostgreSQL may also expose function execution to `PUBLIC` by default. The retention migration only revokes from `authenticated`, so that source sequence cannot be presumed safe without inspecting deployed privileges. The staging execution copy replaces the base grant with `REVOKE ALL ... FROM public, anon, authenticated` **before its transaction commits**. The source migration remains unchanged. Actual production privileges are outside this task and are not asserted here. The later migration keeps `shimadzu-inputs` private and removes input upload/update policies, preserving browser-local raw workbook handling.

## Real permission matrix, pending execution

| Check | Required outcome | Staging evidence |
| --- | --- | --- |
| A/B own tasks; A→B and B→A by ID | Own visible, foreign invisible | NOT_RUN |
| Absent task, anonymous and invalid JWT | Generic denial, no private fields | NOT_RUN |
| A/B result ZIP and path traversal | Own readable, foreign/traversal denied | NOT_RUN |
| Gateway conversation and direct ResearchTools argument spoofing | Owner-scoped, fake user/admin flags ineffective | NOT_RUN |
| Administrator task and result reads | Match deployed `profiles.is_admin` and RLS | NOT_RUN |
| Real GPT tool requests | Own source only, foreign/absent denied | NOT_RUN |
| Cleanup of generated objects | No synthetic rows, Auth users or archives left | NOT_RUN |

No Supabase chat table exists: the probe creates two in-memory Gateway sessions and checks cross-user denial, rather than claiming persistent database session RLS. Current production readiness remains blocked until all real Staging checks, cleanup and the local engineering regressions pass. Staging success would not prove production RLS deployment. The [Supabase API-key guide](https://supabase.com/docs/guides/getting-started/api-keys) and [scoped PAT guide](https://supabase.com/docs/guides/platform/personal-access-tokens) support the separation of browser-safe and privileged credentials.

## Local checks during this Staging preparation

| Command | Actual result |
| --- | --- |
| `python -m unittest discover -s scripts/tests -p 'test_*.py'` | PASS, 175 tests. |
| `cd frontend; pnpm exec node --test` | PASS, 461 passed, 1 skipped, 0 failed. |
| `cd frontend; pnpm run test:shimadzu-browser` | PASS, 130 Worker/browser-contract tests. |
| `cd frontend; pnpm run lint`; `pnpm run build`; `pnpm audit --prod` | All exit 0. Build retains pre-existing browser-externalization/bundle warnings; audit reports no known vulnerabilities. |
| `node scripts/e2e/verify_ai_task_context.mjs` with isolated local Playwright and Chrome | PASS, desktop and mobile synthetic task context. |
| `cd frontend; pnpm run test:e2e` with local Playwright and Chrome | FAIL: the open-spectrum mirror plot did not become visible within 30 seconds; external-spectrum/proxy traffic showed aborted connections. This is not an RLS or Worker result. Full browser regression remains open. |
| `node scripts/e2e/setup_ai_supabase_staging.mjs` without private config | REFUSED, exit 2; no remote writes. A synthetic production-ref smoke test also refused with exit 2. |
| `node scripts/e2e/verify_ai_supabase_rls.mjs` without private config | NOT_RUN, exit 2; no remote writes. |
| `node --env-file=.env.rls-test.local` for both setup and RLS scripts | REFUSED/NOT_RUN, exit 2 because the scoped Management token is missing; no remote writes. |
| Read-only `GET /auth/v1/settings` with the Staging low-privilege key | HTTP 200. This confirms the configured URL/key endpoint is reachable, **not** the project name or organization. |
| `node --check` for both JS scripts; `python -m py_compile` for the direct tool probe; `git diff --check` | PASS. A scan of changed files found no key/JWT-shaped secret literals. |

R reference tests were not executed: `Rscript` was not found in PATH or the inspected local tool directories. The AI assistant browser Mock journey also timed out waiting for its Mock banner under the available local proxy/origin configuration, so that journey is **not** counted as passed. No change to Worker logic or raw research data was made.
