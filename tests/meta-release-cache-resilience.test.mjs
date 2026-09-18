import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function loaderHarness(cacheBehaviour) {
  const manifestText = read('v2-preview/data/meta/release/manifest.json');
  const manifest = JSON.parse(manifestText);
  const fileText = new Map(
    Object.values(manifest.files).map(file => [
      '/v2-preview/data/meta/release/' + file.path,
      read('v2-preview/data/meta/release/' + file.path),
    ]),
  );
  const fetches = [];
  const cache = {
    match: async () => cacheBehaviour === 'read-hang' ? new Promise(() => {}) : undefined,
    put: async () => cacheBehaviour === 'write-hang' ? new Promise(() => {}) : undefined,
    keys: async () => [],
    delete: async () => true,
  };
  const caches = { open: async () => cache };
  const local = new Map();
  const listeners = new Map();
  const window = {
    addEventListener(type, fn) {
      const rows = listeners.get(type) || [];
      rows.push(fn);
      listeners.set(type, rows);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
    },
  };
  const fetch = async input => {
    const url = new URL(String(input));
    fetches.push(url.pathname);
    if (url.pathname.endsWith('/manifest.json')) {
      return new Response(manifestText, { status:200, headers:{ 'Content-Type':'application/json' } });
    }
    const text = fileText.get(url.pathname);
    if (text == null) throw new Error('Unexpected Meta URL: ' + url.pathname);
    return new Response(text, { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  const quickTimeout = (fn, ms, ...args) => setTimeout(fn, Math.min(ms, 10), ...args);
  const context = vm.createContext({
    window,
    document:{ currentScript:{ src:'https://example.test/v2-preview/apps/meta/meta-release-loader.js?v=6' } },
    location:{ href:'https://example.test/v2-preview/' },
    localStorage:{
      getItem:key => local.get(key) || null,
      setItem:(key,value) => local.set(key,value),
    },
    caches,
    fetch,
    URL,
    Response,
    TextEncoder,
    Uint8Array,
    CustomEvent:class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    crypto:webcrypto,
    console,
    AbortController,
    setTimeout:quickTimeout,
    clearTimeout,
  });
  vm.runInContext(read('v2-preview/apps/meta/meta-release-loader.js'), context);
  return { window, manifest, fetches };
}

test('lazy Meta evidence falls back to network when CacheStorage read stalls', async () => {
  const { window, manifest, fetches } = loaderHarness('read-hang');
  const core = await window.MetaRelease.ready();
  assert.equal(core.release, manifest.release);

  const evidence = await window.MetaRelease.load('onlineMatchups');
  assert.equal(evidence.release, manifest.release);
  assert.equal(evidence.format, manifest.files.onlineMatchups.format);
  assert.ok(fetches.some(pathname => pathname.endsWith('/online-matchups.json')));
});

test('Meta release activation and lazy evidence do not wait forever on CacheStorage writes', async () => {
  const { window, manifest } = loaderHarness('write-hang');
  const core = await window.MetaRelease.ready();
  assert.equal(core.release, manifest.release);

  const evidence = await window.MetaRelease.load('onlineResults');
  assert.equal(evidence.release, manifest.release);
  assert.equal(evidence.format, manifest.files.onlineResults.format);
  assert.ok(Array.isArray(evidence.results));
});
