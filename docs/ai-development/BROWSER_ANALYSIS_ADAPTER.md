# Browser Analysis Adapter and Agents SAI boundary

The local code interface is `frontend/src/analysis/browserAnalysisAdapter.mjs`. It is a preparation contract for Agents SAI, not a server tool registered with the current AI Gateway. The current chat page and Gateway remain unchanged; there has been **no live GPT-to-browser execution test**.

| Browser method | Input → output | Trust boundary |
| --- | --- | --- |
| `inspect_dataset(dataset)` | Immutable local dataset → selected sample/feature counts, missing cells, source hash and warning codes. | No raw matrix or individual observations in the returned summary. |
| `recommend_analysis(dataset)` | Local inspection → PCA candidate or unavailable, warnings and `requires_gateway_plan: true`. | This is a deterministic capability hint, not a model recommendation or computation. |
| `prepare_pca(dataset, gatewayPlan)` | Exact `flavor-pca-plan/1` object with `algorithm: "pca"`, bound `dataset_id`, validated options → local plan ID and confirmation preview. | Extra fields (including `approved`) and mismatched dataset IDs fail. No Worker runs. |
| `run_browser_pca({ plan_id, signal })` | UI-confirmed local plan → validated `flavor-pca-result/1` envelope. | Only the frontend calls its module Worker. Model-supplied data/parameters cannot be substituted at run time. Cancellation or failure stores no result. |
| `get_browser_pca_result(runId)` | Completed local run ID → defensive copy of the envelope. | In-memory, same-tab access only in this phase; no server retrieval or persistence claim. |
| `explain_pca_result(runId)` | Prior local sharing approval → bounded facts: dataset/run IDs, counts, parameters, explained-variance fractions and warnings. | Does **not** call GPT or send data. No raw matrix, individual scores, labels, workbooks, OAV or invented significance. A model-supplied `share_with_gateway` flag cannot grant access. |

`confirm_pca(planId)` and `confirm_explanation(runId)` are additional **UI-only** operations, never model tools. They must be called by explicit user actions after displaying the bound dataset/options and, for explanation, the exact bounded fields to share. `run_browser_pca` refuses an unconfirmed plan and accepts no `approved` model argument. `explain_pca_result` consumes a one-use local sharing grant. A new compute plan invalidates the prior plan; a plan is single-use.

## Future Gateway and UI sequence

1. Browser inspects local data and, after a separate user decision to ask AI, sends only an approved, bounded inspection summary to the authenticated AI Gateway. The Gateway validates user identity, applies limits and returns a `flavor-pca-plan/1` object. It does **not** call the browser Worker.
2. Frontend validates the plan and shows the options for user confirmation. A local UI event calls `confirm_pca`; the frontend then calls `run_browser_pca` with an AbortSignal.
3. A completed Worker result is normalized and kept in the browser. The user may request explanation; a **separate sharing confirmation** calls `confirm_explanation` and permits one `explain_pca_result` extraction. The frontend then sends only those bounded facts to the Gateway. Gateway records provenance, distinguishes computation from interpretation, and may produce narrative text. It must never manufacture or overwrite PCA numbers.
4. The existing server-side tool registry (`services/ai_tools.py`) must **not** register `run_browser_pca` as a server-executable function. A future endpoint for plan generation or explanation needs its own authenticated request schema, rate/cost limits, prompt-injection boundary and consent/audit record. No endpoint or model call is implemented in this phase.

The adapter unit test exercises the local sequence with a synthetic R-reference dataset: inspect → candidate → validated plan → unconfirmed denial → UI confirmation → Worker-compatible run → result lookup → bounded facts. This is **adapter behavior**, not platform-level Agent dispatch or live GPT integration.
