const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  const nodes = {}, listeners = {}, timers = new Map(); let clock = Date.parse('2026-09-12T19:00:00Z'), calls = 0, fail = false, finish;
  const element = () => ({hidden:false,textContent:'',innerHTML:'',dataset:{},addEventListener(n,f){this[n]=f},setAttribute(){},insertAdjacentElement(_,e){nodes[e.id]=e}});
  for(const id of ['onlineFreshness','onlineList','onlineState','onlineRetry','onlineFormat','onlinePlatform','onlineFrom','onlineTo','onlineAllTimes'])nodes[id]=element();
  nodes.onlineFormat.value='standard';nodes.onlinePlatform.value='PTCGL';nodes.onlineFrom.value='17:00';nodes.onlineTo.value='22:00';
  const nav=element(); const classes=new Set();
  const document={readyState:'complete',hidden:false,body:{classList:{toggle(n,on){on?classes.add(n):classes.delete(n)}}},createElement:element,getElementById:id=>nodes[id],querySelector:()=>nav,addEventListener:(n,f)=>listeners[n]=f};
  const feed={schemaVersion:1,source:{provider:'limitless'},generatedAt:'2026-09-12T18:00:00Z',events:[{id:'future',format:'Standard',platform:'PTCGL',name:'Future <event>',url:'https://play.limitlesstcg.com/tournament/abc/details',startAt:'2026-09-12T20:00:00Z'},{id:'past',name:'Past event',url:'https://play.limitlesstcg.com/tournament/def/details',startAt:'2026-09-12T18:00:00Z'}]};
  class Clock extends Date { static now(){return clock} }
  const local = new Map(); const win = {addEventListener:(n,f)=>listeners[n]=f,dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync('v2-preview/apps/_shared/storage.js','utf8'), {window:win,localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},CustomEvent:class {},Date:Clock});
  vm.runInNewContext(fs.readFileSync('v2-preview/apps/events/online.js','utf8'),{document,window:win,location:{href:'https://example.test/v2-preview/apps/events/index.html',search:''},URL,URLSearchParams,Intl,Date:Clock,AbortController,setTimeout:f=>{timers.set(f,f);return f},clearTimeout:f=>timers.delete(f),fetch:()=>{calls++;return new Promise(resolve=>finish=()=>resolve({ok:!fail,json:async()=>feed}))}});
  return {nodes,feed,storage:win.PTCGStorage,get calls(){return calls},select:view=>nav.click({target:{closest:()=>({dataset:{view}})}}),async resolve(){finish();await new Promise(r=>setImmediate(r))},fail(){fail=true},recover(){fail=false},advance(){clock+=7200000;listeners.pageshow()},classes};
}
test('lazy loads once, survives tab switches, escapes names and removes started tournaments',async()=>{
  const h=harness();assert.equal(h.calls,0);h.select('nearby');assert.equal(h.calls,0);
  h.select('online');assert.equal(h.calls,1);assert.match(h.nodes.onlineState.textContent,/Loading/);
  h.select('majors');await h.resolve();assert.equal(h.nodes.onlinePanel.hidden,true);
  h.select('online');assert.equal(h.calls,1);assert.match(h.nodes.onlineList.innerHTML,/Future &lt;event&gt;/);assert.doesNotMatch(h.nodes.onlineList.innerHTML,/Past event/);
  for(const view of ['nearby','majors',undefined]){h.select(view);assert.equal(h.nodes.onlinePanel.hidden,true);h.select('online')}
  h.advance();assert.equal(h.nodes.onlineList.innerHTML,'');assert.match(h.nodes.onlineState.textContent,/No upcoming/);
});
test('error is retryable; malformed feed cannot become successful results',async()=>{
  const h=harness();h.fail();h.select('online');await h.resolve();assert.equal(h.nodes.onlineRetry.hidden,false);assert.match(h.nodes.onlineState.textContent,/could not be loaded/);
  h.recover();h.nodes.onlineRetry.click();await h.resolve();assert.match(h.nodes.onlineList.innerHTML,/Future/);
  const bad=harness();bad.feed.events[0].url='https://evil.test/';bad.select('online');await bad.resolve();assert.match(bad.nodes.onlineState.textContent,/could not be loaded/);assert.equal(bad.nodes.onlineList.innerHTML,'');
});
test('Standard PTCGL default, UK summer/winter hours, all-times and format overrides',async()=>{
 const h=harness(); const base=h.feed.events[0];
 h.feed.events=[base,{...base,id:'glc',name:'GLC event',format:'GLC'}, {...base,id:'cam',name:'Webcam event',platform:'CAM'}, {...base,id:'late',name:'Late event',startAt:'2026-09-13T22:00:00Z'}, {...base,id:'winter',name:'Winter boundary',startAt:'2026-12-13T22:00:00Z'}];
 h.select('online');await h.resolve();
 assert.match(h.nodes.onlineList.innerHTML,/Winter boundary/);assert.doesNotMatch(h.nodes.onlineList.innerHTML,/GLC event|Webcam event|Late event/);
 h.nodes.onlineFormat.value='all';h.nodes.onlinePlatform.value='all';h.nodes.onlineAllTimes.checked=true;h.nodes.onlineAllTimes.change();
 assert.match(h.nodes.onlineList.innerHTML,/format-glc/);assert.match(h.nodes.onlineList.innerHTML,/Webcam event/);assert.match(h.nodes.onlineList.innerHTML,/Late event/);
});
test('attendance uses durable shared participation, deduplicates, and links results after discovery expires',async()=>{
 const h=harness();h.select('online');await h.resolve();
 const click=()=>h.nodes.onlineList.click({target:{closest:()=>({dataset:{attend:'future'}})}});
 click();click();const rows=h.storage.allParticipations();assert.equal(rows.length,1);
 assert.equal(rows[0].attendanceStatus,'attending');assert.equal(rows[0].eventSnapshot.scope,'online');assert.equal(rows[0].eventSnapshot.startAt,'2026-09-12T20:00:00Z');assert.equal(rows[0].eventSnapshot.startTime,'21:00');assert.equal(rows[0].eventSnapshot.format,'Standard');assert.ok(rows[0].plannedDeckRef);
 assert.match(h.nodes.onlineList.innerHTML,/tournament-day.html\?participation=/);
 h.advance();assert.equal(h.nodes.onlineList.innerHTML,'');assert.equal(h.storage.allParticipations().length,1);
});
