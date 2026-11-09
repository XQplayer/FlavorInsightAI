# Rollback plan

This initialization adds only `AGENTS.md`, `docs/ai-development/` and `.agents/skills/flavor-*` in branch `codex/ai-development` based on `5e2056e`. The original worktree's existing changes are outside this branch.

1. Inspect `git status` and the diff in the dedicated worktree. Save any subsequent work before reverting.
2. If this branch has not been merged, stop using it or remove only its dedicated worktree after verifying its absolute path and clean/archived state; leave other worktrees and original changes intact.
3. If merged, revert the initialization commit through a reviewed Git revert. Do not reset a shared branch or delete unrelated files. Skills are repository-scoped, so reverting their files disables their project guidance without touching user-level installs.
4. For future code changes, record base commit, changed files, migrations, fixtures, and deployment revision per task. Revert code separately from data migrations. Restore data only from verified backups and with explicit authorization.
5. Production rollback is a separate authorized operation; GitHub Pages and Render deploy behavior must be checked against the actual release and environment state before action.

Verification: compare the final diff to the allowed path list, confirm no raw-data/database/business-code files changed, and inspect the original worktree status for its pre-existing changes.
