const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const core = require('../v2-preview/apps/_shared/format-registry-core.js');
const runtimeSource = read('v2-preview/apps/_shared/format-registry-runtime.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function runtimeHarness({ fetch, cached = null, timeoutMs = 25, autoRefresh = false, top = null } = {}) {
  const stored = new Map();
  if (cached) stored.set('ptcg-tools.format-registry-lkg.v1', JSON.stringify(cached));
  const eventHandlers = new Map();
  const dispatched = [];
  const location = { origin:'https://example.test', href:'https://example.test/v2-preview/' };
  const window = {
    PTCGFormatRegistryCore:core,
    __PTCG_FORMAT_RUNTIME_OPTIONS__:{ timeoutMs, refreshAfterMs:0, autoRefresh },
    location,
    localStorage:{
      getItem:key=>stored.get(key)||null,
      setItem:(key,value)=>stored.set(key,String(value)),
    },
    fetch:fetch||(()=>Promise.reject(new Error('offline'))),
    addEventListener(type,listener){const rows=eventHandlers.get(type)||[];rows.push(listener);eventHandlers.set(type,rows)},
    dispatchEvent(event){dispatched.push(event);for(const listener of eventHandlers.get(event.type)||[])listener(event)},
  };
  window.top = top || window;
  const context = vm.createContext({
    window, console, URL, JSON, Object, Number, String, Array, Set, Map, Date,
    Promise, Error, TypeError, AbortController, CustomEvent:class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    setTimeout, clearTimeout,
  });
  vm.runInContext(runtimeSource, context);
  return { window, stored, eventHandlers, dispatched, runAgain:()=>vm.runInContext(runtimeSource, context) };
}

test('prepared registry resolves independent Online and IRL boundary dates', () => {
  const config = core.preparedConfig();
  const cases = [
    ['online','2026-03-25','TEF-ASC'],
    ['online','2026-03-26','TEF-POR'],
    ['irl','2026-04-09','TEF-ASC'],
    ['irl','2026-04-10','TEF-POR'],
    ['online','2026-05-21','TEF-CRI'],
    ['irl','2026-06-04','TEF-POR'],
    ['irl','2026-06-05','TEF-CRI'],
    ['online','2026-07-16','TEF-PBL'],
    ['irl','2026-07-30','TEF-CRI'],
    ['irl','2026-07-31','TEF-PBL'],
  ];
  for (const [channel,date,formatId] of cases) {
    assert.equal(core.resolveFormat(config,{channel,date}).formatId,formatId,`${channel} ${date}`);
  }
});

test('rotation changes the lower bound on the channel-specific legality date', () => {
  const config = clone(core.preparedConfig());
  config.registry.versionNumber = 3;
  config.registry.sets.push({
    setCode:'NEW',setTitle:'New Rotation',releaseOrder:19,
    onlineLegalDate:'2027-03-20',irlLegalDate:'2027-04-03',
    isRotationSet:true,rotationLowerSetCode:'POR',
  });
  assert.equal(core.resolveFormat(config,{channel:'online',date:'2027-03-19'}).formatId,'TEF-PBL');
  assert.equal(core.resolveFormat(config,{channel:'online',date:'2027-03-20'}).formatId,'POR-NEW');
  assert.equal(core.resolveFormat(config,{channel:'irl',date:'2027-04-02'}).formatId,'TEF-PBL');
  assert.equal(core.resolveFormat(config,{channel:'irl',date:'2027-04-03'}).formatId,'POR-NEW');
});

test('registry validation rejects malformed dates, duplicates and bad rotation bounds', () => {
  const badDate = clone(core.preparedConfig());
  badDate.registry.sets[13].onlineLegalDate = '2026-02-30';
  assert.throws(()=>core.normalizeConfig(badDate),/invalid-online-date/);
  const duplicate = clone(core.preparedConfig());
  duplicate.registry.sets[1].setCode = duplicate.registry.sets[0].setCode;
  assert.throws(()=>core.normalizeConfig(duplicate),/duplicate-set/);
  const rotation = clone(core.preparedConfig());
  rotation.registry.sets[13].rotationLowerSetCode = 'DLR';
  assert.throws(()=>core.normalizeConfig(rotation),/invalid-rotation-lower-set/);
  assert.equal(core.resolveFormat(core.preparedConfig(),{channel:'irl',date:'2026-02-30'}).reason,'invalid-date');
  assert.equal(core.resolveFormat(core.preparedConfig(),{channel:'paper',date:'2026-09-07'}).reason,'invalid-channel');
});

test('runtime is synchronously usable and repeated initialization preserves one owner', () => {
  const harness = runtimeHarness();
  const runtime = harness.window.PTCGFormatRegistry;
  assert.equal(runtime.isOwner,true);
  assert.equal(runtime.getState().phase,'prepared');
  assert.equal(runtime.resolveFormat({channel:'online',date:'2026-09-07'}).formatId,'TEF-PBL');
  const hookCount = [...harness.eventHandlers.values()].reduce((sum,rows)=>sum+rows.length,0);
  harness.runAgain();
  assert.equal(harness.window.PTCGFormatRegistry,runtime);
  assert.equal([...harness.eventHandlers.values()].reduce((sum,rows)=>sum+rows.length,0),hookCount);
});

test('concurrent refresh calls share one request and install one validated newer snapshot', async () => {
  let calls = 0, resolveFetch;
  const response = new Promise(resolve=>{resolveFetch=resolve});
  const harness = runtimeHarness({fetch:()=>{calls+=1;return response}});
  const runtime = harness.window.PTCGFormatRegistry;
  const first = runtime.refresh({reason:'test'});
  const second = runtime.refresh({reason:'duplicate'});
  assert.equal(first,second);
  assert.equal(calls,1);
  const live = clone(core.preparedConfig());
  live.registry.versionNumber = 3;
  live.registry.publishedAt = '2026-09-07T10:00:00Z';
  resolveFetch({ok:true,json:async()=>live});
  const state = await first;
  assert.equal(state.phase,'live');
  assert.equal(state.registryVersion,3);
  assert.equal(calls,1);
  assert.ok(harness.stored.has('ptcg-tools.format-registry-lkg.v1'));
  assert.equal(harness.dispatched.filter(event=>event.type==='ptcg:format-state-changed').length,1);
});

test('a forever-pending refresh aborts and settles to usable degraded state', async () => {
  const harness = runtimeHarness({
    timeoutMs:5,
    fetch:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{
      const error=new Error('aborted');error.name='AbortError';reject(error);
    })),
  });
  const state = await harness.window.PTCGFormatRegistry.refresh();
  assert.equal(state.phase,'degraded');
  assert.equal(state.errorCode,'timeout');
  assert.equal(harness.window.PTCGFormatRegistry.resolveFormat({channel:'irl',date:'2026-09-07'}).formatId,'TEF-PBL');
});

test('offline startup promotes only a valid newer last-known-good snapshot', () => {
  const config = clone(core.preparedConfig());
  config.registry.versionNumber = 3;
  const cached = {config,fingerprint:core.fingerprint(config),confirmedAt:'2026-09-07T10:00:00Z'};
  const accepted = runtimeHarness({cached});
  assert.equal(accepted.window.PTCGFormatRegistry.getState().phase,'cached');
  assert.equal(accepted.window.PTCGFormatRegistry.getState().registryVersion,3);

  const corrupt = runtimeHarness({cached:{...cached,fingerprint:'wrong'}});
  assert.equal(corrupt.window.PTCGFormatRegistry.getState().phase,'prepared');
  assert.equal(corrupt.window.PTCGFormatRegistry.getState().registryVersion,2);
});

test('same-version conflicting remote data is rejected atomically', async () => {
  const conflict = clone(core.preparedConfig());
  conflict.registry.sets[0].setTitle = 'Changed after publication';
  const harness = runtimeHarness({fetch:async()=>({ok:true,json:async()=>conflict})});
  const state = await harness.window.PTCGFormatRegistry.refresh();
  assert.equal(state.phase,'degraded');
  assert.equal(state.errorCode,'integrity-conflict');
  assert.equal(state.registry.sets[0].setTitle,'Temporal Forces');
});

test('embedded documents use a facade and never start a second fetch', () => {
  let fetches = 0, subscriptions = 0;
  const owner = {
    isOwner:true,
    getState:()=>({phase:'live'}),
    resolveFormat:request=>request,
    refresh:()=>Promise.resolve(),
    subscribe:()=>{subscriptions+=1;return ()=>{subscriptions-=1}},
  };
  const top = {location:{origin:'https://example.test'},PTCGFormatRegistry:owner};
  const harness = runtimeHarness({top,fetch:()=>{fetches+=1;return Promise.reject(new Error('must not run'))}});
  const facade = harness.window.PTCGFormatRegistry;
  assert.equal(facade.isOwner,false);
  assert.deepEqual(facade.resolveFormat({channel:'irl'}),{channel:'irl'});
  const unsubscribe = facade.subscribe(()=>{});
  assert.equal(subscriptions,1);
  unsubscribe();
  assert.equal(subscriptions,0);
  assert.equal(fetches,0);
});

test('format assets are static, versioned and present in the service-worker core', () => {
  const ownerHtml = read('v2-preview/index.html');
  const metaHtml = read('v2-preview/apps/meta/index.html');
  const prepHtml = read('v2-preview/apps/events/prep.html');
  const settingsHtml = read('v2-preview/apps/settings/index.html');
  const serviceWorker = read('v2-preview/sw.js');
  for (const html of [ownerHtml,metaHtml,prepHtml,settingsHtml]) {
    assert.match(html,/format-registry-core\.js\?v=1/);
    assert.match(html,/format-registry-runtime\.js\?v=1/);
    assert.ok(html.indexOf('format-registry-core.js?v=1')<html.indexOf('format-registry-runtime.js?v=1'));
  }
  assert.match(serviceWorker,/format-registry-core\.js\?v=1/);
  assert.match(serviceWorker,/format-registry-runtime\.js\?v=1/);
  assert.doesNotMatch(runtimeSource,/createElement\(['"]script|MutationObserver|setInterval/);
});
