# Phase 5 production release ledger

Recorded 2026-11-11 (Asia/Singapore). Production `main` before release: `595fb931`. Commands: `gh pr view 24/25/26/27`, `gh run view <id>`, local `pnpm test:analysis`, `pnpm lint`, `pnpm build`, Python unittest, browser synthetic E2E. Release 1 Draft [PR #27](https://github.com/XQplayer/FlavorInsightAI/pull/27) at `a6f9cbc`; Release 2 Draft [PR #26](https://github.com/XQplayer/FlavorInsightAI/pull/26) at `421c770`. Neither PR was merged. No production Pages deployment or Supabase migration occurred.

Local Release 1: 124 analysis tests and 33 platform tests passed; lint and production build passed; Chrome desktop/tablet/mobile synthetic E2E passed; `pnpm audit --prod --json` reported zero advisories. PR #27 and PR #26 each have all four remote jobs green at their code heads: Python, frontend tests/lint/build, Firefox and WebKit. The Actions runs are linked in [PHASE5_CROSS_BROWSER_REPORT.md](PHASE5_CROSS_BROWSER_REPORT.md). Release 2 full local regression: 458 frontend passes, one existing skip, and 190 Python passes. The existing local R workbench and seven-step GC-MS Worker were not changed by Release 1.

Mandatory release gates still open: independent preview hostname/storage isolation; deployed-host compatibility; Render owner/deployment audit; production AI SQL separate approval and real RLS/JWT probes; deployed Gateway; 10 real online turns; production Pages smoke after approved merge. A Draft PR and local HTTP 200 are not a production release.

**Status: PHASE 5 BLOCKED. Release 1 and Release 2 are not live.** Next permitted action is to resolve test failures and preview isolation, then review both PRs. Merge and release only after the relevant gates are documented and passed.

