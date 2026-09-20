export const PLATFORM_ROUTE_SEGMENTS = Object.freeze({
  home: '',
  database: 'database',
  search: 'aroma-threshold',
  processing: 'data-processing',
  analysis: 'data-analysis',
  resources: 'resources',
});

const PLATFORM_ROUTE_BY_SEGMENT = Object.freeze({
  database: 'database',
  'aroma-threshold': 'search',
  'data-processing': 'processing',
  'shimadzu-analysis': 'processing',
  'data-analysis': 'analysis',
  resources: 'resources',
});

export function parsePlatformRoute(pathname) {
  const segments = String(pathname ?? '').split('/').filter(Boolean);
  const segment = segments.at(-1);
  return Object.hasOwn(PLATFORM_ROUTE_BY_SEGMENT, segment)
    ? PLATFORM_ROUTE_BY_SEGMENT[segment]
    : 'home';
}

export function routeHref(route, basePath = '') {
  const normalizedBasePath = String(basePath ?? '').replace(/\/+$/, '');
  const segment = Object.hasOwn(PLATFORM_ROUTE_SEGMENTS, route)
    ? PLATFORM_ROUTE_SEGMENTS[route]
    : '';
  return `${normalizedBasePath}/${segment ? `${segment}/` : ''}`;
}
