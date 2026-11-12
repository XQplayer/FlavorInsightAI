# FlavorInsight AI version rebaseline

## Approval and scope

User approved option A: reorganise repository and displays, current product version 1.1.0, prior updates aggregated as 1.0.0, old software releases backed up then drafted, immutable historical tags/commits retained, GNPS resource kept public. Use the previously selected direct/native execution workflow. Route deployment/CI, L4. No data/schema/formula/auth/secret changes; do not reorganise business modules or rewrite old Git objects.

## Public structure

- Current: `FlavorInsight AI 1.1.0`, tag `flavorinsight-v1.1.0`, explicitly Latest.
- Archive: `FlavorInsight AI 1.0.0 — Historical archive`, tag `flavorinsight-v1.0.0`, not Latest.
- Resource: existing `spectra-index-2026.08.02` stays published with its existing asset, ID, size and checksum; title clarifies this is a data resource.
- Existing software releases v1.1.0, v1.2.0, v1.3.0, v1.3.1 and v1.5.0 become drafts only AFTER new releases and deployment verification. Old release pages cease to be public; original text/tag/commit mappings remain in a public archive. No release/tag deletion or force push.

Namespaced new tags avoid the existing legacy `v1.1.0` tag. This is a new product version lineage, not SemVer comparison with the earlier FlavorThresholdDB series and not a claim that functionality regressed.

## Source and version metadata

Create a tested 1.0.0 archive snapshot commit from current main `fc0f678`, keeping all current functionality while normalising version metadata and archiving old documentation. Freeze that exact commit for the new archive tag; it does not replace original legacy commits. Then advance the same branch to 1.1.0 for the current release. Archive notes distinguish this aggregate snapshot from each original historical version.

Root `VERSION` is the authoritative shipped product/build version. Frontend package version, home footer, backend health build label, Render Blueprint and dispatch default must agree. Backend health reports shipped source VERSION, rather than a stale old API_VERSION environment value. Retain the existing api_version response field and no protocol/schema renumbering. Dataset/index/schema/engine versions are independent and are not mass-replaced.

## Documentation and display

README retains supplied logo/brand links, explains current platform capabilities and deployment boundaries, and shows only current 1.1.0 plus historical 1.0.0 entry points. Database/processing are web capabilities; statistical computation still needs the local Python/R service; AI model inference is not claimed implemented. Rebuild CHANGELOG into current/aggregate history with links to exact legacy copies. PROJECT_HISTORY remains the project authority: add current lineage and archive notice without rewriting dated events or original migration task IDs. Label older audit/spec reports as historical via the archive/index, not a global string replacement. Site footer links current and archive releases in both languages.

## Backup and safety

Before any remote write, commit complete release JSON (including bodies, IDs, flags and assets), original README/CHANGELOG and old tag SHA/peeled-commit mapping under docs/history/releases. New archive release also carries the small backup files as attachments. Verify original GNPS manifest checksum/asset metadata and all old tag refs before and after. Its canonical repo URL may be corrected without changing dataset version or bytes. No 121 MB dataset move/download is necessary.

Remote sequence: verify local archive snapshot and current branch; independent review; matching PR CI; merge; verify Pages and Render runtime version/commit; publish two new tags/releases; verify backup attachment hashes; draft only the five allowlisted legacy software releases and label data resource. If any gate fails, do not hide old releases. Read back final public release list and raw tag refs. Do not claim authenticated analysis/scientific validation beyond checks actually run.

## Failure and rollback

Keep old releases public until replacements are ready. Any changed upstream release/tag/asset snapshot requires re-audit, not overwrite. No pre-existing new tag can be moved. Reversible drafting is preferred to deletion; rollback uses backup JSON to restore draft flags/names/body and explicit Latest designation, plus revert release merge/redeploy. Original published dates remain preserved in the backup even if GitHub changes timestamps upon re-publication. Main dirty checkout and unrelated files remain untouched.

## Acceptance

Full affected frontend/metadata/Python tests, lint/build, desktop/mobile home footer and key routes, real matching CI SHA, actual public runtime /health and Pages asset version, backup integrity, exactly two visible software releases plus the preserved independent data release, and unchanged legacy tag refs/GNPS asset size/checksum. Report all remaining constraints honestly.
