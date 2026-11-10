# Phase 5 Agent plus PCA end-to-end evidence

Recorded 2026-11-11 (Asia/Singapore), source `421c770`. Local command: `python -m unittest discover -s scripts/tests -q` produced 190 passes; `node scripts/e2e/verify_ai_assistant.mjs` passed in Mock mode at desktop/tablet/mobile. A synthetic 10-turn unit test checks same-session context and another-session separation. This is **not** ten live online model turns.

Implemented path: user text → server-side AI plan on the existing Responses API path → browser inspection and explicit plan confirmation → Web Worker PCA → structural/numeric result validation → four plots → client-validated summary only to Gateway for explanation → local IndexedDB archive → conversation link with `analysis_id` and `result_id`. The model does not receive a raw matrix by default and cannot invoke a browser Worker directly. If AI is disabled/unavailable, Browser PCA remains independently usable. The linked summary is structurally checked, not server-recomputed.

Remaining actual end-to-end proof: real deployed Gateway; genuine Supabase-backed history after refresh/relogin; two-user JWT isolation; 10 consecutive live model rounds; multi-session separation; model switch; long-context truncation; stop/network/timeout/retry; scientific fact review; deployed Browser PCA linkage. Status: **BLOCKED — online Agent plus PCA closure unverified**.
