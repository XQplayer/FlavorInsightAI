export const PLATFORM_ROUTE_SEGMENTS = Object.freeze({
  home: '',
  database: 'database',
  search: 'aroma-threshold',
  processing: 'data-processing',
  analysis: 'data-analysis',
  resources: 'resources',
  login: 'login',
});

const PLATFORM_ROUTE_BY_SEGMENT = Object.freeze({
  database: 'database',
  'aroma-threshold': 'search',
  'data-processing': 'processing',
  'shimadzu-analysis': 'processing',
  'data-analysis': 'analysis',
  resources: 'resources',
  login: 'login',
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

export function navigatePlatformRoute(route, { basePath = '', history = window.history } = {}) {
  history.pushState({ route }, '', routeHref(route, basePath));
}

export function subscribeToPlatformPopstate(onRouteChange, target = window) {
  const handlePopstate = () => {
    onRouteChange(parsePlatformRoute(target.location.pathname));
  };

  target.addEventListener('popstate', handlePopstate);
  return () => target.removeEventListener('popstate', handlePopstate);
}
