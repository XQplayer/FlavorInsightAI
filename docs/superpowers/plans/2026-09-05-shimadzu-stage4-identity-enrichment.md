# Shimadzu Stage 4 Identity Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich only the Stage 4 semi-quantification output with CAS-resolved identifiers and sensory-database fields, and preserve them through Stages 5 and 6.

**Architecture:** A browser-side enrichment service requests the existing local proxy once per unique CAS. It normalizes a fixed nine-field identity record, which is added to the Stage 4 primary table before Stage 5 statistics and Stage 6 matrix splitting consume that data.

**Tech Stack:** React/Vite browser Worker, existing local 8787 proxy, PubChem, FEMA, FlavorDB2, Node test runner.

---

### Task 1: Stage 4 identity-enrichment contract

**Files:**
- Create: `frontend/src/lib/shimadzuCompoundEnrichment.js`
- Create: `frontend/src/lib/shimadzuCompoundEnrichment.test.mjs`

- [ ] Write a failing test for a single CAS response normalized into CID, names, SMARTS labels, FEMA fields, and FlavorDB2 fields; missing source values are `NA`.
- [ ] Implement cached per-CAS proxy enrichment with no name inference.
- [ ] Run the focused service test.

### Task 2: Stage 4 data propagation

**Files:**
- Modify: `frontend/src/workers/shimadzuPipeline.js`
- Modify: `frontend/src/workers/shimadzuPipeline.test.mjs`

- [ ] Write a failing pipeline test that verifies the nine fields in Stage 4 and the same fields in Stage 5 and Stage 6 output tables.
- [ ] Enrich Stage 4 data before Stage 5 processing; do not invoke enrichment at any other stage.
- [ ] Run the focused pipeline test.

### Task 3: Regression verification

- [ ] Run focused enrichment and pipeline tests.
- [ ] Run lint and Vite production build.
