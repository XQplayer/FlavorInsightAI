import { deriveDataset } from './dataset.mjs'
import { importShimadzuArchive } from './shimadzuAdapter.mjs'

/** Keep verified source identity deterministic, but never reuse a workspace's storage key. */
export async function importArchiveSnapshot(bytes, options, adapter = importShimadzuArchive) {
  const source = await adapter(bytes, options)
  return deriveDataset(source, {provenance:{sourceSnapshotId:source.id}}, 'archive-import')
}
