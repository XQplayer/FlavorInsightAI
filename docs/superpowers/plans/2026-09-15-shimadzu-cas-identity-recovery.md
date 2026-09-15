# Shimadzu CAS Identity Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover Excel-converted CAS values and resolve uniquely evidenced missing CAS values before Shimadzu Stage 2 screening, while exporting unresolved identity evidence without contaminating CAS-keyed analysis.

**Architecture:** Keep date restoration at the XLSX import boundary, where SheetJS still exposes the original numeric cell and its date format. Keep PubChem name-to-CAS resolution in an injected browser service backed by a narrow proxy endpoint. Stage 1 owns provenance and review rows; Stage 2 continues to accept only resolved valid CAS values.

**Tech Stack:** SheetJS, browser Web Worker, Node test runner, Python `unittest`, existing local PubChem proxy.

---

### Task 1: Add test-first Excel-date CAS restoration

**Files:**
- Create: `frontend/src/shimadzu-core/cas-identity-recovery.mjs`
- Create: `frontend/src/shimadzu-core/cas-identity-recovery.test.mjs`
- Modify: `frontend/src/workers/shimadzuWorkbook.js`
- Test: `frontend/src/workers/shimadzuWorkbook.test.mjs`

- [ ] **Step 1: Write failing pure-function tests**

```js
test('chooses the unique checksum-valid CAS from an Excel date', () => {
  assert.deepEqual(recoverExcelDateCas({ year: 1960, month: 12, day: 8 }), {
    status: 'recovered', cas: '60-12-8', candidates: ['1960-12-8', '60-12-8'],
  })
})

test('keeps the full-year candidate when it is the unique valid CAS', () => {
  assert.equal(recoverExcelDateCas({ year: 2050, month: 9, day: 1 }).cas, '2050-09-1')
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test frontend/src/shimadzu-core/cas-identity-recovery.test.mjs`  
Expected: FAIL because `cas-identity-recovery.mjs` does not exist.

- [ ] **Step 3: Implement minimal date recovery**

```js
export function recoverExcelDateCas({ year, month, day }) {
  const candidates = [`${year}-${String(month).padStart(2, '0')}-${day}`, `${String(year % 100).padStart(2, '0')}-${String(month).padStart(2, '0')}-${day}`]
  const valid = candidates.filter(casChecksumValid)
  return valid.length === 1
    ? { status: 'recovered', cas: valid[0], candidates }
    : { status: 'unresolved', cas: null, candidates }
}
```

Use the existing `casChecksumValid` and do not alter a cell unless the `CAS #` column contains a SheetJS numeric date cell.

- [ ] **Step 4: Extend workbook-reader tests, then implementation**

Add an in-memory SheetJS worksheet whose MS-search `CAS #` cell is numeric with `z: 'mm-dd-yy'`. Assert `readWorkbookSheets()` exposes `60-12-8` and a recovery event containing sheet, source row, original value, and source `Excel 日期恢复`.

In `readWorkbookSheets()`, scan only the MS similarity-search `CAS #` column. Use `XLSX.SSF.parse_date_code(cell.v)` for date parts; replace only the in-memory row value and return `casRecoveryEvents` alongside `rows`.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test frontend/src/shimadzu-core/cas-identity-recovery.test.mjs frontend/src/workers/shimadzuWorkbook.test.mjs`  
Expected: PASS.  
Commit: `git commit -am "feat(shimadzu): recover Excel date CAS values"`

### Task 2: Expose checksum-valid PubChem CAS candidates

**Files:**
- Modify: `fema_proxy_server.py`
- Modify: `scripts/tests/test_shimadzu_proxy.py`

- [ ] **Step 1: Write a failing proxy test**

Stub the PubChem synonyms response with valid and invalid CAS-shaped synonyms. Assert `GET /pubchem-cas-candidates?cid=45934107` returns only checksum-valid unique strings and reports the queried CID.

- [ ] **Step 2: Run the proxy test and confirm RED**

Run: `python -m unittest scripts.tests.test_shimadzu_proxy`  
Expected: FAIL with HTTP 404 because the route does not exist.

- [ ] **Step 3: Implement the narrow cached endpoint**

Add `query_pubchem_cas_candidates(cid)` which requests `rest/pug/compound/cid/{cid}/synonyms/JSON`, keeps only `^\\d{2,7}-\\d{2}-\\d$` values passing the standard checksum, and returns `{found, cid, candidates, source: 'PubChem'}`. Add `/pubchem-cas-candidates` to the handler allow-list and cache by canonical CID.

- [ ] **Step 4: Run the focused test and commit**

Run: `python -m unittest scripts.tests.test_shimadzu_proxy`  
Expected: PASS.  
Commit: `git commit -am "feat(proxy): expose verified PubChem CAS candidates"`

### Task 3: Resolve missing CAS before Stage 2 without guessing

**Files:**
- Create: `frontend/src/lib/shimadzuCasRecovery.js`
- Create: `frontend/src/lib/shimadzuCasRecovery.test.mjs`
- Modify: `frontend/src/workers/shimadzuPipeline.js`
- Test: `frontend/src/workers/shimadzuPipeline.test.mjs`

- [ ] **Step 1: Write failing service tests**

```js
test('fills CAS only for an exact PubChem name, formula, mass, and unique candidate', async () => {
  const result = await createShimadzuCasRecoveryService({ fetchImpl: fixtureFetch }).recover({
    'CAS #': '0-00-0', Name: 'Linoleyl myristate', 'Mol.Form': 'C32H60O2', 'Mol.Weight': 476,
  })
  assert.equal(result.record['CAS #'], '914926-20-8')
  assert.equal(result.audit['CAS 来源'], 'PubChem 精确名称补全')
})

test('keeps a CID-only result out of CAS analysis and in review', async () => {
  const result = await service.recover({ 'CAS #': '0-00-0', Name: 'Propyl eicosanoate', 'Mol.Form': 'C23H46O2', 'Mol.Weight': 354 })
  assert.equal(result.record['CAS #'], '0-00-0')
  assert.equal(result.review['CAS 补全状态'], '待人工确认')
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test frontend/src/lib/shimadzuCasRecovery.test.mjs`  
Expected: FAIL because the recovery service does not exist.

- [ ] **Step 3: Implement the injected resolver**

The service calls `/pubchem?cas=<Name>` and then `/pubchem-cas-candidates?cid=<CID>`. It requires an exact normalized formula match and `abs(sourceMw - pubchemMw) <= 0.5`. It writes a CAS only for one candidate; otherwise it returns the original record plus a review object carrying CID and reason.

- [ ] **Step 4: Make Stage 1 await recovery and retain audits**

Change `stage1()` and pipeline builders to await the service. For every extracted Hit #1 record, attach source-sheet/row lineage to audit records. Add `identityAudits` and `identityReviews` to Stage 1 data. Stage 2 receives only the updated record array; unresolved rows remain invalid for its main CAS table but are retained in the Stage 1 audit/review export.

- [ ] **Step 5: Add pipeline regression coverage and run GREEN**

Inject a fixture resolver into `runShimadzuBrowserPipeline()`. Assert a recovered CAS reaches Stage 2 and a CID-only record remains in `stages[1].identityReviews`, not in Stage 4's CAS table.

Run: `node --test frontend/src/lib/shimadzuCasRecovery.test.mjs frontend/src/workers/shimadzuPipeline.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `git commit -am "feat(shimadzu): recover evidenced missing CAS values"`

### Task 4: Export CAS provenance and review evidence

**Files:**
- Modify: `frontend/src/workers/shimadzuPipeline.js`
- Test: `frontend/src/workers/shimadzuPipeline.test.mjs`

- [ ] **Step 1: Write a failing archive assertion**

Assert the Stage 1 archive includes `01_CAS恢复与审核.xlsx`, with one `恢复审计` sheet containing `CAS 原始值`, `CAS 来源`, `PubChem CID`, `CAS 补全状态`, `源工作表`, and `源行号`, and one `待人工确认` sheet.

- [ ] **Step 2: Run the archive test and confirm RED**

Run: `node --test frontend/src/workers/shimadzuPipeline.test.mjs`  
Expected: FAIL because the workbook is absent.

- [ ] **Step 3: Implement the Stage 1 workbook spec**

Add a Stage 1 workbook spec that writes all recovery audits and review entries. Use `NA` for unavailable CID; preserve original text exactly in `CAS 原始值`. Do not add provenance columns to CAS-keyed Stage 4/5/6 concentration matrices.

- [ ] **Step 4: Run focused test and commit**

Run: `node --test frontend/src/workers/shimadzuPipeline.test.mjs`  
Expected: PASS.  
Commit: `git commit -am "feat(shimadzu): export CAS recovery audit"`

### Task 5: Verify the complete browser pipeline

**Files:**
- Modify: `PROJECT_HISTORY.md`

- [ ] **Step 1: Run the complete browser test suite**

Run: `cd frontend && npm run test:shimadzu-browser`  
Expected: all tests pass.

- [ ] **Step 2: Build the frontend**

Run: `cd frontend && npm run build`  
Expected: exit code 0.

- [ ] **Step 3: Run a read-only real-workbook validation**

Run the browser pipeline with `JX-ZS-C15.xlsx` and a valid sample configuration, without writing the source workbook. Verify date-origin records yield `60-12-8`, `79-09-4`, and `2050-09-1`; verify unresolved `0-00-0` records are present in the review workbook.

- [ ] **Step 4: Record the change and commit**

Add a dated `PROJECT_HISTORY.md` entry noting the provenance-first CAS recovery rule and that unresolved identities are retained separately.  
Commit: `git commit -am "docs: record Shimadzu CAS recovery policy"`
