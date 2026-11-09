# PR CI integration report

Date: 2026-11-09. Only `.github/workflows/pr-quality-checks.yml` was extended; `deploy-pages.yml`, `deploy-render-api.yml` and `render.yaml` were not changed. No workflow was triggered remotely in this session.

## Added checks

- New parallel `python-api` job: `python3 -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -v`. The two suites use Python standard library and localhost test servers; no API key or private workbook is required. Local execution passed twice after cache isolation. Public Runner outcome is **unverified until a PR run**.
- Existing frontend `verify` job already runs selected Node tests, lint and production build. Adding `taskFeedback.test.mjs` to `test:shimadzu-browser` makes the pilot's unit check part of that fast job.
- Added `pnpm audit --prod` with `continue-on-error: true`: the advisory scan is visible but currently nonblocking because the lockfile already reports 9 vulnerabilities. Treat the scan step's failure as a finding, not a passing security gate. Review and remediate separately before making it blocking.
- The focused Playwright pilot script is available as `pnpm run test:e2e:processing-feedback` for local or a later slow CI job. It uses a browser runtime and synthetic public templates; it is not included in fast PR CI until runner browser installation and stable execution are established.

## Local checks and constraints

The YAML parsed with isolated `PyYAML 6.0.3`; jobs `python-api` and `verify` were present. Local Python integration, selected frontend tests, lint and build passed. The R statistics engine uses a project-local R library and remains a documented local gate. CI needs no model API key, production database connection or local Windows path. The current CI build still receives existing configured frontend variables/secrets; this change adds none. GitHub Pages and Render deployment triggers were left intact.

Fast PR checks are Node/Python unit, lint and build; browser E2E and local R/reference-data checks remain slow or environment-specific. A future PR should inspect actual Actions job results, then consider a dedicated slow browser job and a blocking dependency gate after the known advisories are triaged.
