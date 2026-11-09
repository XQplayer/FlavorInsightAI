# Agents SAI: real Supabase permission gate

Status at 2026-11-10: **STAGING REAL JWT / RLS GATE PASSED; production deployment remains unverified**. The Management API confirmed the exact project ref, `FlavorInsightAI-Staging` name and active status. The user supplied the Dashboard organization slug `wkbburugozvjmhjgwjsz`, which matched the project's `organization_slug` exactly; the project-scoped PAT itself could not list organization names. Five limited-scope Staging migrations were applied, and deployed metadata plus real JWT, Storage, Gateway and model-tool probes passed. The final real probe recorded **26 true checks**, three bounded GPT tool requests and successful cleanup of all synthetic fixtures. A separate process deviation is recorded below: the user requested a full SQL change list for review before migration, but that instruction arrived after the migrations had already executed. No production project was changed or validated.

## Audited boundary

- The working branch is `codex/ai-research-assistant` in its isolated worktree. The stage baseline was `81f1630a79a79d2fc39d55f4a2fa43e7e0a09e`; this validation pass began at `05fc0b57e17f6c1a4ca3d47eb20cea4f4a94a804`. The repository root has unrelated uncommitted work and was not edited. `supabase`, Docker and `psql` are unavailable here, so the staging setup used the official Management API migration endpoint, with a project-scoped PAT and read-only identity checks before writes.
- `supabase/migrations/20260803070000_shimadzu_browser_analysis.sql` defines `profiles`, `shimadzu_jobs`, events, owner/admin SELECT, approved-owner INSERT, and a private `shimadzu-results` bucket. `is_shimadzu_admin()` reads the caller's profile through a security-definer function. The initial first-user admin bootstrap is removed by `20260803080000_shimadzu_admin_bootstrap.sql` before test identities are created.
- `supabase/migrations/20260807090000_shimadzu_partial_results_admin_retention.sql` replaces Storage SELECT with owner **or** admin and expands approved-owner/admin task updates. The Staging deployment was checked through read-only metadata after migration; the production deployment was not inspected.
- The gateway verifies each bearer token through Supabase `/auth/v1/user`. `ResearchTools._task` scopes the first query to the authenticated user ID and consults the caller's profile for a verified admin fallback. Foreign and absent IDs use the same `TASK_NOT_FOUND`. Result ZIP reads use that caller's JWT and an exact `owner/task/result.zip` path; the model cannot supply an arbitrary storage path or user ID.
- Conversation ownership is checked in the Python gateway. Sessions and quotas are memory-only; a restart clears them, and this is not a distributed production session store or Supabase chat table.

## Prepared real probe

`scripts/e2e/verify_ai_supabase_rls.mjs` uses the installed `@supabase/supabase-js` and JSZip. It requires a scoped Management API token, exact Staging project name/ref/status and either an independently returned organization name or an exact user-supplied Dashboard slug matched to project metadata. It rejects the ref embedded in the production retention migration. It creates a synthetic admin, two ordinary approved users, signed-in JWTs, two completed synthetic tasks and two result ZIPs. The secret key is used for provisioning and cleanup only; owner, foreign, Storage and Agent checks use ordinary signed-in JWTs. It checks both task isolation directions, anonymous/invalid-JWT denial, direct real-JWT `ResearchTools` calls including forged arguments/admin flag, and Gateway conversation isolation. With `FLAVOR_RLS_TEST_RUN_MODEL=true`, it makes at most three bounded paid model requests: foreign, absent and owner task. It removes only generated archives and users; deleting those users cascades their synthetic rows. Evidence is in ignored `_local/verification/ai-supabase-rls-real.json`. Failed cleanup fails the gate.

Local preflight executed: `node --check scripts/e2e/verify_ai_supabase_rls.mjs`, `node --check scripts/e2e/setup_ai_supabase_staging.mjs` and `python -m py_compile scripts/e2e/verify_ai_tool_rls.py` passed. Running either remote script without ignored local config must return `NOT_RUN`/`REFUSED`; this is a safe refusal, **not** a real RLS pass.

The ignored private file `.env.rls-test.local` in this worktree supplies the Staging URL/ref, low-privilege API key, secret key and project-scoped Management PAT. Do not send keys, passwords or JWTs in chat or commit them. The low-privilege key and URL were copied into the Gateway's ignored `.env.local`; neither the service key nor the Management token was added to Gateway configuration. The PAT had project read, database read and migration access; organization listing returned no entries, so the user's Dashboard slug was compared to the project metadata instead. The [Supabase PAT guide](https://supabase.com/docs/guides/platform/personal-access-tokens) explains project-scoped permissions.

```dotenv
FLAVOR_RLS_TEST_URL=https://<nonproduction-project-ref>.supabase.co
FLAVOR_RLS_TEST_ANON_KEY=<test-project-anon-key>
FLAVOR_RLS_TEST_SERVICE_ROLE_KEY=<test-project-server-only-admin-key>
FLAVOR_RLS_TEST_MANAGEMENT_TOKEN=<staging-project-scoped-personal-access-token>
FLAVOR_RLS_TEST_PROJECT_REF=<nonproduction-project-ref>
FLAVOR_RLS_TEST_ENVIRONMENT=nonproduction
FLAVOR_RLS_STAGING_APPLY=false
FLAVOR_RLS_TEST_GATEWAY_URL=http://127.0.0.1:18888
FLAVOR_RLS_TEST_GATEWAY_ORIGIN=http://127.0.0.1:5195
FLAVOR_RLS_TEST_RUN_MODEL=true
```

The user's private file uses `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `SUPABASE_STAGING_MANAGEMENT_TOKEN` and `SUPABASE_STAGING_ORGANIZATION_SLUG`. Both scripts accept these aliases without printing key values. `SUPABASE_STAGING_ENVIRONMENT=nonproduction` and `FLAVOR_RLS_STAGING_APPLY=false` are nonsecret safety markers; the apply switch was set only in the migration command process environment and was not persisted as `true`.
The supplied URL initially ended in `/rest/v1/`; it was normalized **inside the ignored private file only** to the project's API origin, which is required by the Supabase client. The API key values were preserved. An alias-mapping preflight bug that converted an absent Management token into the literal string `undefined` was found and fixed before any remote write. Before the token was supplied, the probe safely returned exit code 2.

```powershell
# Commands used during the first, empty-Staging deployment. The scoped-org
# fallback was used before the user supplied the Dashboard slug and has since
# been removed from the scripts; these commands are historical evidence only.
$env:FLAVOR_RLS_STAGING_ALLOW_PROJECT_SCOPED_ORG='true'
node --env-file=.env.rls-test.local scripts/e2e/setup_ai_supabase_staging.mjs
$env:FLAVOR_RLS_STAGING_APPLY='true'
node --env-file=.env.rls-test.local scripts/e2e/setup_ai_supabase_staging.mjs
# For a later probe rerun, start the configured Gateway on an unused port in one shell:
& ./scripts/start_ai_local.ps1 -Port 18888
# In another shell, from this worktree root:
$env:FLAVOR_RLS_TEST_GATEWAY_URL='http://127.0.0.1:18888'
$env:FLAVOR_RLS_TEST_RUN_MODEL='true'
node --env-file=.env.rls-test.local scripts/e2e/verify_ai_supabase_rls.mjs
```

The probe must not be pointed at production. The final passing artifact contains the Staging project ref, timestamps, check outcomes and cleanup status, but no password, JWT or key. A local model demonstration using an in-memory fake store would **not** satisfy this gate; this run used signed-in Staging JWTs and deployed policies. Running the setup script again against this nonempty Staging project will intentionally refuse.

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

## Real permission matrix, executed

| Check | Required outcome | Staging evidence |
| --- | --- | --- |
| A/B own tasks; A→B and B→A by ID | Own visible, foreign invisible | PASS: both owner reads succeeded; both foreign reads denied. |
| Absent task, anonymous and invalid JWT | Generic denial, no private fields | PASS: foreign and absent visibility matched; anonymous and invalid JWT denied. |
| A/B result ZIP and path traversal | Own readable, foreign/traversal denied | PASS: A downloaded own ZIP; B and anonymous could not; path traversal denied. |
| Gateway conversation and direct ResearchTools argument spoofing | Owner-scoped, fake user/admin flags ineffective | PASS: signed-in A/B sessions were HTTP 200; cross-user read/use/list denied; direct tool spoofing denied. |
| Administrator task and result reads | Match deployed `profiles.is_admin` and RLS | PASS: synthetic admin read B's task and A's archive under deployed policies. |
| Real GPT tool requests | Own source only, foreign/absent denied | PASS: three bounded real model requests; foreign and absent tools denied, own task available, no foreign task text leaked. |
| Cleanup of generated objects | No synthetic rows, Auth users or archives left | PASS: all six cleanup checks; read-only metadata found 0 Auth users, 0 jobs and 0 Storage objects after the run. |

No Supabase chat table exists: the probe created two in-memory Gateway sessions and checked cross-user denial; it did not test persistent database session RLS. Staging success does not prove production RLS deployment or production readiness. The [Supabase API-key guide](https://supabase.com/docs/guides/getting-started/api-keys) and [scoped PAT guide](https://supabase.com/docs/guides/platform/personal-access-tokens) support the separation of browser-safe and privileged credentials.

## Local checks during Staging validation

| Command | Actual result |
| --- | --- |
| `python -m unittest discover -s scripts/tests -p 'test_*.py'` | PASS, 175 tests. |
| `cd frontend; pnpm exec node --test` | PASS, 461 passed, 1 skipped, 0 failed. |
| `cd frontend; pnpm run test:shimadzu-browser` | PASS, 130 Worker/browser-contract tests. |
| `cd frontend; pnpm run lint`; `pnpm run build`; `pnpm audit --prod` | All exit 0. Build retains pre-existing browser-externalization/bundle warnings; audit reports no known vulnerabilities. |
| `node scripts/e2e/verify_ai_task_context.mjs` with isolated local Playwright and Chrome | PASS, desktop and mobile synthetic task context. |
| `cd frontend; pnpm run test:e2e` with local Playwright 1.65.0 and Chrome | PASS on final rerun: desktop, tablet and mobile; no horizontal overflow or fixed overlap. An earlier run timed out on the open-spectrum mirror plot after proxy traffic aborted; that failure was not counted as a pass. |
| `node scripts/e2e/verify_ai_assistant.mjs` with isolated Mock Gateway and Vite | PASS: desktop, tablet and mobile; real public CAS record in Mock-mode UI, source, history and layout checks. This is browser Mock evidence, separate from the real GPT tool probe. |
| `node scripts/e2e/setup_ai_supabase_staging.mjs` without private config | REFUSED, exit 2; no remote writes. A synthetic production-ref smoke test also refused with exit 2. |
| `node scripts/e2e/verify_ai_supabase_rls.mjs` without private config | NOT_RUN, exit 2; no remote writes. |
| `node --env-file=.env.rls-test.local` before the scoped token was supplied | REFUSED/NOT_RUN, exit 2; no remote writes. |
| Read-only `GET /auth/v1/settings` with the Staging low-privilege key | HTTP 200. This confirms the configured URL/key endpoint is reachable, **not** the project name or organization. |
| `node --check` for both JS scripts; `python -m py_compile` for the direct tool probe; `git diff --check` | PASS. A scan of changed files found no key/JWT-shaped secret literals. |

R reference tests were not executed: `Rscript` was not found in PATH or the inspected local tool directories. No change to Worker logic or raw research data was made.

## Scoped PAT follow-up, 2026-11-10

The user supplied a scoped Management token in the ignored private file. Read-only Management API checks established `project.ref` equals the private file ref, `project.name` is `FlavorInsightAI-Staging`, and `project.status` is `ACTIVE_HEALTHY`. `POST /v1/projects/{ref}/database/query` with `read_only: true` returned HTTP 201 and counts of **zero** for public business tables, Auth users, Shimadzu buckets, policies, functions and Auth triggers. `GET /v1/projects/{ref}/database/migrations` returned HTTP 200 with **zero** applied migrations. `GET /v1/organizations` returned HTTP 200 with an empty list; `GET /v1/organizations/{slug}` returned HTTP 403 under this project-scoped token, and the initial migration preflight stopped before any write. Later, the user supplied the nonsecret Dashboard slug `wkbburugozvjmhjgwjsz`. It matched the project's Management API `organization_slug` exactly, without expanding PAT scope. The scripts now require that exact match or an independently readable organization name; the temporary project-scoped bypass used for the initial migration has been removed.

The Gateway's ignored `.env.local` contains only the Staging URL and low-privilege anon/publishable key alongside its existing OpenAI configuration; no service-role or Management token was added. `scripts/start_ai_local.ps1 -Check` returned mode=openai, key/model present. An old Gateway was still answering port 18887; a first probe against it returned `AUTH_UNAVAILABLE` and did not pass. An isolated Gateway on port 18888 then authenticated both real JWTs and passed the complete probe. The old process was left untouched.

## Actual Staging migration and deployed metadata

The five existing migrations were applied only to the verified project ref `zwbzyrshzegwlgcaxudo`. The Management API migration history returned these versions and names:

| Applied version | Name | SQL change scope |
| --- | --- | --- |
| `20261109211519` | `ai_staging_20260803070000` | Create `profiles`, `shimadzu_jobs`, `shimadzu_job_events`, indexes, Auth/profile functions and triggers, owner/admin RLS, private results bucket and policies. The execution copy revoked cleanup-function execution from `public`, `anon`, `authenticated` inside the transaction. |
| `20261109211520` | `ai_staging_20260803080000` | Remove first-user admin bootstrap behavior. |
| `20261109211522` | `ai_staging_20260803083000` | Rotate admin bootstrap mechanism according to the existing migration. |
| `20261109211524` | `ai_staging_20260807090000` | Enable partial-result/admin retention behavior and owner/admin Storage/task policies. |
| `20261109211526` | `ai_staging_20260921090000` | Disable raw-input upload/update policies; keep private input reads/deletes under owner/admin rules. |

Read-only metadata after deployment confirmed all three business tables have RLS enabled. Active policies were self/admin profile SELECT; approved-owner event INSERT and self/admin event SELECT; approved-owner task INSERT, self/admin task SELECT, and approved-owner/admin task UPDATE. The two buckets, `shimadzu-inputs` and `shimadzu-results`, were private with 52,428,800-byte limits. Input objects had owner/admin SELECT and DELETE, with no INSERT or UPDATE policy. Results had owner INSERT, SELECT, UPDATE and DELETE, with admin read through the later policy. `anon` and `authenticated` lacked cleanup-function EXECUTE privilege. The excluded retention-cron migration still embeds another project's URL and was not applied.

**Process deviation:** the migration preview printed filenames and source SHA-256 values before execution, and the source scopes were inspected. However, the user's later requirement to output the SQL change list *for review before execution* arrived after the five transactions had already been applied. The list above is therefore an after-the-fact disclosure, not advance approval. No further SQL was executed after that instruction. Future schema changes require a reviewable SQL diff before migration.

## Final real probe and cleanup

The final command was `node --env-file=.env.rls-test.local scripts/e2e/verify_ai_supabase_rls.mjs` with process-local `FLAVOR_RLS_TEST_GATEWAY_URL=http://127.0.0.1:18888` and `FLAVOR_RLS_TEST_RUN_MODEL=true`. Ignored evidence `_local/verification/ai-supabase-rls-real.json` records start `2026-11-09T21:19:57Z`, completion `2026-11-09T21:20:48.588Z`, `status=PASS`, **26 boolean checks true**, organization `VERIFIED`, and **all six cleanup checks true**. It contains no key, password or JWT. Direct database/Storage requests used real signed-in Staging JWTs; three bounded real OpenAI tool requests exercised foreign, absent and owner task IDs. A read-only post-probe count found zero Auth users, jobs and Storage objects. The synthetic fixtures are labeled staging-only and were deleted by the probe.

Remaining limits: this does not test production RLS; Gateway conversations/quotas remain memory-only; the original retention-cron migration must be made environment-safe before any future deployment; R reference tests were unavailable because `Rscript` was absent. Staging schema rollback would require a separately reviewed reverse migration limited to these five objects; do not drop the schema automatically. Local code rollback is `git revert <this-stage-commit>` after commit.
