import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { build } from 'vite';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

function manifestEntry(manifest, sourcePath) {
  return Object.entries(manifest).find(([key]) => (
    key.replaceAll('\\', '/').endsWith(sourcePath)
  ))?.[1];
}

test('production bundle keeps database data and the Shimadzu worker out of the platform entry', async t => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'flavorinsight-platform-bundle-'));
  t.after(() => rm(outDir, { recursive: true, force: true, maxRetries: 3 }));

  await build({
    root: frontendRoot,
    configFile: path.join(frontendRoot, 'vite.config.js'),
    logLevel: 'silent',
    build: {
      emptyOutDir: true,
      manifest: true,
      outDir,
    },
  });

  const manifest = JSON.parse(await readFile(path.join(outDir, '.vite', 'manifest.json'), 'utf8'));
  const platformEntry = manifestEntry(manifest, 'index.html');
  const databaseChunk = manifestEntry(manifest, 'src/pages/DatabaseOverviewPage.jsx');
  const shimadzuChunk = manifestEntry(
    manifest,
    'src/components/shimadzu/ShimadzuAnalysisPage.jsx',
  );

  assert.ok(platformEntry?.isEntry, 'missing platform entry in Vite manifest');
  assert.ok(databaseChunk?.isDynamicEntry, 'database app must be a dynamic entry');
  assert.ok(shimadzuChunk?.isDynamicEntry, 'Shimadzu workbench must be a dynamic entry');
  assert.equal(new Set([
    platformEntry.file,
    databaseChunk.file,
    shimadzuChunk.file,
  ]).size, 3);

  const [platformSource, databaseSource, shimadzuSource] = await Promise.all([
    readFile(path.join(outDir, platformEntry.file), 'utf8'),
    readFile(path.join(outDir, databaseChunk.file), 'utf8'),
    readFile(path.join(outDir, shimadzuChunk.file), 'utf8'),
  ]);

  assert.doesNotMatch(platformSource, /aroma_data_merged\.json/);
  assert.doesNotMatch(platformSource, /shimadzu\.worker/i);
  assert.match(databaseSource, /aroma_data_merged\.json/);
  assert.match(shimadzuSource, /shimadzu\.worker/i);
});
