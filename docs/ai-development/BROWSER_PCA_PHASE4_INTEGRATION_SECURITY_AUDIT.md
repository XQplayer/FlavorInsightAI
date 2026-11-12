# Browser PCA Phase 4 integration and security audit

Audited 2026-11-11 (Asia/Singapore) in clean starting worktree `codex/browser-pca` at `f2c0703a9030207c8fab8e682a72aa488103d7c0`. Read-only `git fetch origin main` found `origin/main=595fb931fd2a2972bbac1132ddd3c48211ca5000`. This phase's local AI opt-out implementation is `7ff1bdd844080104f93584f3ab5da06f03083b00`. No formal repository branch was pushed or merged.

## Ancestry and scope

```text
origin/main 595fb93
  └─ shared AI ancestor 2ed49e8
      ├─ PR #25 head d65215b (draft, 10 commits ahead of main)
      │   └─ Browser PCA ebdfcf0 → 9a1d664 → 5103234 → 1ad5d1d → f2c0703 → 7ff1bdd
      └─ PR #24 head f478290 (draft, 18 commits ahead of main)
```

`git merge-base --is-ancestor codex/ai-assistant-release codex/browser-pca` exited 0. At the code commit the Browser branch was `0 behind / 16 ahead` of `origin/main`, changing 102 paths against main. The Browser branch includes the PR #25 assistant code, so a release must carry that ancestry; selecting the latest Browser documentation commit alone would omit the engine and Gateway.

| Pair | Actual relationship / conflict surface | Decision |
| --- | --- | --- |
| Browser PCA × [PR #25](https://github.com/XQplayer/FlavorInsightAI/pull/25) | PR #25 head is an ancestor. Both PR checks were `SUCCESS` when read; 55 same paths against main are inherited history, not 55 divergent conflicts. | Review and release PR #25 first, then rebase a complete Browser candidate on the new main. Do not merge either in this phase. |
| Browser PCA × [PR #24](https://github.com/XQplayer/FlavorInsightAI/pull/24) | Post-fork divergent changes overlap in `.env.example`, `.github/workflows/pr-quality-checks.yml`, `frontend/src/pages/AIResearchAssistantPage.jsx`, `frontend/src/pages/DataAnalysisPage.jsx`, `scripts/tests/test_ai_gateway.py`, `services/ai_gateway.py`. PR #24 checks were `SUCCESS`, but it contains separate hosted infrastructure and migration work. | Defer. Keep `VITE_AI_PCA_ENABLED` and server `FLAVOR_AI_PCA_ENABLED` false; resolve six paths only in a later hosted release. |
| Browser PCA × Mermaid Diagram Studio | `git branch -a` / `git log --all --grep=mermaid` / remote branch and PR listing found no Mermaid branch or PR in this repository. | Branch/repository identity and conflicts are unverified. Do not infer it is in `main` or combine it blindly. |
| Browser PCA × production `main` | `main` lacks `/ai/session`, `/ai/chat`, `/ai/analysis/plan` source routes. Main pushes trigger `.github/workflows/deploy-pages.yml`; repository `render.yaml` declares `autoDeploy: true`, although the live Render setting was not readable. | No direct main merge. Plan a controlled release with both frontend and backend readiness. |

No PCA SVD, GC-MS Worker, original research data or R workbench algorithm changed in Phase 4. The only product behavior added is a user AI switch: turning it off aborts an in-flight plan/explanation, clears pending AI output, and leaves local PCA results and exports intact. The Mock browser test failed before implementation on the absent switch, then passed with a delayed-response regression case.

## Trust boundaries and preview isolation

`scripts/e2e/verify_browser_pca_preview_boundary.mjs` ran against the real Pages preview with a fresh Chrome context and **synthetic canaries**. It observed `sameOrigin=true`, a synthetic `localStorage` value and synthetic IndexedDB record readable from both `/FlavorInsightAI-BrowserPCA-Preview/` and `/FlavorInsightAI/` paths. The formal path was served by an intercepted inert HTML response, so the test did not run formal-site code. The preview registered zero Service Workers in that context and made no request to Render or `*.supabase.co` during this probe. The preview build passed blank `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_FEMA_API_URL`; its AI controls remain disabled and a synthetic-only warning is visible.

Browser storage is scoped by origin, not URL path. Therefore the current distinct **repository** is not a distinct browser security origin; a compromised preview script could access same-origin storage even though the inspected build did not initialize Supabase or call Render. The preview must remain synthetic-only. A separately owned custom subdomain such as `pca-preview.<owned-domain>` with a Pages custom-domain mapping, DNS verification and HTTPS would create a separate origin. Its build must use staging-only public configuration and a staging Gateway CORS allowlist, with no production Supabase URL/key or authentication redirects. DNS ownership and setup were unavailable, so no custom domain was created. See [GitHub Pages custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages) and [MDN origin storage rules](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).

## Gateway source review and live boundary

The branch's `fema_proxy_server.py` defines authenticated `/ai/session`, `/ai/chat`, `/ai/analysis/plan` and `/ai/analysis/explain` routes. `services/ai_gateway.py` verifies Supabase bearer tokens through Auth, checks exact allowed origins, limits input/output, per-user request rate and concurrency, separates conversations by principal and records bounded usage. The private task tools default to disabled. The HTTP handler suppresses its standard request log; the tool audit stores user ID, tool name and status, not raw messages or keys. Usage, conversation state and rate counters are in process memory and reset on restart; these are not durable production quotas. Review of source cannot establish the active Render configuration or multi-instance behavior.

`curl.exe -L -sS --max-time 12` to public `/health` and `/ai/session` returned HTTP `000` (transport timeout); a separate 25-second `/health` request also timed out. The browser/web fetch tool could not access those URLs. Thus service ownership, currently deployed SHA, route responses, model configuration, Auth, CORS and live session isolation were **not** verified. The prior Phase 3 real OpenAI local-loopback demonstration is evidence for that earlier local build only, not for an online Gateway. No Secret was read or printed in this phase.

## Release blockers

1. Public Render AI routes and live configuration are unverified; `origin/main` source lacks them. No online Agent→Worker→GPT acceptance claim is possible.
2. Preview and formal Pages share browser storage. Use synthetic data only until an independent origin is established.
3. Firefox and WebKit Playwright binaries did not finish installing in two isolated temporary directories; those engines remain untested.
4. Render's in-memory quotas/history and actual deploy settings require an operations review before general release. Hosted PCA migration and Mermaid integration remain out of scope.
