# FlavorInsight AI Platform UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing FlavorThresholdDB single-page application into the FlavorInsight AI platform with a shared shell, route-level loading, a new platform homepage, integrated database and Shimadzu workbenches, and honest analytics/resources pages without changing validated scientific calculations.

**Architecture:** Add a small platform router and global preferences provider in front of the existing database application and Shimadzu workbench. Load the two mature workbenches lazily and adapt them to an embedded mode, while new platform pages remain lightweight and share semantic design tokens. Preserve the two existing deep links and generate static entries for every public route.

**Tech Stack:** React 19, Vite 8, CSS semantic tokens, Lucide React, Node test runner, Playwright from the bundled Codex runtime.

---

## File structure

### Create

- `frontend/src/app/platformRoutes.js`: route parsing, href generation and history navigation.
- `frontend/src/app/PlatformApp.jsx`: top-level route selection and lazy loading.
- `frontend/src/app/PlatformPreferences.jsx`: controlled language and theme preferences.
- `frontend/src/components/platform/PlatformShell.jsx`: skip link, header, mobile navigation, account status menu and main container.
- `frontend/src/components/platform/PlatformShell.css`: responsive shell and focus styles.
- `frontend/src/pages/PlatformHomePage.jsx`: product introduction and task routing.
- `frontend/src/pages/DatabaseOverviewPage.jsx`: wrapper for the existing database landing experience.
- `frontend/src/pages/DataProcessingPage.jsx`: wrapper for the current Shimadzu workbench and compatibility entry.
- `frontend/src/pages/DataAnalysisPage.jsx`: honest development-status page.
- `frontend/src/pages/ResourcesPage.jsx`: real resources and clearly labelled planned items.
- `frontend/src/pages/PlatformPages.css`: shared page layout and responsive presentation.
- `frontend/src/platformRoutes.test.mjs`: pure route contract tests.
- `frontend/src/platformUiContract.test.mjs`: source-level product status, accessibility and loading-boundary contracts.
- `scripts/e2e/verify_platform_shell.mjs`: desktop/mobile route and overflow verification.

### Modify

- `frontend/src/main.jsx`: render `PlatformApp` instead of importing the database app eagerly.
- `frontend/src/App.jsx`: accept embedded route/language callbacks and hide its legacy navigation when embedded.
- `frontend/src/App.css`: scope database landing/search styles under the shared shell and remove duplicate top offsets.
- `frontend/src/tokens.css`: add platform semantic tokens and light/dark mappings.
- `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`: add embedded mode, shared language input and three-region landmarks without changing Worker calls.
- `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`: inherit platform tokens and align configuration/import/monitor hierarchy.
- `frontend/scripts/create-static-routes.mjs`: emit all public static route entries.
- `frontend/src/staticRoutes.test.mjs`: assert every route entry.
- `frontend/package.json`: add platform contract and E2E scripts without changing version.
- `frontend/index.html`: update neutral platform metadata.

## Task 1 Route contract

**Files:**
- Create: `frontend/src/platformRoutes.test.mjs`
- Create: `frontend/src/app/platformRoutes.js`

- [ ] **Step 1: Write failing route tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePlatformRoute, routeHref } from './app/platformRoutes.js'

test('maps public and compatibility paths', () => {
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/'), 'home')
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/database/'), 'database')
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/aroma-threshold/'), 'search')
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/data-processing/'), 'processing')
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/shimadzu-analysis/'), 'processing')
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/data-analysis/'), 'analysis')
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/resources/'), 'resources')
})

test('builds hrefs under a deployment base', () => {
  assert.equal(routeHref('resources', '/FlavorThresholdDB'), '/FlavorThresholdDB/resources/')
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `cd frontend && node --test src/platformRoutes.test.mjs`

Expected: FAIL because `app/platformRoutes.js` does not exist.

- [ ] **Step 3: Implement the pure route contract**

```js
export const PLATFORM_ROUTE_SEGMENTS = Object.freeze({
  home: '', database: 'database', search: 'aroma-threshold',
  processing: 'data-processing', analysis: 'data-analysis', resources: 'resources',
})

export function parsePlatformRoute(pathname) {
  const path = pathname.replace(/\/+$/, '')
  if (path.endsWith('/aroma-threshold')) return 'search'
  if (path.endsWith('/shimadzu-analysis') || path.endsWith('/data-processing')) return 'processing'
  if (path.endsWith('/database')) return 'database'
  if (path.endsWith('/data-analysis')) return 'analysis'
  if (path.endsWith('/resources')) return 'resources'
  return 'home'
}

export function routeHref(route, basePath = '') {
  const base = basePath.replace(/\/+$/, '')
  const segment = PLATFORM_ROUTE_SEGMENTS[route] ?? ''
  return `${base}/${segment ? `${segment}/` : ''}`
}
```

- [ ] **Step 4: Run the route tests**

Run: `cd frontend && node --test src/platformRoutes.test.mjs`

Expected: PASS.

## Task 2 Global preferences and semantic tokens

**Files:**
- Create: `frontend/src/app/PlatformPreferences.jsx`
- Modify: `frontend/src/tokens.css`

- [ ] **Step 1: Implement controlled preferences**

Create a context with `language`, `setLanguage`, `theme`, `setTheme`; read `flavorinsight:language` and `flavorinsight:theme`, fall back to Chinese and `matchMedia('(prefers-color-scheme: dark)')`, update `document.documentElement.lang` and `data-theme`, and persist changes.

- [ ] **Step 2: Add platform tokens**

Define `--platform-brand: #3385ff`, `--platform-ink: #17233d`, `--platform-canvas: #f7f9fc`, status colors, 70px header height, 1200px container and the 8/12/16/24px radius ladder. Map the existing token names to the new semantic values so existing database components remain functional.

- [ ] **Step 3: Add explicit dark mappings**

Under `:root[data-theme='dark']`, provide canvas, surface, text, border, focus and monitor colors with 4.5:1 text contrast. Do not alter FEMA, FlavorDB2, PubChem and threshold source semantics.

- [ ] **Step 4: Run lint**

Run: `cd frontend && npm run lint`

Expected: PASS for the new provider and CSS.

## Task 3 Platform shell and navigation

**Files:**
- Create: `frontend/src/components/platform/PlatformShell.jsx`
- Create: `frontend/src/components/platform/PlatformShell.css`
- Create: `frontend/src/platformUiContract.test.mjs`

- [ ] **Step 1: Write source contract tests**

Assert the shell source contains a skip link, five navigation destinations, `aria-current`, a labelled language control, a labelled theme control, an account status control, and no emoji icons.

- [ ] **Step 2: Verify the contract fails**

Run: `cd frontend && node --test src/platformUiContract.test.mjs`

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement the shell**

Use Lucide `Menu`, `X`, `Sun`, `Moon`, `Languages` and `UserRound`. Render a 70px fixed header, a mobile disclosure below 1100px, route links using `routeHref`, and an account menu explaining local mode and optional cloud retention. Clicking outside or pressing Escape closes menus.

- [ ] **Step 4: Implement keyboard and responsive CSS**

Include `:focus-visible`, 44px targets, `scroll-margin-top`, body top compensation, a visually hidden skip link that becomes visible on focus, and no page-level horizontal overflow.

- [ ] **Step 5: Run the contract and lint**

Run: `cd frontend && node --test src/platformUiContract.test.mjs && npm run lint`

Expected: PASS.

## Task 4 Platform homepage

**Files:**
- Create: `frontend/src/pages/PlatformHomePage.jsx`
- Create: `frontend/src/pages/PlatformPages.css`

- [ ] **Step 1: Extend the UI contract test**

Assert that the homepage includes the Chinese platform name, the evidence-oriented tagline, links for database search and data processing, explicit `已上线`, `开发中` and `规划中` labels, and does not claim deployed AI prediction.

- [ ] **Step 2: Implement the homepage**

Build the Hero, a code-rendered real-capability preview, the five-stage research chain, asymmetric module cards, platform principles, four factual FAQ items and a compact footer. Use real product capability labels and no fabricated users, usage counts or testimonials.

- [ ] **Step 3: Add subtle responsive motion**

Use CSS transitions and one-time opacity/translate entrance no longer than 500ms; disable it under `prefers-reduced-motion`. Keep both primary actions visible in a 768px-high desktop viewport.

- [ ] **Step 4: Run the contract and lint**

Run: `cd frontend && node --test src/platformUiContract.test.mjs && npm run lint`

Expected: PASS.

## Task 5 Platform router and lazy boundaries

**Files:**
- Create: `frontend/src/app/PlatformApp.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Extend route tests for compatibility state**

Test that the compatibility Shimadzu URL maps to the same processing route while `routeHref('processing')` uses the canonical `/data-processing/` path.

- [ ] **Step 2: Implement `PlatformApp`**

Listen to `popstate`, expose a `navigate(route)` helper using `history.pushState`, wrap pages in `PlatformPreferences` and `PlatformShell`, and declare lazy imports for the legacy database app and Shimadzu page. Use a lightweight accessible route fallback.

- [ ] **Step 3: Render the platform router from `main.jsx`**

Replace the eager `App` import with `PlatformApp`; retain the existing root error boundary behavior if present.

- [ ] **Step 4: Add embedded inputs to `App.jsx`**

Accept `{ initialView, embedded, language, onLanguageChange, onNavigate }`. Use controlled language when supplied; hide the two legacy navigation blocks in embedded mode; direct Home, database, search and processing actions through `onNavigate`; keep standalone behavior as fallback. Key the lazy database app by route so `home` and `search` initialize correctly.

- [ ] **Step 5: Verify lazy boundaries**

Run: `cd frontend && npm run build`

Expected: PASS and Vite output includes separate database and Shimadzu chunks; the platform entry must not contain the large threshold JSON payload.

## Task 6 Database overview and search integration

**Files:**
- Create: `frontend/src/pages/DatabaseOverviewPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Implement the database wrapper**

Render the existing database application with `initialView="home"`, `embedded`, controlled language and platform navigation callbacks. The search route uses the same component with `initialView="search"`.

- [ ] **Step 2: Reframe legacy homepage copy**

Keep database coverage, sources, SearchInsights and citation content, but identify it as the FlavorThresholdDB module rather than the entire platform. The logo and top-level contact controls come from the platform shell.

- [ ] **Step 3: Align database CSS**

Remove duplicate fixed navigation offsets in embedded mode, use platform canvas/surface/text tokens, keep source-specific colors, and ensure classic/new results remain visually unchanged where scientific information density matters.

- [ ] **Step 4: Run database regression tests**

Run: `cd frontend && npm run test:book-search && npm run test:search-workbench && npm run lint && npm run build`

Expected: PASS.

## Task 7 Data processing integration

**Files:**
- Create: `frontend/src/pages/DataProcessingPage.jsx`
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`

- [ ] **Step 1: Extend the Shimadzu layout contract**

Assert the component exposes three labelled regions: analysis/output configuration, data import/preflight and process monitor/results; assert it contains no step-by-step execution option.

- [ ] **Step 2: Add embedded mode and controlled preferences**

Accept platform language/theme and navigation callbacks. Hide the standalone Shimadzu header in embedded mode while keeping the current standalone fallback for compatibility tests.

- [ ] **Step 3: Group existing controls into the three regions**

Reuse existing file inputs, export toggles, preflight, workflow map, live monitor, stage rail, task history and downloads. Move markup only; do not alter Worker messages, stage gates, CAS recovery, classification, threshold, OAV, CV or result ZIP generation.

- [ ] **Step 4: Align workbench CSS**

Map `--sz-*` variables to platform tokens, keep the dark monitor surface, reduce decorative Hero height, make the configuration summary collapse after a task begins, and permit local horizontal scrolling only inside the stage rail and tables.

- [ ] **Step 5: Run Shimadzu regressions**

Run: `cd frontend && npm run test:shimadzu-browser && npm run test:shimadzu && npm run lint && npm run build`

Expected: PASS.

## Task 8 Analysis and resources pages

**Files:**
- Create: `frontend/src/pages/DataAnalysisPage.jsx`
- Create: `frontend/src/pages/ResourcesPage.jsx`
- Modify: `frontend/src/pages/PlatformPages.css`

- [ ] **Step 1: Extend copy contracts**

Assert analysis features are labelled `开发中` or `规划中`, and resources without a verified file do not render download anchors.

- [ ] **Step 2: Implement analysis status page**

Describe the standard data package and planned quality summary, PCA, HCA, heatmap, differential compounds, OAV, similarity and future AI modules. Provide a route back to data processing, not a fake upload form.

- [ ] **Step 3: Implement resources page**

Provide verified template and method links already served by the local proxy or repository; render non-available resources as descriptive planned cards without click handlers.

- [ ] **Step 4: Run contract, lint and build**

Run: `cd frontend && node --test src/platformUiContract.test.mjs && npm run lint && npm run build`

Expected: PASS.

## Task 9 Static deployment and metadata

**Files:**
- Modify: `frontend/scripts/create-static-routes.mjs`
- Modify: `frontend/src/staticRoutes.test.mjs`
- Modify: `frontend/index.html`
- Modify: `frontend/package.json`

- [ ] **Step 1: Extend the failing static route test**

Assert entries for `database`, `aroma-threshold`, `data-processing`, `shimadzu-analysis`, `data-analysis` and `resources`.

- [ ] **Step 2: Verify failure**

Run: `cd frontend && npm run test:static-routes`

Expected: FAIL for the four new routes.

- [ ] **Step 3: Update the route generator and metadata**

Export one frozen route list from the generator, iterate over it, and update the neutral title and description to FlavorInsight AI. Do not change the package version.

- [ ] **Step 4: Add scripts**

Add `test:platform` for the two platform test files and `test:e2e:platform` for `verify_platform_shell.mjs`.

- [ ] **Step 5: Verify static routes and build**

Run: `cd frontend && npm run test:static-routes && npm run build`

Expected: PASS and all route directories exist under `dist`.

## Task 10 Browser and responsive verification

**Files:**
- Create: `scripts/e2e/verify_platform_shell.mjs`

- [ ] **Step 1: Implement platform E2E checks**

Use the bundled Playwright resolution pattern from `verify_release_candidate.mjs`. Start Vite on a free port, then for 1440×900 and 375×812 visit all seven routes. Assert the expected heading, no page-level horizontal overflow, no console/page/request errors, visible focus after keyboard navigation, working mobile menu, persistent language/theme and preserved direct deep-link refresh.

- [ ] **Step 2: Capture internal QA screenshots**

Write screenshots for home, database, search, processing, analysis and resources at desktop and mobile widths under `_local/verification/platform-ui`; these are QA artifacts, not source files.

- [ ] **Step 3: Run platform E2E**

Run: `cd frontend && npm run test:e2e:platform`

Expected: PASS with zero page-level overflow and zero unhandled browser errors.

- [ ] **Step 4: Inspect all screenshots**

Confirm no clipping, overlap, broken CJK glyphs, inaccessible low contrast, misplaced fixed navigation, dead buttons or misleading capability states. Fix and repeat the E2E run until clean.

## Task 11 Full regression and completion evidence

**Files:**
- Modify only files implicated by failures.

- [ ] **Step 1: Run unit and contract suites**

Run: `cd frontend && npm run test:platform && npm run test:static-routes && npm run test:book-search && npm run test:search-workbench && npm run test:shimadzu && npm run test:shimadzu-browser`

Expected: all PASS.

- [ ] **Step 2: Run lint and production build**

Run: `cd frontend && npm run lint && npm run build`

Expected: PASS, package version remains `1.5.0`.

- [ ] **Step 3: Run browser verification**

Run: `cd frontend && npm run test:e2e:platform`

Expected: PASS at desktop and mobile viewports.

- [ ] **Step 4: Verify preservation and diff scope**

Run `git status --short`, `git diff --check`, and compare the current scientific core file hashes against the pre-implementation inventory. Confirm no unintended data, cache, backup, result or release artifact changes.

