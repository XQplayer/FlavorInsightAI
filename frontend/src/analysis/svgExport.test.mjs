import test from 'node:test';
import assert from 'node:assert/strict';
const m = await import('./svgExport.mjs').catch(() => ({}));
test('SVG dimensions enforce bounded positive pixel dimensions', () => {
  assert.equal(typeof m.exportDimensions, 'function');
  assert.deepEqual(m.exportDimensions(860, 550, 2), {
    width: 1720,
    height: 1100
  });
  assert.throws(() => m.exportDimensions(0, 2), /dimension/i);
  assert.throws(() => m.exportDimensions(10000, 10000, 3), /dimension/i);
});
test('PNG rasterizes the supplied SVG and revokes image URL on success/failure', async () => {
  assert.equal(typeof m.rasterizeSvg, 'function');
  for (const fail of [false, true]) {
    let revoked = 0,
      drawn = 0,
      created = 0;
    const env = {
      URL: {
        createObjectURL: () => {
          created++;
          return 'blob:test';
        },
        revokeObjectURL: () => revoked++
      },
      Image: class {
        set src(v) {
          this.source = v;
          queueMicrotask(() => fail ? this.onerror() : this.onload());
        }
      },
      document: {
        createElement: () => ({
          getContext: () => ({
            drawImage: () => drawn++
          }),
          toBlob: fn => fn(new Blob(['png']))
        })
      }
    };
    if (fail) await assert.rejects(m.rasterizeSvg('<svg/>', 860, 550, env), /SVG/);else await m.rasterizeSvg('<svg/>', 860, 550, env);
    assert.equal(revoked, 1);
    assert.equal(created, 1);
    assert.equal(drawn, fail ? 0 : 1);
  }
});
