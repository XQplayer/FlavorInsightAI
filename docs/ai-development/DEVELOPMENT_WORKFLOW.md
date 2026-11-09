# Development workflow

1. **Intake:** read `AGENTS.md`, relevant README/design docs, current branch/status, affected code and tests. Identify raw-data, auth, deployment and scientific boundaries.
2. **Contract:** state inputs, outputs, dependencies, errors and acceptance criteria. For scientific computation, identify source rows, sample/group semantics, units, exclusion rules and approved reference values. Resolve scientific-rule ambiguity before changing formulas.
3. **Route:** apply `SKILL_ROUTING.md`. Use Superpowers for process and only relevant specialist skills. Full work uses an isolated worktree from the intended baseline; keep existing uncommitted changes intact.
4. **Baseline:** capture current behavior and hashes. Reference-value fixtures must be independent of the implementation; if truth is uncertain, call it a behavior baseline. A failed existing check is recorded before edits.
5. **Implement:** keep diffs small and reuse modules. For bugs, reproduce and locate the cause. Preserve original data and transformation lineage.
6. **Verify:** run the affected checks in `QUALITY_GATES.md`, inspect outputs, and record exact commands and results. Browser and manual checks are distinct from unit tests.
7. **Review:** inspect diff against the contract and scientific boundaries. Dispatch an independent reviewer for full work when available, or record a serial self-review.
8. **Deliver:** list changed files, test evidence, open issues and rollback steps. Do not merge, deploy, mutate production data, or change secrets without authorization.

## Pilot, 2026-11-09

Pilot task: classify a harmless hypothetical navigation-label change; no application code or research data was edited. Existing baseline: the repository has `test:platform` and PR lint/build gates, but no project-level routing contract or scientific skill selection. New route: **light**, inspect `PlatformShell.jsx` and route tests, edit only the label in a future task, run `pnpm run test:platform` and responsive/keyboard checks if UI changes. No scientific skill, worktree mandate or GSAP skill is selected for the hypothetical edit.

Observed control check: `node --test frontend/src/platformRoutes.test.mjs` passed 7/7 in the original worktree and 7/7 in the isolated worktree. The application-code diff is zero in this pilot, and no regression error was observed by this focused test. Before/after *process artifacts* can be compared (no routing document versus this decision and evidence checklist); actual development token cost cannot be measured reliably from this hypothetical edit. This pilot validates routing design, not implementation productivity. A later real low-risk UI task should record tokens from the tool/session meter if available and compare actual test outcomes and diff size; do not invent a baseline.
