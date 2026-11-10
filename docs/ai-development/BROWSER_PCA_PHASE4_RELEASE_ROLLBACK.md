# Browser PCA Phase 4 release and rollback gate

**Current state:** formal release **HOLD**. `origin/main=595fb931fd2a2972bbac1132ddd3c48211ca5000` at audit; Browser source changes are local to `codex/browser-pca`. The separate synthetic-only Pages preview is live at artifact `4518968513c3ef16a76a7502537e00b9e2a2db43`. No formal branch merge, Render config edit, production deploy, database migration, paid resource creation or real research upload occurred.

## Human acceptance checklist before any formal merge

1. Identify the Mermaid Studio branch/repository and decide its separate release order. Resolve PR #25 first, and keep PR #24 Hosted PCA flags off with migration deferred. Review the six post-fork overlap paths in `BROWSER_PCA_PHASE4_INTEGRATION_SECURITY_AUDIT.md`.
2. In the Render Dashboard, independently verify service ownership, linked repository/branch, live deploy SHA, auto-deploy setting, current health, a previous successful deploy ID, and the variable-name checklist. Review the exact config changes and private rollback snapshot before applying them. Do not display values in CI or reports.
3. Establish a distinct preview browser origin and staging-only Auth/API configuration. Test that neither the preview app nor its Gateway can access a production session or resource. Until then, use synthetic data only.
4. Run Firefox and WebKit E2E and authenticate two synthetic ordinary users against the actual online Gateway. Require an explicit user confirmation before Worker execution and before bounded explanation sharing. Validate invalid plan/result, cancel, timeout, network loss, rate limit, same-user restore and cross-user denial. The model must not invent PCA numbers; the browser result remains usable if AI fails.
5. Re-run full frontend/Python, GC-MS Worker, scientific reference, lint, build, dependency audit and static secret scan on the exact release candidate. Require formal PR CI and manual review of the resulting SHA. Set and enforce an operational spending limit because process-local counters can reset.

**Only after the above passes** should a reviewer explicitly authorize merge/deployment. `main` triggers formal GitHub Pages; `render.yaml` declares auto-deploy, and [Render documents](https://render.com/docs/deploys) that linked-branch commits can trigger deployment. This gate does not itself grant permission.

## Rollback preparation

- **Before formal merge:** revert the local Browser-specific commits (latest product change `7ff1bdd`, Phase 3 integration `1ad5d1d`) in a review branch if necessary; preserve earlier PCA implementation/fixtures unless separately reviewed. Disable the separate preview Pages site or revert its `4518968` artifact if its static behavior is wrong.
- **After a separately authorized formal release:** record the prior formal Pages build and Render deploy IDs first. Revert the release commit on `main` through an approved PR to rebuild Pages; use Render Dashboard's last successful deploy for the API, then re-check health, CORS, Auth and disabled private tools. Render's [rollback guide](https://render.com/docs/rollbacks) says Dashboard rollback disables auto-deploy. Check that state and any environment-variable effects before resuming delivery.
- **Data:** Browser PCA has no production database migration and never automatically uploads the raw matrix. IndexedDB is local browser state; a rollback must not erase user browser data. Optional Supabase save remains design-only. Hosted PCA has a separate migration/backup/rollback process and remains disabled.

The release decision remains a human gate because the online Gateway, separate browser origin, Firefox and WebKit checks are outstanding.
