# Shimadzu Data Control Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Shimadzu hybrid research workbench presentation with the approved dark data-control-deck UI while preserving every analysis, account, task, template, Worker, API, Supabase, file-contract, and output behavior.

**Architecture:** Keep the current React state and scientific workflow in `ShimadzuAnalysisPage.jsx`; change only the page shell, information order, CSS presentation, and UI-facing tests. The Shimadzu route owns its own minimal top bar, so `App.jsx` should remain unchanged unless live inspection proves a second global header is rendered. Existing Worker and cloud modules remain untouched.

**Tech Stack:** React 19, CSS, GSAP/useGSAP, Lucide React, Node test runner, Playwright E2E, Vite, existing Shimadzu Web Worker pipeline.

---

## File map

- Modify `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`: minimal top bar, control-deck heading, in-workspace account/task access, existing functional modules reordered without changing handlers.
- Modify `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`: dark control-deck tokens, panel hierarchy, state styling, responsive rules, focus and reduced-motion behavior.
- Modify `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`: static contract tests for the approved shell, preserved features, type floor, and responsive behavior.
- Modify `scripts/e2e/verify_shimadzu_workbench.mjs`: runtime assertions for the new title, single home exit, retained login/templates/tasks, no overflow, and task completion.
- Do not modify `frontend/src/workers/`, `frontend/src/shimadzu-core/`, `frontend/src/lib/shimadzuCloud.js`, `frontend/src/lib/shimadzuWorkerClient.js`, or workbook output code.

### Task 1: Load the approved design context and lock the new page contract

**Files:**
- Read: `docs/superpowers/specs/2026-08-11-shimadzu-data-control-deck-design.md`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`
- Test: `scripts/e2e/verify_shimadzu_workbench.mjs`

- [ ] **Step 1: Load the Impeccable project context once**

Run from the repository root:

```powershell
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'E:\codex\codex-personal-skills\impeccable\scripts\context.mjs' --target 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx'
```

Expected: context output identifies the existing Shimadzu surface and any durable design files. Report stale context but do not repair unrelated design artifacts.

- [ ] **Step 2: Read the redesign quality references before editing**

Read completely:

```powershell
Get-Content -LiteralPath 'E:\codex\codex-personal-skills\impeccable\reference\new-work.md' -Encoding utf8
Get-Content -LiteralPath 'E:\codex\codex-personal-skills\impeccable\reference\craft-floor.md' -Encoding utf8
```

Expected: use Operate-mode rules, preserve product truth, avoid decorative noise, and keep interaction feedback native and accessible.

- [ ] **Step 3: Replace obsolete hybrid-shell assertions with failing data-control-deck assertions**

In `ShimadzuAnalysisPage.layout.test.mjs`, replace the title/header and hybrid-contract tests with:

```js
test('uses the approved Shimadzu data control deck shell', () => {
  assert.match(source, /data-ui-revision="data-control-deck-v4"/)
  assert.match(source, /className="shimadzu-deck-topbar"/)
  assert.match(source, /className="shimadzu-home-link"/)
  assert.match(source, />返回首页</)
  assert.match(source, /<h1>岛津风味数据分析控制舱<\/h1>/)
  assert.doesNotMatch(source, /className="science-nav search-science-nav"/)
  assert.doesNotMatch(source, /className="science-nav-links"/)
  assert.doesNotMatch(source, /className="science-language"/)
})

test('moves account and task access into the control deck workspace', () => {
  assert.match(source, /className="shimadzu-deck-utility"/)
  assert.match(source, /href="#account-panel"/)
  assert.match(source, /href="#task-workbench"/)
  assert.match(source, /<AccountPanel/)
  assert.match(source, /<HistoryPanel/)
})
```

Keep the existing tests for Worker restoration, CV controls, templates, error context, task permissions, ARIA feedback, and reduced motion.

- [ ] **Step 4: Update the E2E selectors before implementation**

In `verify_shimadzu_workbench.mjs`, change the initial and mobile headings to:

```js
await page.getByRole('heading', { name: '岛津风味数据分析控制舱' }).waitFor()
```

Replace the task-link-only assertion with:

```js
await page.getByRole('button', { name: '返回首页' }).waitFor()
assert.equal(await page.locator('.science-nav-links').count(), 0)
await page.getByRole('link', { name: /任务台/ }).waitFor()
await page.getByRole('link', { name: /账号|本地模式|已登录/ }).waitFor()
```

After clicking into the Shimadzu route from the homepage, assert the same new heading.

- [ ] **Step 5: Run the focused layout test and confirm RED**

Run:

```powershell
Set-Location 'E:\codex\Projects\FlavorThresholdDB\frontend'
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test 'src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs'
```

Expected: FAIL because `data-control-deck-v4`, `shimadzu-deck-topbar`, the new heading, and minimal navigation do not yet exist.

### Task 2: Implement the minimal top bar and control-deck identity

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx:190-193`
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx:893-926`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`

- [ ] **Step 1: Convert the task shortcut into an in-workspace utility link**

Keep `TaskDeskEntry` but use a neutral utility label and existing task anchor:

```jsx
function TaskDeskEntry({ count }) {
  return <a className="shimadzu-deck-utility-link" href="#task-workbench"><History aria-hidden="true" /><span>任务台</span>{count > 0 && <b>{count}</b>}</a>
}
```

- [ ] **Step 2: Replace the old header with the approved minimal shell**

Change the root revision and header block to:

```jsx
<div ref={pageRef} className="shimadzu-page" data-ui-revision="data-control-deck-v4" data-motion={reducedMotion ? 'reduced' : 'full'}>
  <header className="shimadzu-header">
    <div className="shimadzu-deck-topbar">
      <div className="shimadzu-deck-brand" aria-label="HXQLab 岛津分析">
        <span><FlaskConical aria-hidden="true" /></span>
        <strong>HXQLab · SHIMADZU</strong>
      </div>
      <button type="button" className="shimadzu-home-link" onClick={onHome}>
        <ChevronRight aria-hidden="true" />返回首页
      </button>
    </div>
    <div className="shimadzu-hero">
      <div className="shimadzu-hero-copy shimadzu-hero-animate">
        <span className="shimadzu-product-kicker">GC–MS FLAVOR ANALYSIS / BROWSER WORKER</span>
        <h1>岛津风味数据分析控制舱</h1>
        <p className="shimadzu-hero-subtitle">原始峰表 → 化合物筛查 → 平行补建 → 半定量 → 统计与作图矩阵</p>
      </div>
      <div className="shimadzu-deck-utility shimadzu-hero-animate">
        <div className="shimadzu-hero-status">
          <span className={engine.state}>{engine.state === 'ready' ? <ShieldCheck /> : engine.state === 'checking' ? <Loader2 className="spin" /> : <AlertCircle />}</span>
          <div><small>ANALYSIS ENGINE</small><strong>{engine.title}</strong><p>{engine.detail}</p></div>
        </div>
        <div className="shimadzu-deck-links">
          <TaskDeskEntry count={history.length} />
          <a className="shimadzu-deck-utility-link" href="#account-panel"><UserRound aria-hidden="true" /><span>{!cloud.configured ? '本地模式' : session ? '已登录' : '账号登录'}</span></a>
        </div>
      </div>
    </div>
  </header>
```

Use the existing `onHome`, `engine`, `history`, `cloud`, and `session` values. Remove the old threshold navigation, language buttons, top task shortcut, and top account shortcut from this route only.

- [ ] **Step 3: Run the focused layout test and confirm GREEN for the shell**

Run the Task 1 test command.

Expected: the new shell tests pass; any remaining failures must concern CSS contract work scheduled in later tasks.

- [ ] **Step 4: Commit the shell change**

```powershell
git add -- 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx' 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs' 'scripts/e2e/verify_shimadzu_workbench.mjs'
git commit -m 'feat: add Shimadzu data control deck shell'
```

### Task 3: Build the dark control-deck visual system and idle layout

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css:1-285`
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css:413-645`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`

- [ ] **Step 1: Add a failing visual-contract test**

Append:

```js
test('defines the dark control deck visual system and two desktop work zones', () => {
  assert.match(styles, /--sz-deck-bg:\s*#090f1a/)
  assert.match(styles, /--sz-deck-panel:\s*#111a29/)
  assert.match(styles, /\.shimadzu-deck-topbar/)
  assert.match(styles, /\.shimadzu-deck-utility-link/)
  assert.match(styles, /\.shimadzu-setup \{[\s\S]*grid-template-columns: minmax\(0, 1\.42fr\) minmax\(330px, \.72fr\)/)
  assert.match(styles, /\.shimadzu-overview-grid \{[\s\S]*grid-template-columns: minmax\(0, 1\.18fr\) minmax\(360px, \.82fr\)/)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Expected: FAIL because the deck tokens and selectors are missing.

- [ ] **Step 3: Add the approved deck tokens and page background**

At the top-level `.shimadzu-page` token block, add:

```css
--sz-deck-bg: #090f1a;
--sz-deck-panel: #111a29;
--sz-deck-panel-2: #0d1624;
--sz-deck-line: #26354c;
--sz-deck-text: #edf4ff;
--sz-deck-muted: #8fa0b8;
--sz-deck-blue: #3f78ff;
--sz-deck-cyan: #2ed9d0;
--sz-deck-green: #2fc789;
--sz-deck-red: #ff6b72;
color: var(--sz-deck-text);
background: radial-gradient(circle at 78% 0%, rgb(56 100 200 / .12), transparent 28%), var(--sz-deck-bg);
```

- [ ] **Step 4: Implement the minimal top bar and utility styling**

Add focused rules:

```css
.shimadzu-deck-topbar { width: min(100% - 40px, 1560px); min-height: 62px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.shimadzu-deck-brand { display: flex; align-items: center; gap: 12px; color: var(--sz-deck-text); letter-spacing: .04em; }
.shimadzu-deck-brand > span { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid #405777; border-radius: 8px; color: var(--sz-deck-cyan); background: #101b2a; }
.shimadzu-home-link, .shimadzu-deck-utility-link { min-height: 40px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #354865; border-radius: 8px; color: #dce8fa; background: #111b2b; }
.shimadzu-home-link { padding: 0 14px; }
.shimadzu-home-link svg { width: 16px; transform: rotate(180deg); }
.shimadzu-deck-utility { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: stretch; }
.shimadzu-deck-links { display: grid; grid-template-columns: repeat(2, auto); gap: 8px; }
.shimadzu-deck-utility-link { padding: 0 12px; text-decoration: none; }
```

- [ ] **Step 5: Restyle the idle surfaces without changing their markup contract**

Use the existing `shimadzu-input-region`, `shimadzu-settings`, `shimadzu-file-picker`, `shimadzu-template-link`, `shimadzu-run-button`, `shimadzu-workflow-dock`, `shimadzu-readiness-strip`, `shimadzu-monitor`, and `shimadzu-history` classes. Apply dark panels, #26354c borders, compact 12–16px internal spacing, blue primary actions, visible keyboard focus, and no decorative gradients beyond the single page-level radial wash.

The desktop layout must resolve to:

```css
@media (min-width: 1101px) {
  .shimadzu-setup { grid-template-columns: minmax(0, 1.42fr) minmax(330px, .72fr); grid-template-areas: "input settings"; gap: 14px; }
  .shimadzu-overview-grid { grid-template-columns: minmax(0, 1.18fr) minmax(360px, .82fr); gap: 14px; }
}
```

- [ ] **Step 6: Run the focused test and confirm GREEN**

Run the Task 1 test command.

Expected: all layout tests pass, with no font-size values below 11px.

- [ ] **Step 7: Commit the idle control-deck visual system**

```powershell
git add -- 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.css' 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs'
git commit -m 'style: apply Shimadzu data control deck theme'
```

### Task 4: Align running, review, failure, and completion states

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css:646-798`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`

- [ ] **Step 1: Add failing state-style assertions**

Append:

```js
test('defines explicit control deck treatments for every task terminal state', () => {
  assert.match(styles, /\.shimadzu-job-workspace\.state-running/)
  assert.match(styles, /\.shimadzu-job-workspace\.state-waiting_review/)
  assert.match(styles, /\.shimadzu-job-workspace\.state-failed/)
  assert.match(styles, /\.shimadzu-job-workspace\.state-complete/)
  assert.match(styles, /\.shimadzu-inline-error/)
  assert.match(source, /下载已完成步骤与错误证据/)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Expected: FAIL because the four explicit workspace selectors are absent.

- [ ] **Step 3: Add state accents using existing status data**

Implement:

```css
.shimadzu-job-workspace.state-running { --sz-state-accent: var(--sz-deck-blue); }
.shimadzu-job-workspace.state-waiting_review { --sz-state-accent: #f2b84b; }
.shimadzu-job-workspace.state-failed { --sz-state-accent: var(--sz-deck-red); }
.shimadzu-job-workspace.state-complete { --sz-state-accent: var(--sz-deck-green); }
.shimadzu-job-bar { border-color: color-mix(in srgb, var(--sz-state-accent, var(--sz-deck-line)) 48%, var(--sz-deck-line)); }
.shimadzu-inline-error { border: 1px solid rgb(255 107 114 / .45); color: #ffd4d7; background: rgb(91 27 38 / .42); }
```

Preserve all existing error code, message, stage, issue list, retry, partial-download, cancel, review, and result-download elements.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Expected: all layout tests pass.

- [ ] **Step 5: Commit the task-state treatment**

```powershell
git add -- 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.css' 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs'
git commit -m 'style: clarify Shimadzu task states'
```

### Task 5: Harden responsive behavior, accessibility, and live E2E expectations

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css:799-end`
- Modify: `scripts/e2e/verify_shimadzu_workbench.mjs`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`

- [ ] **Step 1: Add a failing responsive-shell assertion**

Append:

```js
test('keeps the minimal deck shell and work zones usable at tablet and mobile widths', () => {
  assert.match(styles, /@media \(max-width: 1024px\)/)
  assert.match(styles, /@media \(max-width: 768px\)/)
  assert.match(styles, /@media \(max-width: 420px\)/)
  assert.match(styles, /\.shimadzu-deck-topbar \{[\s\S]*width: calc\(100% - 24px\)/)
  assert.match(styles, /\.shimadzu-setup \{[\s\S]*grid-template-columns: 1fr/)
  assert.match(styles, /\.shimadzu-flow-track \{[\s\S]*overflow-x: auto/)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Expected: FAIL until the 768px and 420px deck-specific rules are present.

- [ ] **Step 3: Implement responsive rules**

Add:

```css
@media (max-width: 1024px) {
  .shimadzu-setup, .shimadzu-overview-grid { grid-template-columns: 1fr; grid-template-areas: "input" "settings"; }
  .shimadzu-deck-utility { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .shimadzu-deck-topbar { width: calc(100% - 24px); min-height: 58px; }
  .shimadzu-deck-brand strong { font-size: 12px; }
  .shimadzu-hero { grid-template-columns: 1fr; }
  .shimadzu-deck-links { grid-template-columns: 1fr 1fr; }
  .shimadzu-flow-track { overflow-x: auto; overscroll-behavior-inline: contain; }
}

@media (max-width: 420px) {
  .shimadzu-deck-brand strong { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .shimadzu-home-link { min-height: 44px; padding: 0 10px; }
  .shimadzu-upload-grid, .shimadzu-settings, .shimadzu-overview-grid { min-width: 0; }
}
```

Retain the existing `@media (prefers-reduced-motion: reduce)` block and focus-visible rules.

- [ ] **Step 4: Run layout and browser unit tests**

```powershell
Set-Location 'E:\codex\Projects\FlavorThresholdDB\frontend'
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run test:shimadzu-browser
```

Expected: all Shimadzu browser tests pass.

- [ ] **Step 5: Run the Shimadzu E2E and inspect both screenshots once**

```powershell
Set-Location 'E:\codex\Projects\FlavorThresholdDB'
$env:SHIMADZU_E2E_URL='http://127.0.0.1:5174/FlavorThresholdDB'
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts/e2e/verify_shimadzu_workbench.mjs'
```

Expected: JSON reports `status: PASS`, `screenshots: 2`, and `consoleErrors: 0`. Inspect `_local/verification/screenshots/shimadzu-workbench-desktop.png` and `shimadzu-workbench-mobile.png` together. Make one batched correction if the screenshots show clipping, weak contrast, excess whitespace, or missing controls; add or adjust a failing layout assertion before correcting behavior.

- [ ] **Step 6: Commit responsive and E2E changes**

```powershell
git add -- 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.css' 'frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs' 'scripts/e2e/verify_shimadzu_workbench.mjs'
git commit -m 'test: verify Shimadzu control deck responsiveness'
```

### Task 6: Run the complete verification gate

**Files:**
- Verify: `frontend/`
- Verify: `scripts/e2e/verify_shimadzu_workbench.mjs`

- [ ] **Step 1: Run lint**

```powershell
Set-Location 'E:\codex\Projects\FlavorThresholdDB\frontend'
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run lint
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 2: Run Shimadzu API tests**

```powershell
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run test:shimadzu
```

Expected: all tests pass.

- [ ] **Step 3: Run Shimadzu browser and core tests**

```powershell
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run test:shimadzu-browser
```

Expected: all tests pass with zero failures.

- [ ] **Step 4: Run production build**

```powershell
& 'C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run build
```

Expected: Vite exits 0; existing RDKit/3Dmol/chunk-size warnings may remain but no new error is accepted.

- [ ] **Step 5: Run the final E2E against the local 5174 site**

Use the Task 5 E2E command.

Expected: `PASS`, two screenshots, zero console errors, completed seven-stage fixture run, result blob URL, reset-to-idle success, mobile no-overflow, reduced-motion success, and homepage-to-Shimadzu navigation success.

- [ ] **Step 6: Verify change scope**

```powershell
Set-Location 'E:\codex\Projects\FlavorThresholdDB'
git status --short
git diff --check
git diff --stat
```

Expected: only the planned Shimadzu JSX, CSS, layout test, and E2E files differ from the pre-existing user-owned changes; no Worker, core algorithm, cloud contract, user workbook, cache, or output file is modified by this implementation.
