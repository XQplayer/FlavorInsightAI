# Production dependency advisory audit — 2026-11-09

**Result:** 9 advisories before scoped patches (5 high, 3 moderate, 1 low); 2 high after patches. `pnpm audit --prod` still exits 1. The security gate is **not passed**.

Reproduce from `frontend/` with `pnpm install --frozen-lockfile; pnpm audit --prod --json`. Raw snapshots are `dependency-audit-2026-11-09.json`, `dependency-audit-after-patch-2026-11-09.json`, and `dependency-audit-final-2026-11-09.json` in this directory. `pnpm why vite nanoid source-map-js xlsx --prod` established paths. `pnpm view vite@8.1.6 version`, `nanoid@3.3.18`, and `source-map-js@1.2.2` confirmed available patch versions. The patch commands were `pnpm update vite@8.1.6` and `pnpm update nanoid source-map-js`; the latter updated only indirect dependencies within declared ranges. An attempted `pnpm update ... --save-dev` failed because pnpm 11 does not support that flag; an attempted version-pinned transitive update failed with `ERR_PNPM_UPDATE_VERSION_ON_INDIRECT_DEP`, so neither changed dependencies.

## Complete advisory ledger

| Audit ID / advisory | Package installed → current | Severity | Fixed range in audit | Dependency path | Reachability and disposition |
| --- | --- | --- | --- | --- | --- |
| 1108110 / [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) | `xlsx` 0.18.5 → 0.18.5 | High | None in registry report; vulnerable `<0.19.3` | direct `frontend > xlsx` | **尚待处理**. Browser workbook import in `frontend/src/analysis/imports.mjs` and Shimadzu workbook worker make untrusted file parsing reachable. |
| 1108111 / [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | `xlsx` 0.18.5 → 0.18.5 | High | None in registry report; vulnerable `<0.20.2` | direct `frontend > xlsx` | **尚待处理**. Same reachable parser and exporter; no blind package replacement without workbook parity checks. |
| 1139427 / [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `nanoid` 3.3.16 → 3.3.20 | High | `>=3.3.18` | `@tailwindcss/vite > vite > postcss > nanoid` | **已修复并验证** in lockfile and zero matching final advisories. Build/dev tool path, not an application runtime import shown by `pnpm why`; CI/build inputs remain relevant. |
| 1241209 / [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `source-map-js` 1.2.1 → 1.2.2 | High | `>=1.2.2` | `@tailwindcss/vite > @tailwindcss/node`, and `> vite > postcss` | **已修复并验证**. Build/CSS processing path; not proven to ship as browser runtime code. |
| 1242624 / [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | `vite` 8.1.5 → 8.1.6 | Moderate | `>=8.1.6` | `@tailwindcss/vite > vite`; also direct dev dependency | **已修复并验证**. Dev server/build tooling exposure. |
| 1242653 / [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | `vite` 8.1.5 → 8.1.6 | Moderate | `>=8.1.6` | same | **已修复并验证**. Same tooling path. |
| 1242660 / [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `vite` 8.1.5 → 8.1.6 | High | `>=8.1.6` | same | **已修复并验证**. Same tooling path. |
| 1242726 / [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | `vite` 8.1.5 → 8.1.6 | Low | `>=8.1.6` | same | **已修复并验证**. Same tooling path. |
| 1242732 / [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | `vite` 8.1.5 → 8.1.6 | Moderate | `>=8.1.6` | same | **已修复并验证**. Same tooling path. |

`@tailwindcss/vite` is declared under `dependencies`, which explains why tooling transitive packages appear in a `--prod` scan. This path classification is based on package graph and source imports, not an exploit test or proof that the advisories cannot be reached. `xlsx` is a direct browser import and is the priority. The current Shimadzu upload UI enforces `.xlsx` and 50 MB, raw workbooks stay browser-local, and Stage checks validate content; these reduce some exposure and data disclosure but **do not neutralize a parser vulnerability**. Limit workbook intake to trusted users, keep the size/type and schema checks, and investigate a maintained parser or vendor-supported patched build with a separate import/export parity suite before changing it. The two `xlsx` items remain unresolved until that migration or a verified patch.

## Compatibility and gate promotion

The Vite patch stayed within major 8; frozen install, 255 Node tests, 15 Python tests, lint and build passed locally. Lockfile resolution also added optional peer metadata without changing unrelated declared dependency versions. Browser E2E and production deployment were not run; no claim of full compatibility. No forced upgrade or scan suppression was used.

Keep audit visible and nonblocking in PR CI while the direct `xlsx` risk has an owner and migration plan. Make it blocking first for newly introduced advisories with a fixed patch, then for all fixable high/critical advisories after the existing two are resolved or explicitly time-bounded with documented compensating controls. Do not label the present `continue-on-error` step a passing security gate. Review the `xlsx` disposition at each release and on any parser/advisory update; block importing untrusted workbooks for higher-risk deployment until resolved.
