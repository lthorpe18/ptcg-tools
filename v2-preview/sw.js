const CACHE_NAME = 'ptcg-tools-v1';
const CORE = [
  './',
  './apps/meta/',
  './apps/decklists/',
  './apps/events/',
  './apps/tools/',
  './apps/_shared/app-shell.css',
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
