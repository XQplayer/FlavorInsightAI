# FlavorInsight AI visual refinement implementation plan

1. Baseline: verify the isolated branch is clean; run platform contract tests; inspect current rendered pages and existing CSS contracts.
2. Home: add a bespoke evidence-trajectory visual and clearer narrative hierarchy in `frontend/src/pages/PlatformHomePage.jsx`; preserve the current real routes, status copy and example caveat. Put scoped, responsive rules in `PlatformPages.css`.
3. Shared system: refine the brand-only shell treatment in `frontend/src/components/platform/PlatformShell.css`; improve database and research page framing without touching data transformations.
4. Add focused UI contract checks in `frontend/src/platformUiContract.test.mjs` before the new visual component; run red then green. Run lint, build, platform/static/search/Shimadzu tests.
5. Run the browser route/screenshot verifier at 1440/1024/768/375; inspect output and adjust any overflow, illegible themes or control occlusion. Commit the isolated branch and merge locally only after green checks, preserving dirty user files on `main`.

No version bump or GitHub upload. The two previously identified stale release-hardening assertions are baseline exceptions, not acceptance criteria for this visual change.
