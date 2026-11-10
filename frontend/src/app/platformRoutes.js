export const PLATFORM_ROUTE_SEGMENTS = Object.freeze({
  home: '',
  database: 'database',
  search: 'aroma-threshold',
  processing: 'data-processing',
  analysis: 'data-analysis',
  models: 'ai-models',
  assistant: 'ai-assistant',
  resources: 'resources',
  login: 'login',
});

const PLATFORM_ROUTE_BY_SEGMENT = Object.freeze({
  database: 'database',
  'aroma-threshold': 'search',
  'data-processing': 'processing',
  'shimadzu-analysis': 'processing',
  'data-analysis': 'analysis',
  'ai-models': 'models',
  'ai-assistant': 'assistant',
  resources: 'resources',
  login: 'login',
});

export function parsePlatformRoute(pathname) {
  const segments = String(pathname ?? '').split('/').filter(Boolean);
  if (segments.includes('data-processing') || segments.includes('shimadzu-analysis')) return 'processing';
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

export function navigatePlatformRoute(route, { basePath = '', history = window.history, context = null } = {}) {
  const params = new URLSearchParams();
  if (route === 'assistant' && context?.cas && /^\d{2,7}-\d{2}-\d$/.test(context.cas)) params.set('cas', context.cas);
  if (route === 'assistant' && context?.task_id && /^[0-9a-f-]{36}$/i.test(context.task_id)) params.set('task_id', context.task_id);
  const query = params.toString();
  history.pushState({ route }, '', `${routeHref(route, basePath)}${query ? `?${query}` : ''}`);
}

export function subscribeToPlatformPopstate(onRouteChange, target = window) {
  const handlePopstate = () => {
    onRouteChange(parsePlatformRoute(target.location.pathname));
  };

  target.addEventListener('popstate', handlePopstate);
  return () => target.removeEventListener('popstate', handlePopstate);
}
