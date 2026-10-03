# FlavorInsight AI Platform Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved FlavorInsight AI site at `/FlavorInsightAI/`, with an honest account-status page, English-first bilingual navigation, restrained brand glass, readable research workbenches, and a verified GitHub Pages migration.

**Architecture:** Keep the existing React/Vite pathname router and Shimadzu/database business logic. Add a route and page for account status, centralize four-level capability labels, and apply page-scoped design tokens; change Vite base and static deep-link generation without a new router. Publish only after local tests and direct-link checks pass.

**Tech Stack:** React 19, Vite 8, plain CSS, Node test runner, PowerShell, GitHub Pages.

---

## Files and responsibilities

- `frontend/src/app/platformRoutes.js`, `PlatformApp.jsx`, `platformPreferences.js`: route, title, and initial language behavior.
- `frontend/src/components/platform/PlatformShell.jsx` and CSS: shared navigation, account entry, responsive shell, tokens.
- `frontend/src/pages/PlatformHomePage.jsx`, new `PlatformLoginPage.jsx`, `PlatformPages.css`: brand experience and honest capability status.
- `frontend/src/pages/DataAnalysisPage.jsx`, `ResourcesPage.jsx`, `DatabaseOverviewPage.jsx`, `DataProcessingPage.jsx`: shared status and page-level visuals without changing scientific computation.
- `frontend/vite.config.js`, `frontend/scripts/create-static-routes.mjs`, `.github/workflows/deploy-pages.yml`: new deployment path and direct-load HTML.
- `scripts/local_runtime.ps1`, current docs: new local and GitHub URLs; historical records stay unchanged.
- Existing `frontend/src/*.test.mjs`, `scripts/e2e/*`: behavioral and integration verification.

### Task 1: Route and language contract

- [ ] Add failing assertions to `frontend/src/platformRoutes.test.mjs` for `login` and to `frontend/src/platformUiContract.test.mjs` for English-first startup, login title, and route rendering. Run with bundled Node `--test` and confirm expected failures.
- [ ] Add `login` to `PLATFORM_ROUTE_SEGMENTS` and parser map; set explicit `VALID_LANGUAGES = new Set(['en', 'zh'])` and `DEFAULT_LANGUAGE = 'en'`; add bilingual login titles and route branch. Re-run tests and confirm green.
- [ ] Keep saved language preference precedence and add a test for it in the existing preference suite; run it.

### Task 2: Honest account-status page and navigation

- [ ] Add failing source/route tests asserting that account entry points to `login`, page contains a real local-use destination, and has no email/password input or fake submit.
- [ ] Build `frontend/src/pages/PlatformLoginPage.jsx` with full-viewport two-column composition, English/Chinese copy, account-unavailable status, and `routeHref('home', base)` local-use link; add scoped CSS to `PlatformPages.css`.
- [ ] Replace the shell's account popover with a normal accessible login-page link; keep mobile menu, language, and theme controls intact. Re-run platform tests.

### Task 3: Design system and capability states

- [ ] Add tests for exact five required surface/accent colors, four statuses, and non-interactive future-module cards; confirm red.
- [ ] Add brand/workbench CSS tokens and scoped glass fallback (`prefers-reduced-transparency`, no `backdrop-filter`); use Inter and Chinese/monospace fallbacks. Keep data panels opaque.
- [ ] Refactor the homepage Hero title to exactly `FlavorInsight AI` and its workflow/module statuses to Available/Beta/In development/Planned. Verify the actual OAV implementation before marking flavor contribution; keep future AI unavailable.
- [ ] Update analysis/resources labels to the same taxonomy, keeping planned items non-interactive; run UI contract tests.

### Task 4: New base path and static deep links

- [ ] Add failing tests to `frontend/src/staticRoutes.test.mjs` for `login` HTML and base `/FlavorInsightAI/`; confirm red.
- [ ] Set Vite `base` to `/FlavorInsightAI/`, add `login` to static route generator, preserve `404.html` fallback. Update runtime URL and path-sensitive tests. Build and inspect generated HTML/asset URLs.
- [ ] Start isolated local Vite server on an unused port and directly load, refresh, and navigate home, database, search, processing, analysis, resources, and login paths.

### Task 5: Scientific regression and responsive checks

- [ ] Run all platform/static/database/Shimadzu Node suites and frontend lint/build, plus existing platform/search E2E if browser tooling is available. Record any pre-existing limits.
- [ ] At 375/768/1024/1440px verify no page-level horizontal overflow, keyboard focus, reduced-motion/transparency fallback, light/dark legibility, and direct-link behavior.
- [ ] Confirm CAS, thresholds, RI, QC errors, partial-result download, sorting, and exports were not modified; run representative existing regression checks.

### Task 6: Documentation and publishing

- [ ] Copy the selected Apple design reference into a separate attributed/licensed reference file without overwriting root `DESIGN.md`; document project-specific tokens.
- [ ] Replace current-use platform URLs and GitHub links in scripts/docs/resources while preserving `PROJECT_HISTORY.md` and historical facts. Search for old URLs and classify remaining matches.
- [ ] Commit verified code on `codex/flavorinsight-redesign`. After local checks pass, verify target GitHub repository name is available, rename `XQplayer/FlavorThresholdDB` to `XQplayer/FlavorInsightAI`, update `origin`, push and verify Pages deployment.
- [ ] Directly open and refresh every new Pages deep link; check assets, internal navigation, language persistence, and account-status behavior before claiming completion.

## Review gates

Do not publish if any scientific regression or route/build check fails. Do not describe GitHub Pages or the new account page as deployed until live checks pass. Keep the user-owned dirty `main` worktree untouched; bring the verified branch back to local `main` only after explicit integration review.
