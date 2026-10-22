import test from 'node:test';
import assert from 'node:assert/strict';
const m = await import('./casLink.mjs').catch(() => ({}));
test('CAS links respect base and initialize only valid exact CAS parameters', () => {
  assert.equal(typeof m.casQuery, 'function');
  assert.equal(m.casQuery('?cas=64-17-5'), '64-17-5');
  assert.equal(m.casQuery('?cas=%3Cscript%3E'), '');
  assert.equal(m.casQuery('?cas=64-17-6'), '');
  assert.equal(m.casHref('64-17-5', '/FlavorInsightAI/'), '/FlavorInsightAI/aroma-threshold/?cas=64-17-5');
  assert.equal(m.casHref('bad', '/'), null);
});
