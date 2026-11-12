# Browser PCA Phase 3 release audit

Audited 2026-11-10 in `.worktrees/browser-pca` at `51032343bf0eead259e4819f936ab0676fa15857`. `git status --short --branch` was clean. `git fetch origin main` then `git rev-list --left-right --count origin/main...HEAD` returned `0 13`; `origin/main` was `595fb931fd2a2972bbac1132ddd3c48211ca5000`. Local `main` is a separate baseline and must not be treated as the release target.

## Ancestry and scope

The 13 first-parent commits ahead of `origin/main` are `948dd2a`, `9920c43`, `5bd7f51`, `55bc9c7`, `81f1630`, `05fc0b5`, `4919de0`, `2ed49e8`, `657bbfe`, `d65215b`, `ebdfcf0`, `9a1d664`, `5103234`. The three Browser PCA commits are the last three; the preceding commits implement and secure Agents SAI and staging RLS tests. A release created from the current branch therefore contains AI assistant code as well as Browser PCA. Cherry-picking `5103234` alone would omit the engine and plots. PR #24 and PR #25 remain separate drafts; this task does not modify them.

The current `.github/workflows/deploy-pages.yml` triggers on `main` push or manual dispatch and publishes the repository's single `github-pages` environment. Pushing or dispatching it for a preview could replace the formal site. The candidate preview uses a distinct repository and Pages URL, with only the compiled static artifact. Do not merge the candidate to `main` as part of this phase. A later code-release branch can be cut from the complete Browser PCA ancestry as `codex/browser-pca-phase3-rc`; it must receive a fresh comparison against `origin/main` and PR review before any formal release.

## Preview candidate

Build this worktree with `VITE_PCA_PREVIEW=true` and `vite build --base /FlavorInsightAI-BrowserPCA-Preview/`, run the static-route generator, inspect the emitted Worker URL, and publish the artifact to a dedicated preview repository. The formal base `/FlavorInsightAI/` remains unchanged in source. The preview repository must not contain private environment files, original Excel workbooks, or API credentials. Browser PCA must work without the Python/R API. Agents SAI model interaction depends on an authenticated Gateway; a static Pages preview by itself cannot host the Gateway or its secret key.

**Origin boundary:** GitHub Pages serves both repositories under `https://xqplayer.github.io`, so they have different release paths but the **same browser origin**. IndexedDB is shared by origin; paths are not a storage security boundary. The preview displays a synthetic-data-only warning and must not be used with confidential research files. A separate preview domain would be needed for true browser-storage isolation.

Preview acceptance requires the actual Pages URL, deployment commit, HTTP status for the module Worker, and browser E2E with synthetic CSV/XLSX, four plots, exports, refresh, and mobile viewport. A local Vite preview is supporting evidence only. Rollback: disable or delete the isolated preview Pages deployment after recording its published artifact; no production site or database rollback is involved.
