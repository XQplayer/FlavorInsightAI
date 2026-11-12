# Implementation and verification plan

1. Add failing tests for a deterministic bilingual diagnostic model, legacy/unknown errors, parser row metadata and template reminders.
2. Add structural row metadata without changing parser decisions. Include source workbook and configuration reminders in serializable error evidence.
3. Extend the existing issue helper and add one presentational error component. Keep raw details/download, separate warnings and support English/Chinese.
4. Run affected Node tests and existing Shimadzu suite, lint and production build. Inspect rendered component at desktop/mobile sizes and exercise disclosure with keyboard.
5. Perform a serial self-review of evidence boundaries, diff, legacy restoration and responsive behavior. Record exact results and any limitations. Provide isolated preview and await explicit merge/deploy authorisation.
