# Version Rebaseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish FlavorInsight AI 1.1.0 and consolidate older software updates into reversible 1.0.0 history.

**Architecture:** Preserve original releases/tags and data resource in an immutable backup, freeze a version-consistent 1.0.0 snapshot, then update current metadata/docs/display to 1.1.0. New namespace tags avoid legacy collisions; draft old software releases only after new replacements are verified.

**Tech Stack:** Existing React/Vite, Python, Git/GitHub CLI, GitHub Pages/Render workflows; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-version-rebaseline-design.md`

## Global Constraints

- User authorised option A including repository/display updates and reversible release drafting. Never delete tags/releases, force push, change source data, formulas, credentials or permissions.
- New tags `flavorinsight-v1.0.0` and `flavorinsight-v1.1.0`; current version 1.1.0, archive snapshot 1.0.0. Root VERSION canonical; other independent version schemas unchanged.
- GNPS release and 120729288-byte dataset remain public, checksum unchanged. Original tagged Git objects remain immutable.
- Main checkout has unrelated changes: execute in existing isolated worktree on `codex/release-version-rebaseline`, base fc0f678.

## Review Focus

- Existing legacy v1.1.0 must never be reused: verify new namespace and unchanged old refs.
- Stale deployment API_VERSION must not advertise an old shipped product: health test forces old env and checks canonical source version.
- Historical claims and raw release bodies must remain available: verify backup IDs/bodies and legacy docs hashes, not rewritten dates.
- Dataset release must not be drafted or its assets moved: allowlist plan tests and final asset equality.
- Failure halfway through external operations must leave old releases visible until replacements are ready: tests reject changed snapshots and remote sequence validates before drafting.

### Task 1: Backup and freeze archive 1.0.0

**Files:** Create docs/history/releases backup JSON, raw legacy README/CHANGELOG and mapping; root VERSION; focused release-metadata tests and small pure release-plan helper; update frontend/package.json, metadata display contract test, fema_proxy_server.py build label, Render/default version metadata and docs.

**Interfaces:** Canonical VERSION text; release snapshot includes IDs/tags/flags/bodies/assets and old tag object/commit SHAs. Pure build plan accepts snapshot/current releases and returns only allowlisted draft updates while refusing missing/changed protected data or conflicting new tags. Health keeps api_version field and reads shipped VERSION.

- [ ] Capture exact public release/tag/asset state and baseline tests; no remote mutations.
- [ ] Add failing version consistency/health-source-priority/release-plan safety tests; observe expected failures.
- [ ] Implement minimal metadata/safety changes and archive documentation, preserving originals byte-for-byte. Freeze 1.0.0 commit only after affected tests/build pass; record exact SHA for later tag.

### Task 2: Current 1.1.0 and coherent repository/display

**Files:** VERSION, frontend/package.json, Render/workflow defaults, README.md, CHANGELOG.md, PROJECT_HISTORY.md, docs/DEPLOYMENT.md, docs/analysis-workbench.md as needed for current status, home footer and tests, release notes under docs/releases, archive index/map.

**Interfaces:** All current labels agree on 1.1.0; archive links use 1.0.0; original historical docs link into preserved backups. Backend/Pages source version agreement; no protocol or dataset schema changes.

- [ ] Add failing current-version/home-footer tests; update metadata and bilingual release links without redesigning layout.
- [ ] Write accurate current/archive release notes and mapping, retaining scientific and local-service boundaries.
- [ ] Run full frontend, Python metadata/API, lint/build and desktop/mobile checks. Commit and obtain independent read-only final review; fix Important defects by RED→GREEN.

### Task 3: Publish and archive reversible legacy releases

**Files:** Release verification report/local receipts; no business-code changes.

**Interfaces:** Inputs are reviewed current commit, frozen 1.0.0 commit and snapshot allowlist. Outputs two public software releases, unchanged public data asset, drafted five legacy software releases and verified deployments.

- [ ] Push PR; require matching CI, merge and verify Pages and Render live version/commit. Stop on failure before hiding legacy releases.
- [ ] Create only absent namespaced tags at exact checked SHAs, publish archive/current release notes and backup attachments, set current Latest explicitly.
- [ ] Re-audit snapshot immediately before mutations, then draft only allowlisted software release IDs and clarify data-resource title without moving its asset.
- [ ] Read back public/draft release lists, assets/hashes and old refs. Record exact workflow/merge/tag IDs and rollback commands; keep evidence/worktree.

## Execution

User approved A and requested repository/display reorganisation; continue previously selected native execution. Decisions left to builder are non-destructive file layout/wording and exact focused tests. No further version policy selection is needed. Original API, schema and scientific algorithms remain unchanged apart from truthful build-version metadata.
