# Phase 5 preview origin isolation

Recorded 2026-11-11 (Asia/Singapore). Environment: GitHub Pages configuration and local browser build at `a6f9cbc`. Commands: `git show origin/main:.github/workflows/deploy-pages.yml`, `rg 'VITE_PCA_PREVIEW|databaseName|localStorage|serviceWorker' frontend/src`, local production-build Chrome E2E.

The existing preview `https://xqplayer.github.io/FlavorInsightAI-BrowserPCA-Preview/` and production `https://xqplayer.github.io/FlavorInsightAI/` share the origin `https://xqplayer.github.io`. Their path difference does **not** isolate IndexedDB or localStorage. The Browser PCA preview uses a distinct database name when `VITE_PCA_PREVIEW=true`, but this is a naming convention within the same origin. Supabase auth and cookies must be treated as potentially shared. Service Worker scope depends on registration path; none was used as evidence of full separation.

An independent-hostname preview is a release gate. A Sites account was discoverable, but its ownership by the repository owner has not been confirmed; no site was created and no credentials or real research data were sent there. Until a verified separate hostname is available, use **synthetic data only**. The current local preview `http://127.0.0.1:5262/FlavorInsightAI/data-analysis/` is served from Release 1 build and passed Chrome desktop/tablet/mobile checks; it is not an online isolation test.

Required acceptance on the separate host: different `location.origin`, no production IndexedDB/localStorage/cookies, no production Supabase session, no production data API calls, Worker served from its deployment base. Status: **BLOCKED — independent preview origin not yet verified**. Never clear formal-site user storage as a workaround.
