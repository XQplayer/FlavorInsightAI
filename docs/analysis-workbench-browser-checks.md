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
