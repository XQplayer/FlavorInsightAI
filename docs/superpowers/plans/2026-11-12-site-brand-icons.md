# Website brand icon replacement

## Contract and delivery plan

User request: replace the public browser-tab icon and sidebar FI placeholder with the appropriate previously supplied brand image. Use the transparent standalone mark, not the wide wordmark; keep the source image unchanged. Product version remains1.1.0. No analysis, authentication, data or backend changes.

Route1 frontend, with L4 publication gates. Reuse the clean isolated worktree from main4c5c7d9 on codex/site-brand-icons; preserve the dirty primary checkout. Native implementation with serial self-review. Relevant Skills: test-driven-development and verification-before-completion; writing-plans consulted for file and gate mapping.

Files: frontend/public/brand/flavorinsight-ai-mark.png (byte-identical copy), frontend/index.html (PNG icon links), PlatformShell.jsx/.css (image in existing38px slot), staticRoutes.test.mjs (retire obsolete SVG-specific expectation), scripts/e2e/verify_brand_icons.mjs (real served-image checks), docs/brand/README.md (usage record).

- [x] Run brand browser check against unchanged preview; expected old-favicon hash mismatch observed.
- [x] Copy original PNG without image processing. Repoint tab/touch icons and sidebar with Vite base-aware URLs. Remove FI blue placeholder styling, preserve link semantics and layout dimensions.
- [x] Build and lint passed; full frontend tests463/463 without skips; six real browser combinations passed on nested AI Models route at1440/768/390 widths, light/dark schemes, reduced motion, brand-link keyboard activation, image loading, source hashes and overflow. Serial diff review confirms no version, data or backend changes. Original PNG SHA2561480f4b46571f92885cb8ca4fc1af05985c583e2d5ca42256ca54e8ee182d83e matches served bytes.
- [ ] Commit/push, require exact-head PR CI, merge, require exact-merge Pages deployment; rerun public brand checks. User explicitly requested changing the online site. Do not create another release or deploy backend.

Failure/rollback: an inaccessible image or incorrect project base fails browser checks; do not publish a broken reference. Revert this single feature commit/merge and redeploy Pages to restore the old icons. Original artwork and old favicon files remain recoverable. No secret/configuration changes or data migration.
