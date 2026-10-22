# Analysis workbench browser checks

## 2026-10-23 — Task 3A checkpoint (not final acceptance)

Target: isolated development frontend at `http://127.0.0.1:5180/FlavorInsightAI/data-analysis/`, Python service at `127.0.0.1:8890`. A fresh headless Chrome context was used because the app browser plugin could not load its installed service module. No user browser profile or original scientific workbook was modified.

Verified through visible UI controls and actual service jobs:

- Synthetic example: 24 samples, eight features; PCA completed through the Python/R service.
- Welch comparison before independence confirmation failed with `INDEPENDENCE_REQUIRED`, retaining the failed run and source dataset. Explicit confirmation plus Apply metadata created a new snapshot; the comparison then returned eight results with BH adjustment.
- English/Chinese navigation and workbench text switched. At 390 px viewport width, document width was also 390 px. No page errors were observed during these checks.
- Aborting service requests in the test context made compute controls unavailable while portable export remained enabled. Reconnecting restored service availability; no persistent service was stopped.
- Portable JSON export and re-import retained the synthetic dataset and completed/failed/interrupted run history.
- The existing, complete HD demonstration archive imported as 18 samples × 124 features: 1,108 observed cells, 218 original-imputed cells and 906 missing cells. Independence remained unconfirmed.
- For HD exploratory analysis only, explicitly choosing median fill and dropping all-missing features produced 93 retained features; PCA completed with numerical rank 17. These choices are test settings, not automatic defaults or scientific conclusions.
- Exact regression for `851d06d`: after a new HD PCA run completed, wait for the current "saved locally" indication, immediately reload, restore the snapshot, and verify the completed result is still present. Passed.
- Fresh preprocessing results no longer show stale solely because the downstream selected method is PCA (`ad17552`).
- The real HD preprocessing matrix exposes 93 feature columns through bounded column pages, with sample IDs pinned (`54faa72`).
- Synthetic heatmap, correlation and distribution jobs completed from the UI. Synthetic three-class PLS-DA and two-class OPLS-DA jobs also completed, showing separate full-fit and held-out-validation sections. These two UI smoke runs explicitly used zero permutations; they do not constitute permutation validation. The separate engine/HTTP 200-permutation benchmark is documented in the execution plan.
- An actual submitted 200-permutation PLS-DA job was cancelled through the UI. The terminal cancelled record remained present without a later polling error overwriting it.
- Independent command-line checks: 21 Python service tests passed; R QC-priority and quality-regression suites passed.
- Quality review found that deterministic archive IDs could overwrite a previous analysis context on repeated import/handoff. `85b51f5` now forks a new UI snapshot while retaining the verified source identity. Browser regression: import the same real HD ZIP again, save the new UUID snapshot, then restore the old archive snapshot; all three prior completed preprocessing/PCA runs remained available. The core verified adapter is unchanged.

The test identified a real persistence-status race: the previous saved label stayed visible during the 150 ms debounce before saving the terminal result. Revision-aware save receipts now prevent that misleading label. A run lost during the pre-fix test correctly restores as interrupted; it is not retroactively presented as completed.

Task 3A specification review passed at `54faa72`, including the matrix/group pagination fixes. Pending at this checkpoint: code-quality review closure, actual plots and graphical exports (Task 3B), local evidence queries/reports and the complete final acceptance suite (Task 4). Passing these checks does not mean the entire delivery is complete.

## 2026-10-23 — Task 3B actual-browser checks

Task 3A quality review subsequently closed at `85b51f5`. Task 3B checks below
used the same fresh isolated Chrome context and actual saved service results,
not fabricated result payloads. All synthetic results are test evidence only.

- Inspected actual PCA, heatmap with R clustering trees, Welch volcano,
  observed-unit violin and OPLS predictive/orthogonal scores. HD PCA shows
  six distinct group markers, including in grayscale.
- SVG download contained the rendered 900 × 570 chart with explicit styles;
  the PNG file header independently confirmed 900 × 570 RGBA pixels. No
  automatic DPI or publication-certification claim is made.
- Downloaded full-result XLSX contained 40 sheets and no formula cells.
- Downloaded reproduction runner executed against the trusted local engine;
  reproduced OPLS numerical `data` was deeply equal to the saved result.
  Attempting to reuse the existing output file failed and left its hash intact.
- Actual CAS link for HD feature 75-31-0 opened the threshold-search route
  with that value present in its search input.
- Seven public reference links had new-tab/noopener/noreferrer/no-referrer
  behavior; no embedded external application or automatic upload was added.
- At 390 px viewport width, document width remained 390 px; wide charts
  were contained in their own horizontal scrolling region.
- Completed synthetic OPLS run `55275d015b4309fefec6e14af6580b49` through the
  UI with 200 requested permutations: 200 completed, zero failed; displayed
  all 200 finite values and the actual observed-statistic reference line.
  Engine-returned balanced accuracy was 0.875, Q2 was 0.6003317303286255,
  permutation p was 0.014925373134328358. These are synthetic test results,
  not findings about HD samples or model validity on experimental data.
- Switching the completed run to VIP, enabling labels and changing palette
  triggered zero POST requests to the analysis jobs endpoint. No page errors
  were observed in these checks.

The exported portable project with this run is retained outside Git at
`outputs/analysis-workbench-qa/synthetic-200-permutations-verified.json` in
the main project directory. Review closure and Task 4 evidence/report acceptance
remain separate gates; this checkpoint does not claim overall completion.

## 2026-10-23 — Task 4 independent acceptance checks

At implementation checkpoint `5b44082`, the coordinating agent independently
reran the fresh-Chrome acceptance script against the existing 5180/8890 services.
All 20 checks passed, with the optional real HD archive enabled and no uncaught
page errors. Evidence is retained outside Git in the main project's
`outputs/analysis-workbench-final-independent/acceptance.json` and its downloaded
raw results, projects, tables and report bundles. This run does not use the
user's browser profile and does not modify the HD source archive.

- Verified explicit measured-value confirmation and independent-unit gates,
  bulk metadata preview/apply, actual preprocessing, PCA, heatmap, comparisons,
  multigroup ANOVA/posthoc, correlation and distributions.
- PLS/OPLS used real nested-validation jobs with zero permutations for smoke
  coverage. A separate real 200-permutation job was cancelled. This cancellation
  check is not the completed 200-permutation run documented under Task 3B.
- Verified stale markers and frozen-run evidence after setting edits, IndexedDB
  reload/restore, portable imports and fresh-context isolation.
- Offline evidence queries/report exports remained usable with zero network
  requests during the checked query. Unsupported causal questions returned no
  local evidence. No model is configured or represented as tested.
- Independently downloaded the final comparison report: 16 files, all relative
  HTML attachment links resolved within its ZIP, correct bound run ID, factual
  overview, explicit synthetic warning, and no script element. The HTML was
  visually inspected in a separate test page. Full attachments remain separate
  from bounded previews.
- Earlier direct desktop/mobile checks verified bilingual evidence controls,
  actual citation excerpts and document width 390 px at viewport width 390 px.
- Independent full frontend run: 416 tests passed, zero failed or skipped.
  ESLint, Vite build and static-route generation passed. Because this host's
  fallback package-manager executable did not resolve local binaries, the
  equivalent local Node entry points were used directly. No dependency changed.
- Independent service/numeric checks: 21 Python tests and all eight R test
  entry points passed. Existing jsonlite build-version and RDKit/3Dmol/chunk
  warnings remain; these passes do not constitute a security certification.
- Original 5174 frontend / 8787 proxy and isolated 5180 frontend / 8890 service
  all returned HTTP 200. The removed PS1 startup script remains absent. The
  original main worktree changes, source workbooks and version were untouched.

Independent specification/quality review and final whole-implementation review
are separate completion gates. Any subsequent corrections require their own
regression checks before the plan is marked complete.

### Review corrections and final regression checkpoint

Specification review closed at `f07bd36`: the complete rendered text of every
report section, including the factual overview and long headings, is bounded;
full JSON attachments retain the original values. Quality review closed at
`0060968`: draft typing/citation interaction no longer repeats evidence scans
or serialization of unchanged large cell values; cloned package metadata no
longer freezes the caller's original object.

At `0060968`, independent frontend verification passed **418/418 tests**, with
zero skipped/failed tests, plus ESLint, Vite build and static-route generation.
The separate real-Chrome regression
`node --test scripts/e2e/verify_evidence_memo.test.mjs` passed **1/1** without
skipping: it counts actual query/serialization calls during draft input, source
inspection, query submission, paging and context changes. It is intentionally
outside the regular frontend glob because it needs an explicitly available
browser/Playwright runtime. Normal source test execution does not gain a new
hard-coded browser prerequisite.

### Final integration review closure

Fresh whole-implementation review identified and closed two additional issues:

- `b3ca973` accepts the broker's exact safe cleanup-warning object during
  restoration, while preserving legacy string logs and rejecting extra fields
  or unknown object codes. Actual fresh-Chrome IndexedDB save/reopen and portable
  roundtrip preserve the completed result and its warning unchanged.
- `8477997` rejects ambiguous/duplicate comparison display labels before any
  aggregation or statistical fit, for both explicit contrasts and omnibus
  posthoc pairs. This prevents distinct contrasts sharing a correction family
  or plot selector. Real R regressions prove normal p/BH results and source data
  are unchanged; English/Chinese messages explain how to correct the settings.

The independent integration reviewer closed both findings and reported no
remaining Critical/Important issue in the reviewed scope. At `8477997`, the
coordinating agent reran **420 frontend tests**, **21 Python tests**, **nine R
test entry points**, ESLint, production build/static routes, and both separate
real-Chrome regressions: all passed, with no skipped frontend/browser tests.
Known dependency/build warnings described above remain; no new security or
public-deployment certification is asserted.

Final complete fresh-browser acceptance at `8477997` also passed **20/20** checks,
including the real HD scenario and zero page errors. Its durable record and
downloads are in the main project's
`outputs/analysis-workbench-final-8477997/acceptance.json`. The isolated preview
and Python service remain available; main merge, GitHub publication, production
deployment and AI-model configuration are not part of this completed local
delivery. Source workbooks, the main worktree's unrelated changes and version
number remain unchanged.
