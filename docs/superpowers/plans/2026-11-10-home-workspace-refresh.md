# Homepage research workspace refresh

**Route and level:** Frontend / UI, L3. Superpowers owns the workflow; frontend UI engineering supplies the specialist checklist. No scientific algorithm, raw data, deployment or GSAP change.

**Reference:** MLflow's tracking UI presents a clear experiment hierarchy, concise entry points and visible metadata. Adapt that density and navigation rhythm to FlavorInsight AI's existing workspaces, without copying MLflow branding or inventing activity metrics.

**Design contract:** Keep the existing bilingual title, four destinations, status labels, three real screenshots, source/privacy explanations, FAQ and footer links. Make the primary processing and database actions prominent. Add a keyboard accessible in-page index to Workspaces, Workflow and Resources. At desktop widths, shorten the hero and show four workspaces as a balanced directory; at tablet/mobile, stack them without horizontal overflow. Use the existing tokens and restrained CSS transitions; no animation dependency.

## Tasks

- [x] Add failing homepage tests for the in-page index and beta scope. Add browser assertions for pointer/keyboard anchor navigation and responsive overflow.
- [x] Update `PlatformHomeV2.jsx` and homepage CSS for a more compact hierarchy and balanced feature cards.
- [x] Run focused and full frontend tests, lint, build and focused six-viewport homepage E2E. Inspect desktop/mobile/dark screenshots. Independent review found no blockers; its suggested viewport and keyboard assertions were added.
- [x] Review diff for raw data/Worker changes. Rollback is a local revert of the resulting commit on this branch.

## Verification limits

The full release E2E timed out waiting for an external open-spectrum plot. The all-route platform E2E stopped on `mobile/database` after a browser-aborted `/health` request; the same failure repeated. These routes and services were not changed by this homepage patch. The focused homepage route passed at all six viewport sizes. The broad 145-test Python suite had four PubChem volatile cache/concurrency failures; the 15-test Shimadzu analysis/proxy API suite passed.
