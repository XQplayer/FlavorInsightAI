import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLATFORM_ROUTE_SEGMENTS,
  parsePlatformRoute,
  routeHref,
} from './app/platformRoutes.js';

test('parsePlatformRoute recognizes canonical and compatibility routes', () => {
  assert.equal(parsePlatformRoute('/FlavorThresholdDB/'), 'home');
  assert.equal(parsePlatformRoute('/database/'), 'database');
  assert.equal(parsePlatformRoute('/aroma-threshold/'), 'search');
  assert.equal(parsePlatformRoute('/data-processing/'), 'processing');
  assert.equal(parsePlatformRoute('/shimadzu-analysis/'), 'processing');
  assert.equal(parsePlatformRoute('/data-analysis/'), 'analysis');
  assert.equal(parsePlatformRoute('/resources/'), 'resources');
});

test('parsePlatformRoute treats unknown and prototype-named paths as home', () => {
  for (const pathname of ['/unknown/', '/toString/', '/constructor/', '/__proto__/']) {
    assert.equal(parsePlatformRoute(pathname), 'home');
  }
});

test('routeHref emits canonical paths under the configured base path', () => {
  assert.equal(routeHref('resources', '/FlavorThresholdDB'), '/FlavorThresholdDB/resources/');
  assert.equal(routeHref('processing', '/FlavorThresholdDB'), '/FlavorThresholdDB/data-processing/');
});

test('routeHref treats prototype-named route keys as home', () => {
  for (const route of ['toString', 'constructor', '__proto__']) {
    assert.equal(routeHref(route, '/FlavorThresholdDB'), '/FlavorThresholdDB/');
  }
});

test('PLATFORM_ROUTE_SEGMENTS is immutable', () => {
  assert.equal(Object.isFrozen(PLATFORM_ROUTE_SEGMENTS), true);
});
