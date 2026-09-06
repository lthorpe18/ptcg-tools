(() => {
  'use strict';

  const scriptBase = new URL('./', document.currentScript?.src || location.href);
  const BASE = new URL('../../data/meta/release/', scriptBase);
  const MANIFEST_URL = new URL('manifest.json', BASE);
  const CORE_URL = new URL('core.json', BASE);
  const CACHE_NAME = 'ptcg-meta-release-v1';
  const ACTIVE_KEY = 'ptcg:meta-release:active';
  const CORE_LKG_KEY = 'ptcg:meta-release:core-lkg';
  const KNOWN_FILES = {
    core:'core.json', onlineHistory:'online-history.json', onlineMatchups:'online-matchups.json', onlineResults:'online-results.json',
    irlMatchups:'irl-matchups.json', irlResults:'irl-results.json',
  };
  const memory = new Map();
  let activeManifest = null;
  let core = null;
  let readyResolve;
  const readyPromise = new Promise(resolve => { readyResolve = resolve; });
  let readySettled = false;

  const emit = (type, detail = {}) => window.dispatchEvent(new CustomEvent(type, { detail }));
  const cacheAvailable = () => typeof caches !== 'undefined';

  function validManifest(value) {
    return value?.schemaVersion === 1 && typeof value.release === 'string' && value.release.length >= 8 && value.files?.core?.path;
  }

  function validCore(value) {
    return value?.schemaVersion === 1 && typeof value.release === 'string' && value.release.length >= 8 && value.online?.scopes && value.irl;
  }

  function syntheticManifest(payload) {
    const files = {};
    for (const [key,path] of Object.entries(KNOWN_FILES)) files[key] = { path };
    return { schemaVersion:1, release:payload.release, format:payload.format, files };
  }

  function readActiveManifest() {
    try {
      const value = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
      return validManifest(value) ? value : null;
    } catch { return null; }
  }

  function readCoreLkg() {
    try {
      const value = JSON.parse(localStorage.getItem(CORE_LKG_KEY) || 'null');
      return validCore(value) ? value : null;
    } catch { return null; }
  }

  function storeCoreLkg(payload) {
    if (!validCore(payload)) return;
    try { localStorage.setItem(CORE_LKG_KEY, JSON.stringify(payload)); } catch {}
  }

  function cacheKey(manifest, key) {
    const url = new URL(manifest.files[key].path, BASE);
    url.searchParams.set('release', manifest.release);
    return url.href;
  }

  async function sha256(text) {
    if (!globalThis.crypto?.subtle) return '';
    const bytes = new TextEncoder().encode(text);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  async function decode(text, manifest, key) {
    const expected = manifest.files[key]?.sha256 || '';
    const actual = expected ? await sha256(text) : '';
    if (expected && actual && expected !== actual) throw new Error(`Meta ${key} checksum mismatch`);
    const payload = JSON.parse(text);
    if (payload?.schemaVersion !== 1 || payload?.release !== manifest.release || payload?.format !== manifest.format) {
      throw new Error(`Meta ${key} does not belong to release ${manifest.release}`);
    }
    return payload;
  }

  async function cachedText(manifest, key) {
    if (!cacheAvailable()) return null;
    const response = await (await caches.open(CACHE_NAME)).match(cacheKey(manifest, key));
    return response ? response.text() : null;
  }

  async function freshText(path) {
    const url = new URL(path, BASE);
    url.searchParams.set('_pt', Date.now().toString());
    const response = await fetch(url, { cache:'no-store', headers:{ Accept:'application/json' } });
    if (!response.ok) throw new Error(`Meta ${path} ${response.status}`);
    return response.text();
  }

  async function storeText(manifest, key, text) {
    if (!cacheAvailable()) return;
    const response = new Response(text, { headers:{ 'Content-Type':'application/json' } });
    await (await caches.open(CACHE_NAME)).put(cacheKey(manifest, key), response);
  }

  async function loadFile(key, manifest = activeManifest, options = {}) {
    if (!manifest?.files?.[key]) throw new Error(`Unknown Meta release file: ${key}`);
    const memoryKey = `${manifest.release}:${key}`;
    if (!options.network && memory.has(memoryKey)) return memory.get(memoryKey);
    const cached = options.network ? null : await cachedText(manifest, key);
    if (cached != null) {
      try {
        const payload = await decode(cached, manifest, key);
        memory.set(memoryKey, payload);
        return payload;
      } catch (error) {
        console.warn(`Cached Meta ${key} is invalid; replacing it.`, error);
      }
    }
    const text = await freshText(manifest.files[key].path);
    const payload = await decode(text, manifest, key);
    await storeText(manifest, key, text);
    memory.set(memoryKey, payload);
    return payload;
  }

  async function fetchManifest() {
    const url = new URL(MANIFEST_URL);
    url.searchParams.set('_pt', Date.now().toString());
    const response = await fetch(url, { cache:'no-store', headers:{ Accept:'application/json' } });
    if (!response.ok) throw new Error(`Meta manifest ${response.status}`);
    const manifest = await response.json();
    if (!validManifest(manifest)) throw new Error('Invalid Meta release manifest');
    return manifest;
  }

  async function loadDirectCore() {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      const options = { cache:'reload', headers:{ Accept:'application/json' } };
      if (controller) options.signal = controller.signal;
      const response = await fetch(CORE_URL, options);
      if (!response.ok) throw new Error(`Meta core ${response.status}`);
      const payload = await response.json();
      if (!validCore(payload)) throw new Error('Invalid Meta core');
      return payload;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function settleReady(value) {
    if (readySettled) return;
    readySettled = true;
    readyResolve(value);
  }

  function activate(manifest, payload, source) {
    activeManifest = validManifest(manifest) ? manifest : syntheticManifest(payload);
    core = payload;
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeManifest)); } catch {}
    storeCoreLkg(payload);
    settleReady(payload);
    emit('meta:release-core', { release:payload.release, source });
  }

  async function prune(keep) {
    if (!cacheAvailable()) return;
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    await Promise.all(keys.map(request => {
      const release = new URL(request.url).searchParams.get('release');
      return release && !keep.has(release) ? cache.delete(request) : null;
    }));
  }

  async function refresh() {
    const previous = activeManifest;
    const manifest = await fetchManifest();
    if (previous?.release === manifest.release && core?.release === manifest.release) {
      activeManifest = manifest;
      try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(manifest)); } catch {}
      emit('meta:release-current', { release:manifest.release });
      return core;
    }
    const payload = await loadFile('core', manifest, { network:true });
    activate(manifest, payload, previous ? 'updated' : 'network');
    await prune(new Set([manifest.release, previous?.release].filter(Boolean)));
    return payload;
  }

  async function bootstrap() {
    const cachedManifest = readActiveManifest();
    const lkg = readCoreLkg();

    if (lkg) activate(cachedManifest?.release === lkg.release ? cachedManifest : syntheticManifest(lkg), lkg, 'local-lkg');

    if (!core && cachedManifest) {
      try {
        const payload = await loadFile('core', cachedManifest);
        activate(cachedManifest, payload, 'cache');
      } catch (error) {
        console.warn('Cached Meta release is unavailable.', error);
      }
    }

    const refreshPromise = refresh().catch(error => {
      console.warn('Meta release refresh failed; retaining last-known-good data.', error);
      return null;
    });

    if (!core) {
      try {
        const payload = await loadDirectCore();
        activate(syntheticManifest(payload), payload, 'direct-core');
      } catch (error) {
        console.warn('Direct Meta core startup failed.', error);
      }
    }

    if (!core) await refreshPromise;

    if (!core) {
      settleReady(null);
      emit('meta:release-error', { message:'Meta data could not be loaded. Tap Refresh to retry.' });
      return;
    }

    await refreshPromise;
  }

  window.MetaRelease = {
    ready:() => readyPromise,
    core:() => core,
    manifest:() => activeManifest,
    load:key => loadFile(key),
    refresh,
  };
  bootstrap();
})();