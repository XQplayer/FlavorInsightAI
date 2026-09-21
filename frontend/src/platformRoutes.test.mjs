import assert from 'node:assert/strict';
import test from 'node:test';

import * as platformRoutes from './app/platformRoutes.js';

const {
  PLATFORM_ROUTE_SEGMENTS,
  parsePlatformRoute,
  routeHref,
} = platformRoutes;

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

test('navigatePlatformRoute pushes canonical history state', () => {
  assert.equal(typeof platformRoutes.navigatePlatformRoute, 'function');
  const calls = [];
  const history = {
    pushState(...args) {
      calls.push(args);
    },
  };

  platformRoutes.navigatePlatformRoute('processing', {
    basePath: '/FlavorThresholdDB',
    history,
  });

  assert.deepEqual(calls, [[
    { route: 'processing' },
    '',
    '/FlavorThresholdDB/data-processing/',
  ]]);
});

test('subscribeToPlatformPopstate reports routes and removes its listener', () => {
  assert.equal(typeof platformRoutes.subscribeToPlatformPopstate, 'function');
  const listeners = new Map();
  const target = {
    location: { pathname: '/FlavorThresholdDB/aroma-threshold/' },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const routes = [];

  const unsubscribe = platformRoutes.subscribeToPlatformPopstate(route => routes.push(route), target);
  listeners.get('popstate')();
  target.location.pathname = '/FlavorThresholdDB/shimadzu-analysis/';
  listeners.get('popstate')();
  unsubscribe();

  assert.deepEqual(routes, ['search', 'processing']);
  assert.equal(listeners.has('popstate'), false);
});
