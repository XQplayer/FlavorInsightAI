import reference from '../../frontend/src/analysis/browserPca.reference.json' with { type: 'json' };
import { runBrowserPca } from '../../frontend/src/analysis/browserPca.mjs';
import { toUnifiedPcaResult } from '../../frontend/src/analysis/pcaResult.mjs';

const dataset = structuredClone(reference.dataset);
const core = runBrowserPca({ dataset, options: { scale: 'uv', components: 2 } });
core.provenance.runId = 'synthetic-schema-check';
core.provenance.completedAt = '2026-11-10T00:00:00.000Z';
process.stdout.write(JSON.stringify(toUnifiedPcaResult(core, dataset)));
