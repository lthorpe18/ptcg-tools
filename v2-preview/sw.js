const CACHE_NAME = 'ptcg-tools-v14';
const CORE = [
  './',
  './home-content.html',
  './apps/meta/',
  './apps/decklists/',
  './apps/events/',
  './apps/tools/',
  './apps/settings/',
  './perf-shell/shell.css?v=2',
  './scripts/persistent-shell.js?v=1',
  './apps/_shared/app-shell.css',
  './apps/_shared/app-shell.js?v=7',
  './apps/_shared/auth-ui.css?v=1',
  './apps/_shared/auth-ui.js?v=4',
  './apps/_shared/cloud-sync.js?v=6',
  './apps/_shared/deckParser.js?v=2',
  './apps/_shared/deck-store.js?v=5',
  './apps/_shared/archetype-catalog.js?v=1',
  './apps/_shared/storage.js?v=5',
  './apps/_shared/match-store.js?v=1',
  './apps/decklists/ptcgl-log-parser.js?v=1',
  './apps/decklists/training.js?v=2',
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
  return new Request(url.href, { method: 'GET', headers: { accept: 'text/html' } });
}

async function staleWhileRevalidate(request, cacheKey = request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey, { ignoreSearch: request.mode === 'navigate' });
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
  if (request.cache === 'no-store' || url.searchParams.has('v') && request.destination === '') return;
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, canonicalNavigationRequest(request)));
    return;
  }
  const isStatic = ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
  const isGeneratedData = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  if (isStatic || isGeneratedData) event.respondWith(staleWhileRevalidate(request));
});
