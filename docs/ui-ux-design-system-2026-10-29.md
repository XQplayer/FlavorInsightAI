# FlavorInsight AI UI/UX redesign contract

## Design read

Reading this as: a scientific SaaS redesign for flavor-chemistry researchers, with a precise, trustworthy workspace language. The homepage may use restrained brand depth; dense scientific workbenches prioritize legibility and state. Design variance 5, motion 3 and density 4 on the homepage; density 7 in data workbenches. This is a visual overhaul with scientific and route contracts preserved.

The `design-taste-frontend` guidance applies to the homepage and introductory surfaces. It explicitly excludes data tables, dashboards and multi-step wizards; those retain the existing project-native React/CSS controls with scoped refinements. Do not add Fluent, Carbon, Tailwind component kits or another large dependency to this existing stack.

## Visual tokens

| Role | Light | Dark | Usage |
| --- | --- | --- | --- |
| Brand navy | `#102A43` | `#DDEBFA` text on dark canvas | Identity and high-emphasis headings |
| Action blue | `#2563EB` | `#74A4FF` for text and focus | Primary interactive state; white text only on the light action fill |
| Cyan accent | `#06B6D4` | `#55D8EA` | Data highlights, progress and selected detail; not a white-text button fill |
| Canvas | `#F5F7FB` | `#101B2A` | Full workbench background |
| Surface | `#FFFFFF` | `#17263A` | Cards and control regions |
| Success | `#10B981` | `#4ADEAD` | Actual success only, with text/icon |
| Warning / error | semantic amber / red | elevated contrast variants | Actual warning and failure only |

Use one semantic CSS-token layer in `tokens.css`, preserving old variable names as compatibility aliases. Keep blue for actions and cyan for data emphasis. The 8px spacing scale is `4, 8, 16, 24, 32, 40, 48, 64` px, with 12/20px transitional slots only for dense scientific controls. Surfaces use 12-16px radii, controls 8px, badges compact, focus a visible 3px outline. Shadows communicate elevation only; no large shadow on table rows. Use Segoe UI Variable/Segoe UI with PingFang SC and Microsoft YaHei fallbacks and tabular numerals for data. No remote font dependency.

## Page information architecture

| Route | First-screen priority | Secondary content | State treatment |
| --- | --- | --- | --- |
| Home `/` | One concise value statement and direct database/processing entry | Four module map, actual product preview, workflow; deep background material links to Resources | AI clearly planned; analysis Beta |
| Database `/database/` | Search entry and source scope | Provenance, statistics, search link | Loading/error/empty text; no fake live count |
| Search `/aroma-threshold/` | Query, precise/fuzzy mode, advanced filters and export | Compound card or table-style result area, structure/source evidence | Explain no result and external-source unavailability |
| Processing `/data-processing/` and compatibility `/shimadzu-analysis/` | Upload readiness, analysis settings and run action | Seven-stage status, QC, task record, export | Every gate state includes text, cause and next action |
| Analysis `/data-analysis/` | Project identity, local compute state, import/group navigation | Preprocessing, method settings, results and editable plot actions | Offline service does not imply data import failure; AI remains planned |
| Resources `/resources/` | Verified resources and external references | Planned resources clearly separated | No inactive item looks downloadable |
| Login `/login/` | Local-mode explanation and one continue action | Future account status | No fake credential form |

No route slug, top-level nav label, search input name or output label is silently changed. The sitemap remains stable for existing bookmarks and GitHub Pages.

## Reusable component inventory

- `PlatformShell`: brand, nav, skip link, language/theme switches, local-mode account indicator. This remains the one global navigation system.
- `StatusPill` currently embedded in homepage: extract or keep as a single consistent status visual only if more routes consume it.
- `RouteErrorBoundary` and route loading: preserve, restyle with shared state grammar.
- Existing database filter chips, integrated compound card, source badges and result view preference: reuse with tokenized spacing/contrast.
- Existing Shimadzu workflow rail, upload zones, task/result panels and stage evidence: reuse; do not alter event wiring or data transformation.
- Existing analysis `ImportPanel`, `GroupEditor`, `RecipePanel`, `AnalysisPanel`, `ResultsPanel`, plot components and `Controls`: reuse; restyle through `.analysis-workbench` scope.
- Lucide is already installed. Keep one icon family rather than adding a second one.

## Interaction rules

1. Navigation and primary controls stay keyboard operable. Visible focus is required on links, buttons, form fields, disclosures and tabs. Error and status feedback use text in addition to color.
2. Mobile navigation collapses below 1024px without overlaying content. Data tables scroll within their region, never force page-wide horizontal scroll.
3. Explicit loading, empty, warning, success and failure states must share the same visual grammar across routes. Avoid relying on a toast for persistent scientific failures.
4. Theme preference remains `system` by default and user-selectable; language remains English by default and switchable to Chinese. Both themes and languages are tested on every route.
5. Hover and active transitions change color/border or move at most 1-2px. All nonessential motion must honor reduced-motion. No new continuous animations in workbenches.
6. The homepage preview must be a captured real route image or an actual live component. Never fabricate measurement values or imply a planned AI model is live.

## Stage implementation and acceptance

### Stage 3: shell + homepage

Scope: semantic tokens, shell rhythm, homepage content hierarchy and true product preview. Pass when desktop/mobile navigation, EN/ZH, light/dark, focus order and all route links work; before/after screenshots show a shorter first screen and no overflow. Commit independently.

### Stage 4A: database

Scope: embedded overview, search/filter/results visual hierarchy and responsive layout. No search-state or export logic changes. Pass existing database/search unit tests plus browser search flow and source display checks. Commit independently.

### Stage 4B: data processing

Scope: upload/settings/workflow/status/table visual grouping only. No stage logic or workbook processing. Pass Shimadzu unit/browser tests and a read-only fixture workflow. Commit independently.

### Stage 4C: data analysis

Scope: dataset identity, service status, tabs, parameter and result presentation. No R/Python/JS method or export logic changes. Pass analysis unit/browser checks with local compute service, including disabled/offline state. Commit independently.

### Stage 5: supporting pages and cross-route QA

Scope: resources, login, route error/loading, state components. Pass 375/768/1024/1440px screenshots, keyboard tab order, EN/ZH, light/dark, reduced-motion and readable contrast. Commit independently.

### Stage 6: production release readiness

Scope: test-only fixes and documentation, production build, static-route deployment path check. Pass all relevant automated tests and verify `/FlavorInsightAI/` plus nested routes from the built site. Record warnings and unresolved issues. Commit independently. No GitHub push, public deployment or version change is implied by this redesign request.
