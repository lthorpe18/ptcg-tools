import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { aggregateField, buildRelease, eventsForScope } from '../scripts/build-meta-release.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const data=relative=>JSON.parse(read(relative));
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');

test('browser release is complete, internally consistent and content addressed',()=>{
  const manifest=data('v2-preview/data/meta/release/manifest.json');
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.format,'TEF-PBL');
  assert.deepEqual(Object.keys(manifest.files).sort(),['core','irlMatchups','irlResults','onlineHistory','onlineMatchups','onlineResults'].sort());
  for(const file of Object.values(manifest.files)){
    const text=read(`v2-preview/data/meta/release/${file.path}`);
    const payload=JSON.parse(text);
    assert.equal(payload.release,manifest.release);
    assert.equal(payload.format,manifest.format);
    assert.equal(Buffer.byteLength(text),file.bytes);
    assert.equal(digest(text),file.sha256);
  }
});

test('core carries navigation field data but not heavy evidence',()=>{
  const core=data('v2-preview/data/meta/release/core.json');
  assert.ok(Buffer.byteLength(JSON.stringify(core))<250000);
  assert.deepEqual(Object.keys(core.online.scopes).sort(),['14','30','all','since-major'].sort());
  for(const scope of Object.values(core.online.scopes)){
    assert.ok(Array.isArray(scope.decks));
    assert.ok(Array.isArray(scope.events));
    assert.equal('archetypes' in (scope.events[0]||{}),false);
    assert.equal('matchups' in scope,false);
    assert.equal('results' in scope,false);
  }
  assert.equal('matchups' in core.irl,false);
  assert.equal('results' in core.irl,false);
});

test('precomputed Online scopes retain exact-variant field semantics',()=>{
  const online=data('data/meta/current-field.json');
  const core=data('v2-preview/data/meta/release/core.json');
  for(const scopeName of ['14','30','since-major','all']){
    const expected=aggregateField(eventsForScope(online,scopeName));
    const actual=core.online.scopes[scopeName];
    assert.equal(actual.overview.events,expected.overview.events,scopeName);
    assert.equal(actual.overview.entries,expected.overview.entries,scopeName);
    assert.deepEqual(actual.decks,expected.decks,scopeName);
  }
  assert.ok(core.online.scopes.all.decks.some(deck=>deck.name==='Dragapult Dusknoir'));
  assert.ok(core.online.scopes.all.decks.some(deck=>deck.name==='Dragapult Blaziken'));
});

test('release identity changes with source content even when timestamps do not',()=>{
  const online={generatedAt:'2026-01-01T00:00:00Z',majorWeekend:null,tournaments:[],matchupScopes:{all:{matchups:[]}}};
  const irl={generatedAt:'2026-01-01T00:00:00Z',events:[],decks:[],matchups:[],results:[]};
  const deckAggregate={generatedAt:'2026-01-01T00:00:00Z',decks:[],matchups:[],overview:{}};
  const onlineResults={generatedAt:'2026-01-01T00:00:00Z',results:[]};
  const first=buildRelease({online,irl,deckAggregate,onlineResults}).manifest.release;
  const second=buildRelease({online:{...online,label:'changed'},irl,deckAggregate,onlineResults}).manifest.release;
  assert.notEqual(first,second);
});

test('Home and Meta share one blended-field calculation',()=>{
  const context=vm.createContext({window:{},Date,Map,Math,Number,String,Array,Object,Set});
  vm.runInContext(read('v2-preview/apps/_shared/meta-blend.js'),context);
  const result=context.PTCGMetaBlend.currentFromCore(data('v2-preview/data/meta/release/core.json'),{now:new Date('2026-09-05T12:00:00Z')});
  assert.ok(result.rows.length>0);
  assert.ok(Math.abs(result.rows.reduce((sum,row)=>sum+row.share,0)-1)<1e-9);
  assert.ok(Math.abs(result.weights.irl+result.weights.online-1)<1e-9);
  const wrapper=read('v2-preview/apps/meta/blended-field.js');
  const home=read('v2-preview/scripts/home.js');
  assert.match(wrapper,/PTCGMetaBlend/);
  assert.match(home,/model\.currentFromCore/);
  assert.doesNotMatch(home,/contentWindow|parentMetaFrame/);
});

test('normal clients use prepared releases and no retired live ingestion layers',()=>{
  const html=read('v2-preview/apps/meta/index.html');
  const loader=read('v2-preview/apps/meta/meta-release-loader.js');
  const shell=read('v2-preview/scripts/persistent-shell.js');
  for(const retired of ['app.js','meta-engine.js','limitless.js','live.js','deck-aggregate.js','irl-labs.js']) assert.doesNotMatch(html,new RegExp(`(?:src=["'][^"']*)?${retired.replace('.','\\.')}`));
  assert.match(html,/meta-release-loader\.js/);
  assert.match(loader,/ptcg-meta-release-v2/);
  assert.match(loader,/checksum mismatch/);
  assert.match(loader,/last-known-good/);
  assert.doesNotMatch(shell,/setTimeout\([^)]*loadFrame|\bwarm\s*\(/s);
  const runtimeFiles=['v2-preview/apps/meta/meta-core.js','v2-preview/apps/meta/field-builder.js','v2-preview/apps/meta/prep.js','v2-preview/apps/meta/meta-explorer-v3.js'];
  for(const file of runtimeFiles){
    const source=read(file);
    assert.doesNotMatch(source,/play\.limitlesstcg\.com\/api/);
    assert.doesNotMatch(source,/\b(?:CACHE|DATA|DeckAggregate|IRLLabs)\b/);
  }
});

test('MetaData source and scope changes stay inside evidence state',async()=>{
  const core=data('v2-preview/data/meta/release/core.json');
  const files={
    onlineHistory:data('v2-preview/data/meta/release/online-history.json'),
    onlineMatchups:data('v2-preview/data/meta/release/online-matchups.json'),
    onlineResults:data('v2-preview/data/meta/release/online-results.json'),
    irlMatchups:data('v2-preview/data/meta/release/irl-matchups.json'),
    irlResults:data('v2-preview/data/meta/release/irl-results.json'),
  };
  const listeners=new Map(),events=[];
  const window={
    MetaRelease:{core:()=>core,ready:()=>Promise.resolve(core),load:key=>Promise.resolve(files[key]),refresh:()=>Promise.resolve(core)},
    addEventListener(type,fn){const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows)},
    dispatchEvent(event){events.push(event);for(const fn of listeners.get(event.type)||[])fn(event)},
  };
  const context=vm.createContext({window,document:{getElementById:()=>null},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},Date,Map,Set,Math,Number,String,Array,Object,Promise,console});
  vm.runInContext(read('v2-preview/apps/meta/meta-core.js'),context);
  await Promise.resolve();
  assert.ok(window.MetaData.data('online').decks.length>0);
  window.MetaState.setOnlineScope('14');
  assert.equal(window.MetaState.get().onlineScope,'14');
  assert.ok(window.MetaData.data('online').decks.length>0);
  await window.MetaData.ensure(['onlineMatchups','onlineResults']);
  assert.ok(window.MetaData.data('online').matchups.length>0);
  assert.ok(window.MetaData.data('online').results.length>0);
  window.MetaState.setIrlScope('all-irl');
  await window.MetaData.ensure(['irlMatchups','irlResults']);
  assert.ok(window.MetaData.data('irl').decks.length>0);
  assert.ok(window.MetaData.data('irl').matchups.length>0);
  assert.ok(events.every(event=>event.type==='meta:data-changed'));
});

test('release loader starts from validated local data when offline',async()=>{
  const manifestText=read('v2-preview/data/meta/release/manifest.json');
  const manifest=JSON.parse(manifestText);
  const coreText=read('v2-preview/data/meta/release/core.json');
  const stored=new Map(),local=new Map();
  const caches={open:async()=>({
    match:async key=>stored.has(String(key))?new Response(stored.get(String(key))):undefined,
    put:async(key,response)=>stored.set(String(key),await response.text()),
    keys:async()=>[...stored.keys()].map(url=>({url})),
    delete:async key=>stored.delete(String(key?.url||key)),
  })};
  const run=async online=>{
    const listeners=new Map();
    const window={PTCGFormatRuntime:{},addEventListener(type,fn){const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows)},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event)}};
    const fetch=async input=>{
      if(!online)throw new Error('offline');
      const url=String(input);
      if(url.includes('manifest.json'))return new Response(manifestText,{status:200,headers:{'Content-Type':'application/json'}});
      if(url.includes('core.json'))return new Response(coreText,{status:200,headers:{'Content-Type':'application/json'}});
      throw new Error(`unexpected ${url}`);
    };
    const context=vm.createContext({window,document:{currentScript:{src:'https://example.test/v2-preview/apps/meta/meta-release-loader.js?v=2'}},location:{href:'https://example.test/v2-preview/'},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},caches,fetch,URL,Response,TextEncoder,Uint8Array,CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},crypto:webcrypto,console});
    vm.runInContext(read('v2-preview/apps/meta/meta-release-loader.js'),context);
    return {window,payload:await window.MetaRelease.ready()};
  };
  const first=await run(true);
  assert.equal(first.payload.release,manifest.release);
  assert.ok(stored.size>0);
  const second=await run(false);
  assert.equal(second.payload.release,manifest.release);
  assert.equal(second.window.MetaRelease.manifest().release,manifest.release);
});