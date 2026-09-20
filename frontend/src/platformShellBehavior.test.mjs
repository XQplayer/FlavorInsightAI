import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dismissTopDisclosureOnEscape,
  isNormalLeftClick,
  isOutsideDisclosure,
} from './components/platform/platformShellBehavior.js';

function boundaryFor(insideTarget) {
  return {
    contains(target) {
      return target === insideTarget;
    },
  };
}

test('outside disclosure checks only its own trigger and panel boundaries', () => {
  const triggerTarget = {};
  const panelTarget = {};
  const outsideTarget = {};
  const boundary = {
    trigger: boundaryFor(triggerTarget),
    panel: boundaryFor(panelTarget),
  };

  assert.equal(isOutsideDisclosure(triggerTarget, boundary), false);
  assert.equal(isOutsideDisclosure(panelTarget, boundary), false);
  assert.equal(isOutsideDisclosure(outsideTarget, boundary), true);
});

test('Escape dismisses the top open disclosure and restores its trigger focus', () => {
  const calls = [];
  const account = {
    open: true,
    close: () => calls.push('close-account'),
    trigger: { focus: () => calls.push('focus-account') },
  };
  const menu = {
    open: true,
    close: () => calls.push('close-menu'),
    trigger: { focus: () => calls.push('focus-menu') },
  };

  assert.equal(dismissTopDisclosureOnEscape({ key: 'Escape' }, [account, menu]), true);
  assert.deepEqual(calls, ['close-account', 'focus-account']);
});

test('Escape falls through to the menu and other keys do not dismiss it', () => {
  const calls = [];
  const menu = {
    open: true,
    close: () => calls.push('close-menu'),
    trigger: { focus: () => calls.push('focus-menu') },
  };

  assert.equal(dismissTopDisclosureOnEscape({ key: 'Enter' }, [menu]), false);
  assert.deepEqual(calls, []);
  assert.equal(dismissTopDisclosureOnEscape({ key: 'Escape' }, [menu]), true);
  assert.deepEqual(calls, ['close-menu', 'focus-menu']);
});

test('normal unmodified left clicks remain eligible for client navigation', () => {
  assert.equal(isNormalLeftClick({ button: 0 }), true);
  assert.equal(isNormalLeftClick({ button: 1 }), false);
  assert.equal(isNormalLeftClick({ button: 0, ctrlKey: true }), false);
  assert.equal(isNormalLeftClick({ button: 0, metaKey: true }), false);
  assert.equal(isNormalLeftClick({ button: 0, shiftKey: true }), false);
  assert.equal(isNormalLeftClick({ button: 0, altKey: true }), false);
});
