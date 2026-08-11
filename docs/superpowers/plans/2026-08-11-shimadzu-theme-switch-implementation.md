# Shimadzu Theme Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the hero workflow subtitle and add an accessible, persistent light/dark switch to the existing Shimadzu data control deck.

**Architecture:** Keep theme ownership inside `ShimadzuAnalysisPage`, restore and persist one string value through guarded `localStorage` access, and expose it on the page root with `data-theme`. Remap the existing semantic surface roles through a scoped light-theme CSS layer without touching analysis state or services.

**Tech Stack:** React state, Lucide icons, CSS custom properties, Node test runner, Vite.

---

### Task 1: Add failing theme contract tests

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add assertions that the former subtitle is absent, `shimadzu-analysis-theme` is read and written, the root has `data-theme={theme}`, the topbar exposes an accessible theme button, and light-theme CSS provides explicit canvas, surface, text, control, status and monitor roles.

- [ ] **Step 2: Run the focused test and verify RED**

Run `pnpm run test:shimadzu-browser` from `frontend` and expect the new theme assertions to fail because the control and light palette do not yet exist.

### Task 2: Implement persistent theme state and control

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`

- [ ] **Step 1: Add minimal state**

Import `Sun` and `Moon`, initialize `theme` from guarded local storage with `dark` fallback, and persist changes in an effect that ignores storage failures.

- [ ] **Step 2: Update the shell**

Add `data-theme={theme}` to the root, remove the subtitle element, and insert the theme button before “返回首页”. Use `aria-pressed`, an action-oriented label, and the matching icon.

### Task 3: Compose the light control deck

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`

- [ ] **Step 1: Add control styling**

Give the theme button the same control dimensions, focus treatment and responsive behavior as the home button, with a compact text label.

- [ ] **Step 2: Add scoped light-theme roles**

Under `.shimadzu-page[data-theme='light']`, define explicit canvas, surface, text, border, action and semantic values, then map upload, settings, workflow, readiness, task, account and history surfaces to those roles. Keep the monitor as a deep telemetry surface.

### Task 4: Verify the feature

**Files:**
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`
- Test: `scripts/e2e/verify_shimadzu_workbench.mjs`

- [ ] **Step 1: Run focused and full tests**

Run `pnpm run test:shimadzu-browser`, `pnpm run test:shimadzu`, and `pnpm run lint`; expect all tests and lint to pass.

- [ ] **Step 2: Build and inspect**

Run `pnpm run build`, execute the Shimadzu browser verification, inspect desktop and mobile screenshots in both themes, and run `git diff --check`.
