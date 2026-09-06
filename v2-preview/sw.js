const CACHE_NAME = 'ptcg-tools-v24';
const CORE = [
  './',
  './home-content.html',
  './apps/meta/',
  './apps/decklists/',
  './apps/events/',
  './apps/tools/',
  './apps/settings/',
  './perf-shell/shell.css?v=2',
  './scripts/persistent-shell.js?v=6',
  './apps/_shared/app-shell.css',
  './apps/_shared/app-shell.js?v=8',
  './apps/_shared/auth-ui.css?v=1',
  './apps/_shared/auth-ui.js?v=4',
  './apps/_shared/cloud-sync.js?v=6',
  './apps/_shared/deckParser.js?v=2',
  './apps/_shared/deck-store.js?v=5',
  './apps/_shared/archetype-catalog.js?v=2',
  './apps/_shared/meta-field.js?v=1',
  './apps/_shared/meta-blend.js?v=2',
  './apps/_shared/recommendation-engine.js?v=1',
  './apps/_shared/storage.js?v=6',
  './apps/_shared/match-store.js?v=2',
  './apps/meta/meta-release-loader.js?v=3',
  './apps/meta/wsip-polish.css?v=2',
  './apps/meta/wsip-polish.js?v=2',
  './apps/meta/wsip-reset-polish.js?v=1',
  './apps/events/prep-link.js?v=4',
  './apps/events/prep-entry-polish.js?v=2',
  './apps/decklists/ptcgl-log-parser.js?v=1',
  './apps/decklists/training.js?v=2',
  './data/meta/release/manifest.json',
  './data/meta/release/core.json',
  './assets/apple-touch-icon.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('ptcg-tools-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function canonicalNavigationRequest(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return new Request(url.href, { method: 'GET', headers: { accept:'text/html' } });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const key = canonicalNavigationRequest(request);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(key, response.clone());
      return response;
    }
  } catch (_) {}
  return (await cache.match(key)) || Response.error();
}

async function staleWhileRevalidate(request, cacheKey = request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey);
  const network = fetch(request).then(response => {
    if (response && response.ok) cache.put(cacheKey, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.cache === 'no-store' || url.searchParams.has('v') || url.searchParams.has('_pt')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  const isStatic = ['script','style','image','font','manifest'].includes(request.destination);
  const isGeneratedData = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  if (isStatic || isGeneratedData) event.respondWith(staleWhileRevalidate(request));
});