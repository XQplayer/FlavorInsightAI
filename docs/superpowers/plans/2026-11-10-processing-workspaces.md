# Processing Workspaces Implementation Plan

**Goal:** Replace the long data-processing page with four directly addressable workspaces and one persistent browser task controller.

**Architecture:** Keep `ShimadzuAnalysisPage` mounted while switching processing subroutes so the browser Worker and its object URLs survive. `PlatformApp` owns the URL/view/task-id selection; `PlatformShell` owns the secondary menu; the existing processing page owns files, Worker, cloud and task state. Split only presentation into create, monitor, results and task management panels, with no pipeline or archive schema changes.

**Tech stack:** React 19, Vite 8, browser Worker, IndexedDB, Supabase RLS, Node tests and Playwright.

**Spec:** User request in this chat, 2026-11-10. Base commit `0e0e929` on branch `codex/processing-workspaces` in the isolated worktree.

**Key mapping:** The Worker executes stage indexes 0–6. Display `00` is preflight plus Worker input configuration, outside the seven-step display denominator. Display `01–06` are Worker indexes 1–6. Display `07` is packaging, marked done only from a real complete job with a result archive. This preserves the requested labels and avoids inventing Worker steps. Existing Worker stage records remain available.

**Failure contract:** File extension/size and parameter preflight remain client-side; workbook structure and sample relationships are verified by Worker stage 0 before later work. They are not represented as passed before that Worker result exists. Proxy connection is shown as unchecked unless a real probe succeeds. Cloud history is available only under the current authenticated RLS scope. A local completed ZIP cannot be recreated after refresh; show an explicit unavailable state instead of a fake link.

## Tasks

- [x] Capture current desktop/mobile screenshots and baseline height; verify the clean isolated worktree.
- [x] Write route/model tests for direct subpaths, task-id preservation and 00/01–07 mapping.
- [x] Implement platform route state, sidebar submenu, breadcrumb and static deep-link output.
- [x] Write focused tests for file picker, preflight honesty, task filters and history result availability.
- [x] Refactor create workspace with file upload, compact parameters and three preflight groups.
- [x] Refactor monitor and results workspaces using actual job/stage/archive state; retain cancel/retry/continue/handoff/log/evidence.
- [x] Build task management search/filter/sort/pagination and admin-only tab backed by existing RLS-protected service.
- [x] Add browser E2E for navigation, refresh, real Worker success/failure and responsive layout.
- [x] Finish checks and local commit. The full platform E2E remains failed in the separate analysis route on a refused proxy connection; document this accurately.
