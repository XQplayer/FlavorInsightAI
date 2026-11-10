import { createDataset } from './dataset.mjs';
import { toUnifiedPcaResult, validateUnifiedPcaResult } from './pcaResult.mjs';

export const BROWSER_PCA_ARCHIVE_VERSION = 'flavor-browser-pca-archive/1';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('PCA_ARCHIVE_TOO_LARGE');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function validatePayload(payload) {
  if (!payload || payload.archive_version !== BROWSER_PCA_ARCHIVE_VERSION) throw new Error('PCA_ARCHIVE_VERSION');
  const dataset = createDataset(payload.dataset);
  const result = validateUnifiedPcaResult(payload.result);
  if (result.dataset_metadata.id !== dataset.id || result.dataset_metadata.sample_ids.some(id => !dataset.samples.some(s => s.id === id))
    || result.dataset_metadata.feature_ids.some(id => !dataset.features.some(f => f.id === id))
    || result.dataset_metadata.source_sha256 !== (dataset.provenance.sourceSha256 ?? null)
    || !payload.core_result || !payload.options || !payload.plot
    || result.provenance.run_id !== payload.core_result.provenance?.runId
    || JSON.stringify(toUnifiedPcaResult(payload.core_result, dataset)) !== JSON.stringify(result)) throw new Error('PCA_ARCHIVE_INVALID');
  return dataset;
}

/** A selected numeric matrix is stored only after a user action; original workbook bytes are excluded. */
export async function createBrowserPcaArchive({ dataset, result, options, plot }) {
  const checked = createDataset(dataset);
  const payload = { archive_version: BROWSER_PCA_ARCHIVE_VERSION, dataset: structuredClone(checked),
    core_result: structuredClone(result), result: toUnifiedPcaResult(result, checked),
    options: structuredClone(options), plot: structuredClone(plot), saved_at: new Date().toISOString() };
  validatePayload(payload);
  return { ...payload, sha256: await sha256(JSON.stringify(payload)) };
}

export async function validateBrowserPcaArchive(value) {
  if (!value || value.archive_version !== BROWSER_PCA_ARCHIVE_VERSION) throw new Error('PCA_ARCHIVE_VERSION');
  if (Object.keys(value).sort().join(',') !== ['archive_version', 'core_result', 'dataset', 'options', 'plot', 'result', 'saved_at', 'sha256'].sort().join(',')) throw new Error('PCA_ARCHIVE_INVALID');
  if (!/^[a-f\d]{64}$/.test(value.sha256 || '')) throw new Error('PCA_ARCHIVE_INVALID');
  const { sha256: expected, ...payload } = value;
  if (await sha256(JSON.stringify(payload)) !== expected) throw new Error('PCA_ARCHIVE_HASH_MISMATCH');
  validatePayload(payload);
  return structuredClone(value);
}
