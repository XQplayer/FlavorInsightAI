import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8')
    .catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
}

const [mainSource, platformAppSource, databaseAppSource] = await Promise.all([
  readSource('./main.jsx'),
  readSource('./app/PlatformApp.jsx'),
  readSource('./App.jsx'),
]);

test('the entry renders PlatformApp without eagerly importing the database app', () => {
  assert.match(mainSource, /import PlatformApp from ['"]\.\/app\/PlatformApp\.jsx['"]/);
  assert.match(mainSource, /<PlatformApp\s*\/>/);
  assert.doesNotMatch(mainSource, /import App from ['"]\.\/App\.jsx['"]/);
});

test('PlatformApp owns history navigation and responds to browser popstate', () => {
  assert.match(platformAppSource, /navigatePlatformRoute\(nextRoute,/);
  assert.match(platformAppSource, /subscribeToPlatformPopstate\(setRoute\)/);
  assert.match(platformAppSource, /parsePlatformRoute\(window\.location\.pathname\)/);
});

test('PlatformApp keeps the homepage eager and mature workbenches behind lazy boundaries', () => {
  assert.match(platformAppSource, /import PlatformHomePage from ['"]\.\.\/pages\/PlatformHomePage\.jsx['"]/);
  assert.match(platformAppSource, /lazy\(\(\) => import\(['"]\.\.\/pages\/DatabaseOverviewPage\.jsx['"]\)\)/);
  assert.match(platformAppSource, /lazy\(\(\) => import\(['"]\.\.\/pages\/DataProcessingPage\.jsx['"]\)\)/);
  assert.match(platformAppSource, /<Suspense[\s\S]*fallback=\{<RouteLoading/);
  assert.match(platformAppSource, /role=['"]status['"][\s\S]*aria-live=['"]polite['"]/);
  assert.match(platformAppSource, /<PlatformPreferencesProvider>/);
  assert.match(platformAppSource, /<PlatformShell[\s\S]*route=\{route\}[\s\S]*onNavigate=\{navigate\}/);
});

test('each lazy route keeps its Suspense boundary inside a route error boundary', () => {
  const boundaries = [...platformAppSource.matchAll(
    /<RouteErrorBoundary\b[\s\S]*?<\/RouteErrorBoundary>/g,
  )].map(match => match[0]);

  assert.equal(boundaries.length, 2);
  assert.match(boundaries[0], /<Suspense[\s\S]*<DatabaseOverviewPage/);
  assert.match(boundaries[1], /<Suspense[\s\S]*<DataProcessingPage/);
  for (const boundary of boundaries) {
    assert.match(boundary, /routeKey=\{route\}/);
    assert.match(boundary, /language=\{language\}/);
    assert.match(boundary, /onNavigate=\{onNavigate\}/);
  }
});

test('the database app exposes the embedded controlled contract', () => {
  assert.match(databaseAppSource, /function App\(\{[\s\S]*initialView[\s\S]*embedded[\s\S]*language[\s\S]*onLanguageChange[\s\S]*onNavigate[\s\S]*\}\)/);
  assert.match(databaseAppSource, /embedded\s*\?/);
  assert.match(databaseAppSource, /typeof onNavigate === ['"]function['"]/);
  assert.match(databaseAppSource, /onLanguageChange/);
});
