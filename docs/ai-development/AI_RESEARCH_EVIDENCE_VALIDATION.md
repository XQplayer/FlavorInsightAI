# Agents SAI evidence and authorization upgrade — local acceptance

Date: 2026-11-10. Branch: `codex/ai-research-assistant`. Baseline: `5bd7f51cf4273f0b604b4d17d36fad2b5234fd3c`. Work was done in `.worktrees/ai-research-assistant`; the main checkout was not edited. No push, merge, migration or deployment was performed.

## Scope and implementation

This is an L3 API, security and research-data change under `AGENTS.md` and the unified routing rules. The existing server-side Responses API, real streaming, conversations, quotas, CAS tool and key handling remain in place. No Agents SDK or extra service was introduced. Inputs are an authenticated principal plus a public compound identifier or private task UUID. Outputs are bounded, source-attributed public fields or a permission-checked task projection. Failures have explicit codes and never fall back to another user's task. The written implementation contract is `docs/superpowers/plans/2026-11-10-ai-research-evidence-upgrade.md`.

- Public `get_compound_detail` now distinguishes platform name, CAS, descriptors and raw threshold *source lines* from verified PubChem physicochemical and volatile records. PubChem enrichment is attached only if the platform's CID resolves back to the exact CAS. Structure class and absent fields remain `unavailable`. Raw threshold line count is never called a validated threshold count.
- Private `get_analysis_task` first queries the caller's own row. A cross-owner read requires a JWT-backed profile with `is_admin=true` and the existing database RLS. Foreign and absent IDs both return `TASK_NOT_FOUND`. Model-supplied `user_id` is rejected by the tool schema. The gateway checks the first forced task tool's UUID against the user's requested UUID.
- A completed `get_analysis_summary` reads only the existing retained result ZIP through the caller's token, after owner/RLS, exact storage path, expiry, archive size and SHA-256, Stage 4 file limit and manifest hash checks. It projects at most 12 compound rows and 12 `Calculated` concentration cells, counts categories, and states the Stage 4 `μg/mL` system unit and internal-standard semi-quantitative method. It does not send raw Excel or full logs. Archive integrity is **not** independent scientific validation. Missing/expired/oversized evidence is explicit.
- Completed current and historical GC-MS tasks now link to a prefilled AI interpretation prompt. The page waits for the user to send; it does not automatically call the model. The assistant page displays the task evidence boundary.
- Gateway history is bounded to 16 messages / 12,000 characters, the tool projection has a valid-JSON size limit, and incomplete OpenAI responses report an output-limit error. The default maximum output is 1,000 tokens. A rejected private task stops before a second model request. Cancelling a chat now explicitly closes the upstream stream; unit tests check slot release and no partial answer persistence. Existing rate, daily, concurrency, timeout and usage controls remain.

## Evidence and commands

All commands were run from this worktree unless a `frontend` directory is specified. The private `.env.local` was ignored by Git. Test logs and live answers reside under ignored `_local/verification/` and are not part of the commit.

| Check | Command | Actual result |
| --- | --- | --- |
| Python API, tools, auth and synthetic multi-user tests | `python -m unittest discover -s scripts/tests -p 'test_*.py' -q` | 174 tests, all passed (15.486 s). |
| Frontend tests | `cd frontend; pnpm exec node --test` | 462 total, 461 passed, 1 skipped, 0 failed. |
| Lint | `cd frontend; pnpm run lint` | Passed. |
| Build | `cd frontend; pnpm run build` | Passed; existing RDKit browser-externalization, 3Dmol `eval`, and large-chunk warnings remain. |
| Dependency scan | `cd frontend; pnpm audit --prod` | `No known vulnerabilities found`. |
| Browser task context | `CODEX_E2E_PLAYWRIGHT=<local Playwright module> AI_E2E_CHROME=<local Chrome> node scripts/e2e/verify_ai_task_context.mjs` | Desktop 1440 and mobile 390 passed: task prompt, no auto model request, no page error or horizontal overflow. |
| Browser live chat | Same browser environment, `node scripts/e2e/verify_ai_live_browser.mjs` | Passed: real `search_compound`, visible source and usage, no browser OpenAI or `sk-` Bearer request, no overflow. Screenshot: `_local/verification/ai-live-browser.png`. |
| Public deep CAS, paid model call | `python scripts/e2e/verify_ai_live_deep.py` | Passed: `get_compound_detail`; FlavorThresholdDB, PubChem and PubChem PUG View sources; 2,755 input / 738 output tokens, locally estimated USD 0.01289. |
| Synthetic task, paid model call | `python scripts/e2e/verify_ai_synthetic_summary_live.py` | Passed after aligning the fixture with real Worker `Calculated` status: `get_analysis_summary`; 1,540 input / 536 output tokens. Script did not load price-rate variables, so its cost is `null`, not zero. |
| Whitespace and worktree | `git diff --check`; `git status --short --branch` | No whitespace errors; only this worktree's intended files changed before commit. |

The public deep test initially encountered `OPENAI_INCOMPLETE`: a large tool response had been cut mid-JSON at 12,000 characters. We limited raw threshold excerpts and volatile records, use a valid JSON `TOOL_OUTPUT_TOO_LARGE` result if needed, and distinguish `response.incomplete`. A subsequent real call passed. This was a model transport/projection defect, not a change to research calculations. The browser live test was one further paid public CAS call. Costs of all historical and browser calls were not reconciled to the OpenAI billing ledger.

## Permission and scientific acceptance

Synthetic two-user tests create Alice and Bob JWT identities, two task rows and a separately verified admin profile through an in-memory fake of the existing Supabase REST/RLS behavior. Tests cover owner allow, foreign deny, absent ID same denial, admin allow, extra `user_id` argument rejection, forged JWT denial and cross-user conversation 404. A foreign-task model response produces one upstream request and no private source. Retry tests show one read-only tool call despite a 429 on the next model request; cancellation tests show stream closure and no partial conversation commit. ZIP tests cover valid derived data, redacted email, SHA mismatch and path traversal. The server, not the frontend, owns these decisions.

The public live CAS case is **141-78-6**. The answer identified a sourced compound record and PubChem property records, reported that threshold lines are unparsed and did not calculate OAV. The real-model synthetic task answer explicitly called its 2.5 `μg/mL` result demonstration data, called it semi-quantitative, kept QC PASS distinct from independent validation and did not convert it to `μg/g` or infer OAV. These are behavior checks, not independent validation of chemical or statistical algorithms.

**Private task production readiness: not verified.** No local `FLAVOR_AI_SUPABASE_URL` or `FLAVOR_AI_SUPABASE_ANON_KEY`, two ordinary approved test accounts, or authorized synthetic tasks in a real Supabase test project were available. The fake RLS tests do not prove deployed policy behavior. Before enabling private-task retrieval for production, use two ordinary approved accounts and one synthetic task each in an isolated Supabase environment; verify owner/foreign/absent reads, result storage RLS, profile admin behavior, conversation isolation and model tool calls through the running HTTP service. Do not substitute an admin account for the ordinary-user denial test.

## Remaining risks and rollback

- Local guest access to the real model is explicitly allowed only by `FLAVOR_AI_ALLOW_LOCAL_REAL=true` for local verification; keep it disabled outside loopback testing. Keep `.env.local` private and never commit API keys.
- The in-memory conversation and quota store resets on server restart. A persistent, cross-instance store is needed before multi-instance production use.
- Only a bounded Stage 4 result excerpt is exposed; large, missing or expired archives report unavailable. Aggregate QC and Stage 4 file hashes are integrity evidence, not reference-value validation. Other chemical fields may be absent and remain labelled unavailable.
- Existing frontend build warnings remain outside this task. `pnpm audit --prod` is a time-specific dependency scan, not an application penetration test.
- Rollback on this branch: `git revert <this-stage-commit>`. This removes the gateway/tool/UI/test changes without touching raw research data or the seven-stage Worker algorithm. No database migration was made.

Modified areas: `services/ai_tools.py`, `services/ai_gateway.py`, `fema_proxy_server.py`, `.env.example`, the assistant and Shimadzu result-entry UI, corresponding Python/frontend tests, three verification scripts, the plan and this report. `frontend/src/workers/shimadzuPipeline.js`, `frontend/src/shimadzu-core/`, source workbooks and database migrations were not modified.
