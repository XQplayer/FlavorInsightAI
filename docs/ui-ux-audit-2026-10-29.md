# FlavorInsight AI UI/UX baseline audit (2026-10-29)

## Scope and evidence

Baseline: `main` at `4fda49e`. This audit covers the current React application and visible routes, not a change to scientific rules. The reference screenshots are in the ignored local verification folder `_local/verification/platform-ui/2026-10-29T07-13-04-916Z/desktop/` of the original checkout.

## Application map

| Area | Current implementation | Current status |
| --- | --- | --- |
| App shell and routes | `frontend/src/app/PlatformApp.jsx`, `platformRoutes.js`, `components/platform/PlatformShell.jsx` | Live; History API routes under `/FlavorInsightAI/` |
| Homepage | `pages/PlatformHomePage.jsx` and shared `PlatformPages.css` | Live |
| Database overview and search | `pages/DatabaseOverviewPage.jsx` wraps `App.jsx`; search is `/aroma-threshold/` | Live; single and batch search, filters, source details and CSV export already exist |
| Data processing | `pages/DataProcessingPage.jsx` wraps `components/shimadzu/ShimadzuAnalysisPage.jsx` | Live; Shimadzu GC-MS browser workflow |
| Data analysis | `pages/DataAnalysisPage.jsx`, `components/analysis/*`, `styles/analysis*.css` | Beta; importing, grouping, preprocessing, statistical methods, plots, records and exports require local Python service for computation |
| Resources | `pages/ResourcesPage.jsx` | Live for verified resources; future resources are marked unavailable |
| Login | `pages/PlatformLoginPage.jsx` | Informational local-mode access page; full account service is not enabled |
| AI model | No production model in this application | Planned; never present as deployed |

The frontend is React 19 + Vite 8 + Tailwind 4, but most application styling is custom CSS. Existing Lucide icons are already a dependency. The Vite base is `/FlavorInsightAI/`; static-route generation is part of the production build. No routing, design-system or charting dependency needs to be added for this UI pass.

## Existing strengths to preserve

- `PlatformShell` already provides a skip link, active route state, mobile menu, language toggle, theme toggle and local-mode account indicator.
- `PlatformPreferences` defaults to English, persists language and theme locally, respects system color scheme and updates the document language.
- `RouteErrorBoundary` and lazy route loading already exist.
- Database search already contains advanced filters, compound/source details, empty/error states and export controls. Preserve its search and export contracts.
- Shimadzu processing already has staged task state, review gates, partial-result evidence and browser-local computation. Preserve all workflow decisions and output contracts.
- Data analysis already has dataset/group editing, tabbed methods, result visualizations and project export. Keep the service availability state explicit.

## Problems observed

1. Homepage has a large hero preview followed by workflow, modules, principles, FAQ and a long footer. It repeats provenance/local-first claims and delays the main workbench choices. A real product view should replace the illustrative trajectory as the primary preview.
2. `PlatformPages.css` serves home, login, resources and status pages in one large file with later high-specificity overrides. `App.css` and the Shimadzu stylesheet contain further embedded-page overrides. This creates a fragile cascade and inconsistent spacing/radius decisions.
3. Current semantic tokens still use older mist/blue-gray colors (`tokens.css`), while component files hardcode additional blues, greens and grays. Dark mode exists but is not fully token-led.
4. The analysis page uses a compact 6px-radius control style and broad `.analysis-workbench button/input` selectors. It feels visually detached from the shell, and offline-service feedback competes with project and import actions.
5. The data-processing workbench has a large route-local stylesheet and dense controls. It must be improved through scoped visual/layout changes, not an algorithm or step rewrite.
6. The database overview has a second hero and many source-specific surfaces. Embedded mode already removes part of the duplicate brand treatment, but the hierarchy remains weaker than the platform shell.
7. Mobile collapse rules exist at several breakpoints, but each key route needs real 375/768/1024/1440px verification. Fixed navigation and wide scientific tables are the main overflow risks.
8. The current homepage calls a composed illustration a capability preview. It is not a real screenshot; it should be labelled as a diagram or replaced by a screenshot of a functioning route.

## Science and interface freeze

This UI branch must not change `frontend/src/shimadzu-core/**`, `frontend/src/workers/**`, `frontend/src/analysis/*.mjs`, `services/analysis/**`, database matching/classification modules, threshold selection rules, proxy responses, workbook schema, CSV/XLSX/ZIP/JSON output contents or column order. Existing feature tests and browser workflow tests are mandatory after each relevant stage. Any unclear scientific wording stays as-is until verified.

## Baseline verification

`scripts/e2e/verify_platform_shell.mjs` built the production site and captured desktop home, database, search, processing and analysis routes. It stopped at analysis because the independent service on `127.0.0.1:8890` was offline: two expected `ERR_CONNECTION_REFUSED` browser errors made the strict clean-console assertion fail. This is an environment prerequisite, not evidence that the UI redesign caused a regression. The preview-only scientific service must be started or explicitly mocked for full route acceptance.

## Stage gates

1. Audit: this report, scope boundaries and baseline screenshots.
2. Design: tokens, information architecture, component inventory, responsive and state specifications.
3. Global shell/home: route, keyboard, language/theme and homepage screenshot comparisons.
4. Database, processing, analysis: each in an independent commit, with route-specific feature and visual checks.
5. Resources/login/error and cross-route QA: no false AI/account promises; dark/light, 375/768/1024/1440px and keyboard checks.
6. Production build and GitHub Pages path check: no deploy/push without a separate request.
