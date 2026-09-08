import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {buildRelease} from '../scripts/build-meta-release.mjs';
import {calendar,classifyEvent,resolver} from '../scripts/meta-format-contract.mjs';
import formatResolver from '../v2-preview/apps/_shared/format-resolver.js';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const json=p=>JSON.parse(read(p));
// Entire 2030 calendar and every event below are SYNTHETIC, not factual seed dates.
const registry=structuredClone(calendar);registry.kind='synthetic';registry.revision='synthetic-meta-split';registry.baseline.asOf='2030-01-01';registry.sets[0].legality.online.value='2030-02-01';registry.sets[0].legality.irl.value='2030-02-10';
const rules=formatResolver.create(registry);
const event=(id,date)=>({id,name:'SYNTHETIC '+id,date,players:60,archetypes:[{name:'Synthetic Deck',entries:60,wins:5,losses:2,ties:1}]});
function onlineInput(format,date,id='synthetic-online') {
 const e=event(id,date),results=[{eventId:id,date,archetype:'Synthetic Deck',placing:1,player:'Synthetic player'}];
 return {online:{format,generatedAt:date,tournaments:[e],matchupScopes:{'14':{matchups:[]},'30':{matchups:[]},'since-major':{matchups:[]}},majorWeekend:null},deckAggregate:{format,decks:[],matchups:[],overview:{}},onlineResults:{format,events:[{...e,results}]}};
}
function irlInput(format='TEF-PBL',date='2030-01-28') {const e=event('synthetic-irl',date);return {irl:{format,generatedAt:date,events:[{...e,decks:e.archetypes}],decks:e.archetypes,matchups:[],results:[]}};}
function splitRelease(){return buildRelease({...onlineInput('TEF-30C','2030-02-02'),...irlInput(),archives:[{environment:'online',...onlineInput('TEF-PBL','2030-01-30','synthetic-old')}],asOf:'2030-02-02',registry});}

function loader(built,{stored=new Map(),local=new Map(),offline=false,mutate=null,hangBody=false}={}) {
 const listeners=new Map(),window={addEventListener:(k,fn)=>{listeners.set(k,[...(listeners.get(k)||[]),fn])},dispatchEvent:e=>(listeners.get(e.type)||[]).forEach(fn=>fn(e))};
 const texts=Object.fromEntries(Object.entries(built.files).map(([key,payload])=>[built.names[key],JSON.stringify(payload)]));texts['manifest.json']=JSON.stringify(built.manifest);
 const fetch=async input=>{if(hangBody)return new Response(new ReadableStream({start(){}}));if(offline)throw Error('synthetic offline');const path=new URL(input).pathname.split('/release/')[1];let text=texts[path];if(text==null)throw Error('Unexpected payload '+path);if(mutate)text=mutate(path,text);return new Response(text)};
 const caches={open:async()=>({match:async key=>stored.has(String(key))?new Response(stored.get(String(key))):null,put:async(key,r)=>stored.set(String(key),await r.text()),keys:async()=>[...stored.keys()].map(url=>({url})),delete:async key=>stored.delete(String(key.url||key))})};
 vm.runInNewContext(read('v2-preview/apps/meta/meta-release-loader.js'),{window,document:{currentScript:{src:'https://test.invalid/v2-preview/apps/meta/meta-release-loader.js'}},location:{href:'https://test.invalid/v2-preview/'},fetch,caches,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},URL,Response,crypto:webcrypto,TextEncoder,Uint8Array,AbortController,setTimeout:hangBody?((fn)=>setTimeout(fn,5)):setTimeout,clearTimeout,CustomEvent:class {constructor(type,{detail}={}){this.type=type;this.detail=detail}},console:{warn:()=>{}}});
 return {window,stored,local};
}
function metaData(built,load=key=>Promise.resolve(built.files[key])) {
 let core=built.files.core;const listeners=new Map();const window={MetaRelease:{core:()=>core,ready:()=>Promise.resolve(core),load},addEventListener:(key,fn)=>listeners.set(key,[...(listeners.get(key)||[]),fn]),dispatchEvent:event=>(listeners.get(event.type)||[]).forEach(fn=>fn(event))};
 vm.runInNewContext(read('v2-preview/apps/meta/meta-core.js'),{window,document:{getElementById:()=>null},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},console});
 return {window,replace:next=>{core=next;window.dispatchEvent({type:'meta:release-core'})}};
}

test('synthetic split classifies by event date/environment, not generation date',()=>{
 assert.equal(classifyEvent(event('a','2030-02-02'),'online','TEF-30C',rules).formatEvidence.basis,'maintained-calendar');
 assert.equal(classifyEvent(event('b','2030-02-02'),'irl','TEF-PBL',rules).format,'TEF-PBL');
 assert.throws(()=>classifyEvent(event('c','2030-02-02'),'online','TEF-PBL',rules),/not TEF-PBL/);
 assert.throws(()=>classifyEvent(event('d',''),'online','TEF-PBL',rules),/date/);
 const old=classifyEvent(event('old','2029-12-31'),'irl','TEF-PBL',rules);assert.equal(old.formatEvidence.contextId,null);assert.equal(old.formatEvidence.basis,'source-declared-history');
});
test('builder rejects mismatched source aggregate and event declarations',()=>{
 const args={...onlineInput('TEF-30C','2030-02-02'),...irlInput(),asOf:'2030-02-02',registry};
 assert.throws(()=>buildRelease({...args,deckAggregate:{...args.deckAggregate,format:'TEF-PBL'}}),/format mismatch/);
 args.online.tournaments[0].format='TEF-PBL';assert.throws(()=>buildRelease(args),/disagrees/);
});
test('split release retains old Online evidence separately and does not relabel IRL',()=>{
 const r=splitRelease();assert.equal(r.files.core.online.format,'TEF-30C');assert.equal(r.files.core.irl.format,'TEF-PBL');assert.equal(r.manifest.format,null);
 assert.equal(r.files['archive:online:TEF-PBL:History'].tournaments[0].id,'synthetic-old');
 assert.equal(r.files.onlineHistory.tournaments[0].id,'synthetic-online');
 assert.equal(r.files.core.currentFormats.irl.label,'TEF-PBL');
});
test('every synthetic split payload loads through real loader online and cached',async()=>{
 const built=splitRelease(),first=loader(built);await first.window.MetaRelease.ready();await first.window.MetaRelease.refresh();
 for(const key of Object.keys(built.files))assert.equal(JSON.stringify(await first.window.MetaRelease.load(key)),JSON.stringify(built.files[key]),key);
 const second=loader(built,{...first,offline:true});await second.window.MetaRelease.ready();
 for(const key of Object.keys(built.files))assert.equal(JSON.stringify(await second.window.MetaRelease.load(key)),JSON.stringify(built.files[key]),'cached '+key);
});
test('EVERY committed real release payload builds and loads online and cached',async()=>{
 const built=buildRelease({online:json('data/meta/current-field.json'),irl:json('data/meta/irl/TEF-PBL.json'),deckAggregate:json('data/meta/decks/TEF-PBL.json'),onlineResults:json('data/meta/online-results/TEF-PBL.json'),asOf:json('v2-preview/data/meta/release/manifest.json').formatDate});
 for(const [key,payload] of Object.entries(built.files))assert.equal(JSON.stringify(payload),read('v2-preview/data/meta/release/'+built.names[key]));
 const first=loader(built);await first.window.MetaRelease.ready();await first.window.MetaRelease.refresh();for(const key of Object.keys(built.files))await first.window.MetaRelease.load(key);
 const second=loader(built,{...first,offline:true});await second.window.MetaRelease.ready();for(const key of Object.keys(built.files))assert.equal((await second.window.MetaRelease.load(key)).release,built.manifest.release);
});
test('loader rejects wrong-format secondary payload even with a matching checksum',async()=>{
 const built=splitRelease();built.files.onlineResults.format='TEF-PBL';built.manifest.files.onlineResults.sha256=createHash('sha256').update(JSON.stringify(built.files.onlineResults)).digest('hex');
 const run=loader(built);await run.window.MetaRelease.ready();await run.window.MetaRelease.refresh();await assert.rejects(run.window.MetaRelease.load('onlineResults'),/does not belong/);
});
test('Meta scopes never leak results from an empty event selection',async()=>{
 const {window}=metaData(splitRelease());await window.MetaData.ensure('onlineResults');assert.equal(window.MetaData.data('online',{scope:'since-major'}).results.length,0);
 assert.equal(window.MetaData.data('online',{scope:'all'}).results.length,1);
});
test('archive selection replaces field/results and restores independently',async()=>{
 const {window}=metaData(splitRelease());window.MetaState.setFormat('online','TEF-PBL');await window.MetaData.ensure(['onlineHistory','onlineResults']);
 assert.equal(window.MetaData.data('online',{scope:'all'}).events[0].id,'synthetic-old');assert.equal(window.MetaData.sourceFormat('irl'),'TEF-PBL');
 window.MetaState.setFormat('online','TEF-30C');await window.MetaData.ensure('onlineResults');assert.equal(window.MetaData.data('online',{scope:'all'}).results[0].eventId,'synthetic-online');
});
test('late old-format evidence cannot overwrite a newer selection',async()=>{
 const built=splitRelease();let deliver;const {window}=metaData(built,key=>key==='onlineResults'?new Promise(resolve=>{deliver=()=>resolve(built.files[key])}):Promise.resolve(built.files[key]));
 const pending=window.MetaData.ensure('onlineResults');await new Promise(resolve=>setImmediate(resolve));window.MetaState.setFormat('online','TEF-PBL');deliver();await pending;assert.equal(window.MetaData.isLoaded('onlineResults'),false);
});

test('IRL event scope uses only that event matchup rows and empty scopes stay empty',async()=>{
 const args={...onlineInput('TEF-PBL','2030-01-29'),...irlInput(),asOf:'2030-01-30',registry};
 const a=args.irl.events[0];a.matchups=[{a:'A',b:'B',games:10,wins:6,losses:4,ties:0}];
 const b={...a,id:'synthetic-irl-2',date:'2030-01-20',matchups:[{a:'A',b:'B',games:20,wins:8,losses:12,ties:0}]};args.irl.events.push(b);args.irl.matchups=[{a:'A',b:'B',games:30,wins:14,losses:16,ties:0}];
 const {window}=metaData(buildRelease(args));await window.MetaData.ensure('irlMatchups');
 assert.equal(window.MetaData.data('irl',{scope:'event:synthetic-irl'}).matchups[0].games,10);
 assert.equal(window.MetaData.data('irl',{scope:'event:missing'}).matchups.length,0);
 assert.equal(window.MetaData.data('irl',{scope:'all-irl'}).matchups[0].games,30);
});
test('new-format empty evidence remains empty while archives retain their original labels',async()=>{
 const built=buildRelease({online:{format:'TEF-30C',tournaments:[],matchupScopes:{}},deckAggregate:{format:'TEF-30C'},onlineResults:{format:'TEF-30C'},irl:{format:'TEF-30C',events:[]},archives:[{environment:'online',...onlineInput('TEF-PBL','2030-01-30')},{environment:'irl',...irlInput()}],asOf:'2030-02-10',registry});
 const {window}=metaData(built);assert.equal(window.MetaData.data('online').decks.length,0);assert.equal(window.MetaData.data('irl').decks.length,0);
 assert.ok(built.files.core.archives.irl['TEF-PBL']);assert.equal(built.files.core.irl.format,'TEF-30C');
});
test('each secondary payload rejects an incompatible schema through the real loader',async()=>{
 for(const key of ['onlineHistory','onlineMatchups','onlineResults','irlMatchups','irlResults']) {
  const built=splitRelease();built.files[key].schemaVersion=99;built.manifest.files[key].sha256=createHash('sha256').update(JSON.stringify(built.files[key])).digest('hex');
  const run=loader(built);await run.window.MetaRelease.ready();await run.window.MetaRelease.refresh();await assert.rejects(run.window.MetaRelease.load(key),/does not belong/,key);
 }
});
test('old revision response cannot populate a newly activated release',async()=>{
 const built=splitRelease();let deliver;const h=metaData(built,key=>key==='onlineResults'?new Promise(resolve=>{deliver=()=>resolve(built.files[key])}):Promise.resolve(built.files[key]));
 const pending=h.window.MetaData.ensure('onlineResults');await new Promise(resolve=>setImmediate(resolve));h.replace({...structuredClone(built.files.core),release:'synthetic-next-revision'});deliver();await pending;assert.equal(h.window.MetaData.isLoaded('onlineResults'),false);
});

test('owner-maintained September schedule catches up outgoing Online without changing IRL early',async()=>{
 const {ingestionJobs}=await import('../scripts/meta-format-contract.mjs');
 const jobs=ingestionJobs('online','2026-09-15');
 assert.equal(jobs.length,2);assert.equal(jobs[0].format,'TEF-PBL');assert.equal(jobs[0].queryEnd,'2026-09-15');assert.equal(jobs[1].format,'TEF-30C');assert.equal(jobs[1].queryStart,'2026-09-15');
 assert.equal(ingestionJobs('irl','2026-09-15')[0].format,'TEF-PBL');
 assert.equal(ingestionJobs('online','2026-09-24').length,1);
});

test('an unavailable requested archive never silently substitutes current evidence',async()=>{
 const {window}=metaData(splitRelease());window.MetaState.setFormat('online','TEF-UNKNOWN');await window.MetaData.ensure('onlineResults');
 assert.equal(window.MetaData.sourceFormat('online'),'TEF-UNKNOWN');assert.equal(window.MetaData.data('online').decks.length,0);assert.equal(window.MetaData.data('online').results.length,0);
});

test('format label follows a source click even before the landing renderer updates active classes',()=>{
 const handlers={};const buttons=['online','irl'].map(source=>({dataset:{currentSource:source},addEventListener:(type,fn)=>{handlers[source]=fn}}));
 const label={textContent:''},select={dataset:{},value:'',addEventListener:()=>{}},control={hidden:true};
 const ids={metaFormatLabel:label,metaFormatSelect:select,metaFormatControl:control};
 const window={MetaState:{get:()=>({}),formatOptions:env=>[env==='online'?'TEF-30C':'TEF-PBL']},MetaData:{sourceFormat:env=>env==='online'?'TEF-30C':'TEF-PBL',currentFormat:env=>({label:env==='online'?'TEF-30C':'TEF-PBL'})},MetaRouter:{get:()=>({view:'current'})},addEventListener:()=>{}};
 const document={getElementById:id=>ids[id]||null,querySelector:()=>buttons[0],querySelectorAll:()=>buttons,addEventListener:()=>{},createElement:()=>({}),head:{appendChild:()=>{}}};
 vm.runInNewContext(read('v2-preview/apps/meta/meta-controls.js'),{window,document,setTimeout:()=>{}});
 handlers.irl();assert.equal(label.textContent,'IRL · TEF-PBL');handlers.online();assert.equal(label.textContent,'Online · TEF-30C');
});

test('startup settles unavailable when response headers arrive but the body never finishes',async()=>{
 const run=loader(splitRelease(),{hangBody:true});assert.equal(await run.window.MetaRelease.ready(),null);
});

test('a new aggregate query cannot stamp a new format onto an unacknowledged source response',async()=>{
 const {verifyAggregateQuery}=await import('../scripts/meta-format-contract.mjs');
 const request={format:'TEF-30C',set:'30C',rotation:2026};
 assert.throws(()=>verifyAggregateQuery('<h1>SYNTHETIC old data</h1>',request),/refusing to relabel/);
 assert.equal(verifyAggregateQuery('<select name="set"><option value="PBL">Old</option><option selected value="30C">Synthetic new</option></select><select name="rotation"><option value="2026" selected>2026</option></select>',request),'source-confirmed-query');
});
