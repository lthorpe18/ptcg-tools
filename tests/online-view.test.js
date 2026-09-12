const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  const nodes = {}, listeners = {}, timers = new Map(); let clock = Date.parse('2026-09-12T19:00:00Z'), calls = 0, fail = false, finish;
  const element = () => ({hidden:false,textContent:'',innerHTML:'',dataset:{},addEventListener(n,f){this[n]=f},setAttribute(){},insertAdjacentElement(_,e){nodes[e.id]=e}});
  for(const id of ['onlineFreshness','onlineList','onlineState','onlineRetry'])nodes[id]=element();
  const nav=element(); const classes=new Set();
  const document={readyState:'complete',hidden:false,body:{classList:{toggle(n,on){on?classes.add(n):classes.delete(n)}}},createElement:element,getElementById:id=>nodes[id],querySelector:()=>nav,addEventListener:(n,f)=>listeners[n]=f};
  const feed={schemaVersion:1,source:{provider:'limitless'},generatedAt:'2026-09-12T18:00:00Z',events:[{id:'future',name:'Future <event>',url:'https://play.limitlesstcg.com/tournament/abc/details',startAt:'2026-09-12T20:00:00Z'},{id:'past',name:'Past event',url:'https://play.limitlesstcg.com/tournament/def/details',startAt:'2026-09-12T18:00:00Z'}]};
  class Clock extends Date { static now(){return clock} }
  vm.runInNewContext(fs.readFileSync('v2-preview/apps/events/online.js','utf8'),{document,window:{addEventListener:(n,f)=>listeners[n]=f},location:{href:'https://example.test/v2-preview/apps/events/index.html',search:''},URL,URLSearchParams,Intl,Date:Clock,AbortController,setTimeout:f=>{timers.set(f,f);return f},clearTimeout:f=>timers.delete(f),fetch:()=>{calls++;return new Promise(resolve=>finish=()=>resolve({ok:!fail,json:async()=>feed}))}});
  return {nodes,feed,get calls(){return calls},select:view=>nav.click({target:{closest:()=>({dataset:{view}})}}),async resolve(){finish();await new Promise(r=>setImmediate(r))},fail(){fail=true},recover(){fail=false},advance(){clock+=7200000;listeners.pageshow()},classes};
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
