const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function routerHarness(initial = 'https://example.test/ptcg-tools/v2-preview/apps/meta/', embedded = false) {
  class Classes {
    constructor(values = []) { this.values = new Set(values); }
    toggle(name, force) { force ? this.values.add(name) : this.values.delete(name); }
    contains(name) { return this.values.has(name); }
  }
  const ids = ['currentMetaPage', 'prep', 'matchups', 'decks', 'deckDetail'];
  const elements = Object.fromEntries(ids.map((id, index) => [id, {
    id,
    classList: new Classes(index ? ['hidden'] : []),
    hidden: index > 0,
    inert: index > 0,
    setAttribute(name) { if (name === 'inert') this.inert = true; },
    removeAttribute(name) { if (name === 'inert') this.inert = false; },
  }]));
  const listeners = new Map();
  const location = { href: initial, origin: new URL(initial).origin };
  const historyCalls = [];
  const parentMessages = [];
  const updateLocation = value => { location.href = new URL(value, location.href).href; };
  const document = {
    body: { dataset: {} },
    getElementById: id => elements[id] || null,
    querySelectorAll: () => [],
  };
  const window = {
    parent: null,
    MetaHome: { render() {} },
    MetaExplore: { renderDeckExplorer() {}, renderMatchups() {}, showDetail() {} },
    MetaControls: { sync() {} },
    MetaContext: { render() {} },
    addEventListener(type, fn) { listeners.set(type, fn); },
    dispatchEvent() {},
    scrollTo() {},
  };
  window.parent = embedded ? { postMessage(message, origin) { parentMessages.push({ message, origin }); } } : window;
  const context = vm.createContext({
    URL,
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    document,
    location,
    window,
    history: {
      pushState(state, title, url) { historyCalls.push({ mode:'push', state, url:String(url) }); updateLocation(url); },
      replaceState(state, title, url) { historyCalls.push({ mode:'replace', state, url:String(url) }); updateLocation(url); },
    },
  });
  vm.runInContext(read('v2-preview/apps/meta/meta-router.js'), context);
  return { router:window.MetaRouter, elements, document, historyCalls, parentMessages, location };
}

function activeViews(harness) {
  return Object.values(harness.elements).filter(element => !element.hidden && !element.classList.contains('hidden'));
}

test('MetaRouter makes every Meta route mutually exclusive', () => {
  const harness = routerHarness();
  for (const view of ['current', 'prep', 'matchups', 'decks']) {
    harness.router.navigate(view, { history:false });
    assert.equal(harness.document.body.dataset.metaActiveView, view);
    assert.deepEqual(activeViews(harness).map(element => element.id), [view === 'current' ? 'currentMetaPage' : view]);
  }
  harness.router.openDetail('Dragapult ex', 'online', 'decks');
  assert.equal(harness.document.body.dataset.metaActiveView, 'detail');
  assert.deepEqual(activeViews(harness).map(element => element.id), ['deckDetail']);
});

test('detail source replacement remains detail and does not push history', () => {
  const harness = routerHarness();
  harness.router.openDetail('Dragapult ex', 'online', 'decks');
  const pushes = harness.historyCalls.filter(call => call.mode === 'push').length;
  harness.router.replaceDetailSource('irl');
  assert.equal(harness.router.get().view, 'detail');
  assert.equal(harness.router.get().detail.source, 'irl');
  assert.equal(harness.historyCalls.filter(call => call.mode === 'push').length, pushes);
  assert.match(harness.location.href, /source=irl/);
  assert.match(harness.location.href, /#detail$/);
});

test('embedded Meta delegates history to the persistent shell', () => {
  const harness = routerHarness('https://example.test/ptcg-tools/v2-preview/apps/meta/', true);
  harness.router.navigate('decks');
  harness.router.openDetail('Dragapult ex', 'online');
  assert.equal(harness.historyCalls.length, 0);
  assert.deepEqual(harness.parentMessages.map(item => [item.message.type, item.message.mode]), [
    ['ptcg:shell-navigate', 'push'],
    ['ptcg:shell-navigate', 'push'],
  ]);
});

test('detail routes parse exact identity, evidence source and origin', () => {
  const harness = routerHarness();
  const parsed = harness.router.parse('/ptcg-tools/v2-preview/apps/meta/?deck=Charizard+ex&source=irl&from=matchups#detail');
  assert.equal(parsed.view, 'detail');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.detail)), {
    deckName:'Charizard ex', source:'irl', origin:'matchups',
  });
});

test('only the router owns Meta view and browser history state', () => {
  const home = read('v2-preview/apps/meta/meta-home.js');
  const explorer = read('v2-preview/apps/meta/meta-explorer-v3.js');
  const controls = read('v2-preview/apps/meta/meta-controls.js');
  const html = read('v2-preview/apps/meta/index.html');
  for (const source of [home, explorer, controls]) {
    assert.doesNotMatch(source, /data-meta-view|dataset\.metaView/);
    assert.doesNotMatch(source, /history\.(?:pushState|replaceState)|addEventListener\(['"](?:popstate|hashchange)/);
  }
  assert.match(html, /id="deckDetail"[^>]*hidden[^>]*inert/);
  assert.doesNotMatch(html, /meta-explorer-v2\.js|meta-results-v2\.js|meta-table\.js/);
  assert.doesNotMatch(html, /data-meta-view=/);
});

test('the shell owns embedded navigation history and reuses the Meta frame', () => {
  const shell = read('v2-preview/scripts/persistent-shell.js');
  assert.match(shell, /ptcg:shell-navigate/);
  assert.match(shell, /ptcg:shell-apply-route/);
  assert.match(shell, /section==='meta'&&loaded\.has\(section\)/);
  assert.doesNotMatch(shell, /ptcg:shell-route/);
});

test('the legacy Meta entry redirects into the one supported implementation', () => {
  const legacy = read('apps/meta/index.html');
  assert.match(legacy, /\.\.\/\.\.\/v2-preview\//);
  assert.match(legacy, /searchParams\.set\('section', 'meta'\)/);
  assert.match(legacy, /child\.hash = window\.location\.hash/);
  assert.equal(fs.readdirSync(path.join(root, 'apps/meta')).filter(name => name !== 'index.html').length, 0);
});

test('deck-detail matchup rows reserve the full two-sprite identity width', () => {
  const css = read('v2-preview/apps/meta/meta-explorer-v2.css');
  const html = read('v2-preview/apps/meta/index.html');
  assert.match(css, /\.matchup-opponent>\.deck-sprite-stack,\.matchup-opponent>\.deck-sprite\{flex:0 0 68px;min-width:68px;max-width:68px;overflow:visible\}/);
  assert.match(html, /meta-explorer-v2\.css\?v=8/);
});
