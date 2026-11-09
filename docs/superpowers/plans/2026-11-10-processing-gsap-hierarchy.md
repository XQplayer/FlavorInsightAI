# Processing workbench hierarchy and motion plan

**Route / level:** Frontend / UI / GSAP, L3. Base `5ae6952`; isolated branch `codex/processing-gsap-hierarchy`. No Worker, scientific formula, QC, raw data, result schema or deployment changes.

**Evidence:** Actual baseline Playwright captures under ignored `_local/before-{desktop,tablet,mobile,dark}.png`. First file input starts at y=1617/2031/2482 px for desktop 1440×900, tablet 768×1024, mobile 390×844. No horizontal overflow or page errors at baseline.

**Design contract:** Keep three stages and every existing control, status, download, warning and route. Make the header and capability summary compact; keep advanced parameters available in a collapsed, keyboard-operable panel. Present the two file slots side by side on desktop, stack at mobile, then show a concise preflight and prominent current task progress. Logs and history remain accessible through separate disclosures. Animate presentation only; state and progress continue to come from the Worker/task store. Preserve bilingual light/dark presentation and reduced-motion behavior.

## Batch 1 — first viewport and parameters

- [x] Add failing assertions for compact capability summary, collapsed advanced controls and upload visibility in the first viewport.
- [x] Reorder configuration markup and compact the header/navigation/configuration in CSS.
- [x] Run focused layout unit (39/39) and processing browser tests (pass across tested viewports); commit.

## Batch 2 — import and monitoring

- [ ] Add failing assertions for desktop two-column uploads, readable 00–07 flow, current-task-first monitor and on-demand logs/history.
- [ ] Reorganize UI markup/CSS without changing task state or Worker computation.
- [ ] Run focused tests and processing browser regression; commit.

## Batch 3 — GSAP and responsive completion

- [ ] Add animation lifecycle/reduced-motion tests. Replace broad ScrollTrigger reveals with scoped entry timeline, panel/import/preflight/progress/result microinteractions.
- [ ] Verify keyboard access, cleanup, no repeated entry playback, real status ownership, bundle, theme and viewport screenshots.
- [ ] Run full affected tests, build/lint, independent code review, diff/data check; commit and report rollback.
