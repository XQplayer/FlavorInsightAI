# On-demand authentication acceptance

Date: 2026-11-13. Branch: `codex/on-demand-auth`, isolated worktree. Baseline: `origin/main` `6be8484`. The operation matrix and implementation contract are in `ON_DEMAND_AUTH_PLAN.md`.

## Implemented

- All seven requested destinations remain public, including direct URL access and refresh. Monitor, results and task management show a guest empty state; anonymous users do not request private task or conversation lists.
- One Supabase LoginPage handles sign-in, account request, verification-email resend and sign-out. A protected action verifies the current Supabase user and stores a 15-minute, single-use, internal-route intent. Only allowlisted bounded form values are restored. Files, tokens and passwords are not stored. The user must reselect files and click the action again; no task or message auto-submits.
- GC-MS private run controls and AI requests use the shared gate. Browser PCA local import, computation, plots and IndexedDB results remain usable anonymously. Model capability pages remain browsable; they currently expose no hosted prediction action.
- Existing Supabase RLS and AI Gateway JWT checks remain the server-side authority. No database migration, Worker algorithm or raw research data changed.

## Executed checks

All commands ran from `frontend/` unless specified. Browser test used programmatic Vite, local Edge and synthetic mocked Supabase/Gateway endpoints; it did not use production credentials.

| Command | Result |
| --- | --- |
| `node --test src/app/authIntent.test.mjs src/platformUiContract.test.mjs src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs` | 34 passed |
| `node --test src/onDemandAuth.browser.test.mjs` | 1 passed: seven anonymous routes and refresh, no private reads, failed/successful login return, no replay, processing form restoration and empty file inputs, mobile layout |
| `pnpm run test:platform` | 37 passed after including the auth-intent checks in the PR quality workflow |
| `pnpm run test:shimadzu` | 24 passed |
| `pnpm run test:shimadzu-browser` | 106 passed |
| `pnpm run test:analysis` | 130 passed |
| `pnpm run test:static-routes` | 5 passed |
| `pnpm run test:book-search` | 23 passed |
| `pnpm run lint` | passed |
| `pnpm run build` | passed; existing third-party 3Dmol eval, large chunk and RDKit browser-externalized warnings |
| `pnpm audit --prod` | no known vulnerabilities |
| `python -m unittest scripts.tests.test_ai_gateway scripts.tests.test_ai_tools scripts.tests.test_ai_pca_gateway scripts.tests.test_ai_only_server -q` | 54 passed (repository root) |
| `python -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -q` | 15 passed (repository root) |
| `git diff --check` | passed |

## Evidence and limits

Browser screenshots from the synthetic test are in ignored local folder `_local/verification/on-demand-auth/`: `assistant-anonymous-mobile.png`, `assistant-after-login-desktop.png`, `processing-after-login-desktop.png`, `login-mobile.png`.

Local preview was started from this isolated worktree at `http://127.0.0.1:5186/FlavorInsightAI/`. `Invoke-WebRequest` returned HTTP 200 for the entry and the served LoginPage module; the module contained the new unified-account copy. This preview has no production Supabase credentials, so account sign-in there is not a production authentication test.

This change has **not** been deployed or tested against the production Supabase project. The browser login return test uses mocked authentication. Email verification reuses the existing `/FlavorInsightAI/shimadzu-analysis/` callback because the production Auth URL allowlist could not be read with the available scoped token; the registration email callback still needs a real production smoke test. Existing server RLS/JWT authorization code was not changed. Cross-user production data isolation was not retested in this task. A deployment without Supabase configuration can still run supported browser-local functions, while private operations report that the account service is unavailable.

Release follow-up: the first PR #34 quality run `43452666025` failed because `staticRoutes.test.mjs` asserted the previous exact `test:platform` command. The test contract was updated to include `authIntent.test.mjs`; local `pnpm run test:static-routes` (5/5) and `pnpm run test:platform` (37/37) then passed. A new remote run is required for the corrected head before merging.

The corrected PR head `c9a00ce` passed quality run `43453004437` and Firefox/WebKit run `43453004145`. The later email-callback compatibility change and synthetic registration browser assertion require their own matching remote run before merge.

Rollback after the local commit: `git revert <this commit>` on the development branch; no data or schema rollback is required.
