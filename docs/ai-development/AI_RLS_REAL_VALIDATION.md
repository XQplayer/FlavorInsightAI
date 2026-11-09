# Agents SAI: real Supabase permission gate

Status at 2026-11-10: **NOT_RUN / private task production readiness blocked**. The current worktree has a private OpenAI `.env.local`, but no `FLAVOR_AI_SUPABASE_URL` or `FLAVOR_AI_SUPABASE_ANON_KEY`; no nonproduction Supabase URL, anon key or provisioning key was found in the process environment. `supabase` and `docker` CLI were not available. The user confirmed the nonproduction project is probably not configured. No real JWT, deployed RLS policy, user account, task row or Storage object was created or tested in this turn. The prior in-memory two-user tests remain unit evidence only.

## Audited boundary

- `supabase/migrations/20260803070000_shimadzu_browser_analysis.sql` defines `profiles`, `shimadzu_jobs`, events, owner/admin SELECT, approved-owner INSERT, and a private `shimadzu-results` bucket. `is_shimadzu_admin()` reads the caller's profile through a security-definer function. The first created user is bootstrapped as admin.
- `supabase/migrations/20260807090000_shimadzu_partial_results_admin_retention.sql` replaces Storage SELECT with owner **or** admin and expands approved-owner/admin task updates. The deployed project must be checked for these exact migrations before the real test. Reviewing SQL files does not prove deployed policy state.
- The gateway verifies each bearer token through Supabase `/auth/v1/user`. `ResearchTools._task` scopes the first query to the authenticated user ID and consults the caller's profile for a verified admin fallback. Foreign and absent IDs use the same `TASK_NOT_FOUND`. Result ZIP reads use that caller's JWT and an exact `owner/task/result.zip` path; the model cannot supply an arbitrary storage path or user ID.
- Conversation ownership is checked in the Python gateway. Sessions and quotas are memory-only; a restart clears them, and this is not a distributed production session store.

## Prepared real probe

`scripts/e2e/verify_ai_supabase_rls.mjs` uses the existing installed `@supabase/supabase-js` and JSZip dependencies. It refuses to run unless an HTTPS `https://<exact-ref>.supabase.co` URL, matching project ref, distinct anon/service keys and explicit `nonproduction` marker are present. It creates a dedicated synthetic admin first, then two ordinary approved users, their JWTs, two completed synthetic task rows and two small synthetic result ZIPs. The service key is used for provisioning and cleanup only; all owner, foreign, Storage and Agent tests use ordinary signed-in JWTs. It checks real PostgREST RLS, private Storage, admin RLS, absent-versus-foreign visibility, gateway-authenticated conversations and cross-user denial. With `FLAVOR_RLS_TEST_RUN_MODEL=true` it makes at most three bounded paid model requests: foreign, absent and owner task, and checks actual tool events and source isolation. It then removes only the generated test archives and users; deletion of those users cascades their synthetic rows. The ignored local evidence artifact is `_local/verification/ai-supabase-rls-real.json`. A failed cleanup causes a failed result.

Preflight executed: `node --check scripts/e2e/verify_ai_supabase_rls.mjs` passed; `node scripts/e2e/verify_ai_supabase_rls.mjs` exited **2**, printing `NOT_RUN: configure FLAVOR_RLS_TEST_URL, FLAVOR_RLS_TEST_ANON_KEY, FLAVOR_RLS_TEST_SERVICE_ROLE_KEY, FLAVOR_RLS_TEST_PROJECT_REF ...; no remote changes were made`. This is a safe refusal, **not** a real RLS pass.

To run later, create the ignored private file `.env.rls-test.local` in this worktree with the variables below. Fill values only on the local machine; do not send keys, passwords or JWTs in chat or commit them. Confirm the project is separate from production and has the two migrations above. Add the same test-project URL and anon key as `FLAVOR_AI_SUPABASE_URL` and `FLAVOR_AI_SUPABASE_ANON_KEY` to this worktree's existing private `.env.local`, then restart the local AI Gateway. Do not set the service key in Gateway configuration.

```dotenv
FLAVOR_RLS_TEST_URL=https://<nonproduction-project-ref>.supabase.co
FLAVOR_RLS_TEST_ANON_KEY=<test-project-anon-key>
FLAVOR_RLS_TEST_SERVICE_ROLE_KEY=<test-project-server-only-admin-key>
FLAVOR_RLS_TEST_PROJECT_REF=<nonproduction-project-ref>
FLAVOR_RLS_TEST_ENVIRONMENT=nonproduction
FLAVOR_RLS_TEST_GATEWAY_URL=http://127.0.0.1:18887
FLAVOR_RLS_TEST_GATEWAY_ORIGIN=http://127.0.0.1:5195
FLAVOR_RLS_TEST_RUN_MODEL=true
```

```powershell
# Start the Gateway after the private .env.local contains the test-project URL and anon key.
& ./scripts/start_ai_local.ps1
# In another shell, from the worktree root (Node 20.6+):
node --env-file=.env.rls-test.local scripts/e2e/verify_ai_supabase_rls.mjs
```

The probe should not be pointed at production. If it fails after creating fixtures, inspect `_local/verification/ai-supabase-rls-real.json` for the generated IDs and cleanup status; no secret is written there. A future passing artifact needs real project ref, timestamp, all check outcomes and successful cleanup. Only then may the real RLS gate be considered for approval. A local model demonstration using an in-memory fake store does **not** satisfy it.

Official API references used to design the harness: [Supabase server-side admin user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), and [private Storage download](https://supabase.com/docs/reference/javascript/file-buckets-download).
