import { importShimadzuArchive } from './shimadzuAdapter.mjs';
import { importArchiveSnapshot } from './archiveImport.mjs';
export async function handoffCompletedArchive({
  job,
  ownedUrl,
  selection,
  isCurrent,
  store,
  storage = globalThis.sessionStorage,
  navigate,
  fetch = globalThis.fetch,
  adapter = importShimadzuArchive
}) {
  if (job?.status !== 'complete' || !job.downloadUrl?.startsWith('blob:') || job.downloadUrl !== ownedUrl) throw new Error('COMPLETE_OWNED_ARCHIVE_REQUIRED');
  const guard = () => {
    if (!isCurrent()) throw new Error('STALE_HANDOFF');
  };
  guard();
  const response = await fetch(ownedUrl);
  if (!response.ok) throw new Error('ARCHIVE_BLOB_UNAVAILABLE');
  const dataset = await importArchiveSnapshot(await response.arrayBuffer(), {
    selection
  }, adapter);
  guard();
  await store.save(dataset);
  guard();
  storage.setItem('flavor-analysis-handoff-id', dataset.id);
  navigate('analysis');
  return dataset.id;
}
