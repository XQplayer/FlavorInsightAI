# Phase 5 Git integration audit

Recorded 2026-11-11 (Asia/Singapore). Environment: local Git worktrees and GitHub read access. Baseline `origin/main=595fb931`; Release 1 candidate `a6f9cbc`; combined Release 2 candidate `421c770`. Read-only commands: `git log --oneline --decorate --graph --all -n 16`, `git merge-base origin/main <branch>`, `git diff --name-only origin/main...codex/browser-pca-release1`, `gh pr view 24/25/26/27`.

## Ancestry and release order

```text
595fb931 origin/main
├─ d65215b PR #25 Agents SAI → ebdfcf0 Browser PCA engine → 1ad5d1 Agent/PCA
│  → 7ff1bdd AI opt-out → f6923c4 Phase 4 → 421c770 PR #26 (Draft)
├─ f478290 PR #24 Hosted PCA (Draft; separate feature flag)
└─ 6859db7 Release 1 Browser PCA only → a6f9cbc PR #27 (Draft)
```

`7ff1bdd` contains the required PR #25 ancestry; `f6923c4` is a report commit. Release 1 was deliberately rebuilt from `origin/main`, so it contains the Browser PCA source and tests without PR #25 AI routes, Hosted PCA service code, or database migration. It preserves the existing R workbench behind the local-engine switch. No direct push to `main` occurred.

## File conflict and integration decision

| Area | PR #27 Browser PCA | PR #26 Agents SAI plus PCA | PR #24 Hosted PCA | Action |
|---|---|---|---|---|
| `DataAnalysisPage.jsx`, analysis components, lockfile | Yes | Yes | Likely | Merge Release 1 first; update Release 2 against resulting main; defer Hosted PCA. |
| AI Gateway, chat UI, chat SQL | No | Yes | Possible service overlap | Release 2 separately, after SQL/RLS and Render review. |
| Render deployment workflow | Existing main workflow only | Existing workflow, AI routes in source | Hosted service work | No automatic Render release from these Draft PRs. |

Rollback preparation: record pre-merge `main` SHA; revert the release commit through a new PR if needed. Do not erase browser IndexedDB or user chats. Current status: **integration candidates prepared; no production merge**.

