# Phase 4 workbook parser remediation — 2026-11-09

**Local result: patched direct `xlsx` dependency installed and regression-verified. Remote CI and full browser release suite are still open.** This supersedes the phase 3 two-high-advisory snapshot; it does not erase that historical report.

## Exposure and upstream evidence

`rg -n "from 'xlsx'|XLSX.read|XLSX.write" frontend/src` found three direct importers: `analysis/imports.mjs` reads user-selected workbooks and `analysis/exports.mjs` writes outputs; `workers/shimadzuWorkbook.js` reads raw/sample workbooks and writes report workbooks. `pnpm why xlsx --prod` showed one direct dependency, with no other installed version. Thus the vulnerable parser was on an actual browser-local input path, not merely an unused lockfile entry. General analysis limits XLSX to 32 MiB, 2,000 ZIP entries, 256 MiB declared expanded bytes and 2 million cells, with central-directory/path checks before `XLSX.read`; Shimadzu UI accepts two `.xlsx` files up to 50 MB each, and its Worker uses `XLSX.read` directly. These limits reduce some resource hazards but are not a proof that every crafted workbook is safe.

The primary advisories are [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (prototype pollution before 0.19.3) and [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (regular-expression denial of service before 0.20.2). The npm registry has no patched `xlsx` release for these records. [SheetJS official installation guidance](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) provides its CDN tarball at 0.20.3, including a `pnpm` installation command; its [framework guidance](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/) covers browser bundlers. The lockfile pins a SHA-512 integrity value for the official tarball, so a frozen install detects changed bytes.

## Choice and comparison

| Option | Observed local package metadata / interface | Decision |
| --- | --- | --- |
| Official SheetJS 0.20.3 tarball | 8,082,026 installed bytes, 29 files; existing `read`, `write` and `utils` API; official Vite/browser documentation; lock integrity recorded | Selected as smallest migration surface; version exceeds both advisory fixes. |
| ExcelJS 4.4.0 | `pnpm view exceljs version dist.unpackedSize dependencies --json`: 21,825,509 unpacked bytes; browser bundle exists; more parser, ZIP and stream dependencies; different workbook/cell API | Valid future alternative, but would require import/export/Worker mapping rewrite and more browser bundle and compatibility measurement. |
| xlsx-populate 1.21.0 | `pnpm view xlsx-populate version dist.unpackedSize dependencies --json`: 15,112,553 unpacked bytes; JSZip/CFB/lodash dependencies and different API | No lower-risk migration for the existing worker/export contract was demonstrated. |

Package unpacked/installed sizes are metadata or local disk measurements, not a comparable browser bundle benchmark. No controlled parse-speed benchmark was run. Post-change `archiveImport` build chunk is **594.93 kB** (gzip **191.51 kB**) and still triggers the 500 kB warning; this is a performance review item, not a measured parse regression.

## Test-first migration and actual outcome

Before changing dependencies, two synthetic tests were added to `frontend/src/analysis/imports.test.mjs`: sheet order/zero/blank/CAS-like labels; ZIP traversal and malformed entry count. `node --test src/analysis/imports.test.mjs` passed **8/8** against old 0.18.5. Existing focused import/export/Worker tests passed **32/32**. No empirical research file was used.

```powershell
cd frontend
pnpm add xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz --ignore-scripts
pnpm why xlsx --prod
node --test src/analysis/imports.test.mjs src/analysis/exports.test.mjs src/workers/shimadzuWorkbook.test.mjs src/workers/shimadzuPipeline.test.mjs
pnpm run test:analysis
pnpm run test:shimadzu-browser
pnpm run lint
pnpm run build
pnpm audit --prod --json > ..\docs\ai-development\dependency-audit-phase4-2026-11-09.json
```

The first focused post-upgrade run was **33/34**: the date-formatted CAS recovery cell became `Invalid Date` during `sheet_to_json`. The regression was isolated to `shimadzuWorkbook.js`; setting the recovered text cell format to `@` preserves the recovered CAS and its source-row audit. No seven-stage formula or stage sequence changed. Retest: focused **34/34**, `test:analysis` **104/104**, `test:shimadzu-browser` **118/118**, all seven frontend suites **359/359**, lint and build exit 0. `pnpm install --frozen-lockfile --ignore-scripts` succeeded. The JSON audit metadata reports **0 info, 0 low, 0 moderate, 0 high, 0 critical**, exit 0; `pnpm audit --prod` printed `No known vulnerabilities found`.

The registry advisory scanner may not evaluate the CDN tarball with the same coverage as an npm-hosted version. Therefore the zero count is an advisory-scan result, not a complete security certification. Version and upstream advisory ranges, lock integrity, hostile ZIP tests and browser regression provide separate evidence. Full release-candidate E2E failed on a fixed-bottom overlap assertion unrelated to workbook parsing; focused desktop success/mobile failure processing E2E passed. Retain the Worker file-size gate and source-only import policy; require a real PR CI run and resolved/accepted full E2E issue before release. Review future SheetJS security announcements and pin updates through the same test-first procedure.
