# Shimadzu failure diagnostics

User request: explain a failed analysis directly on the platform error page using the same evidence available in the result archive.

Inputs: worker error code, structured issues, stage summaries, workbook filename and structural source-row metadata. Outputs: bilingual blocking reason, sample/sheet/row location, missing fields, corrective action, stage counts and separate nonblocking warning totals. Preserve original technical details and evidence download.

Known missing-header errors distinguish a section with no content from an unrecognised header only when parser metadata establishes that difference. Historical errors without row metadata must not invent rows. Unknown errors retain their original message. Template example markers are reminders to verify configuration, never the reason a different gate failed.

No formulas, exclusions, thresholds, raw inputs, credentials or cloud storage policy change. Do not include full raw cell contents in diagnostics. React renders strings as text. Cancellation remains distinct from failure. The same component supports local/online execution and restored errors.

Acceptance: a fixture with 380 warnings and one missing peak table shows the fatal issue first, sample L-1-36h-1, source rows 6/7 when supplied, missing Peak#/Area and re-export advice. Warning totals must not imply warnings stopped the run. Desktop/mobile layouts do not overflow. Native details disclosure and evidence download remain keyboard accessible.

Baseline: existing issue-order and parser tests 2/2. The user workbook is read-only evidence, not committed as a test fixture. Automated fixtures are structural demonstrations, not observed research values.

Implementation remains in codex/shimadzu-error-diagnostics. No merge or production deployment is authorised by this design. Rollback: remove the isolated worktree or revert the eventual feature commit; no data migration is involved.
