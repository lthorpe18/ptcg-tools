const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A bounded DOM scheduler models the observed childList/text mutation feedback.
// Synthetic participation: no real account or tournament data is used.
function harness() {
  const observers = [], frames = [], listeners = {};
  let dirty = false, writes = 0;
  let participation = {id:'synthetic-participation', attendanceStatus:'attending'};
  class Element {
    constructor() { this.dataset = {}; this.children = []; this.classes = new Set(); this.text = ''; }
    classList = {add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)};
    set textContent(value) { this.text = value; dirty = true; writes++; }
    get textContent() { return this.text; }
    setAttribute(name,value) { this[name] = value; }
    insertBefore(node) { this.children.push(node); node.parent = this; dirty = true; }
    appendChild(node) { this.insertBefore(node); }
    remove() { this.parent.children = this.parent.children.filter(n=>n!==this); dirty = true; }
    querySelector(selector) { return selector==='[data-prep-link]' ? this.children.find(n=>n.dataset.prepLink) : null; }
  }
  const actions = new Element(), card = new Element(), title = new Element();
  title.text='Synthetic event'; card.dataset.eventId='synthetic-event'; card.classes.add('event-card');
  card.querySelector = selector => selector==='.event-actions'?actions:selector==='h2'?title:actions.querySelector(selector);
  const document = {
    body:new Element(), head:new Element(), readyState:'complete',
    createElement:()=>new Element(),
    getElementById:id=>id==='eventList'?card:null,
    querySelectorAll:selector=>selector==='.event-card'?[card]:[],
    addEventListener:()=>{},
  };
  const window = {PTCGStorage:{getParticipation:()=>participation,update:()=>{}},addEventListener:(name,fn)=>{(listeners[name] ||= []).push(fn)}};
  const context = vm.createContext({document,window,HTMLElement:Element,MutationObserver:class {constructor(fn){this.fn=fn}observe(){observers.push(this.fn)}},requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>frames.push(fn)});
  for (const file of ['prep-link.js','prep-entry-polish.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../v2-preview/apps/events',file),'utf8'),context);
  function settle() {
    for(let i=0;i<20;i++) {
      if(dirty){dirty=false;observers.forEach(fn=>fn());}
      if(!frames.length&&!dirty)return;
      const batch=frames.splice(0);batch.forEach(fn=>fn());
    }
    assert.fail('Event link updates never settle; navigation can be starved');
  }
  return {actions,settle,get writes(){return writes},emit:()=>listeners['ptcg:local-change'].forEach(fn=>fn()),status:value=>{participation.attendanceStatus=value},rename:value=>{title.text=value;dirty=true}};
}

test('attending event link settles and repeated notifications do not rewrite text',()=>{
  const h=harness();h.settle();
  assert.equal(h.actions.children.length,1);
  const link=h.actions.children[0];
  assert.equal(link.textContent,'Event Prep');
  assert.equal(link.href,'./prep.html?participation=synthetic-participation');
  assert.equal(link.classList.contains('prep-entry-prominent'),true);
  const writes=h.writes;
  for(let i=0;i<10;i++)h.emit();
  h.settle();assert.equal(h.writes,writes);
});
test('attendance changes remove and restore one Prep link without feedback',()=>{
  const h=harness();h.settle();h.status('attended');h.emit();h.settle();
  assert.equal(h.actions.children.length,0);assert.equal(h.actions.classList.contains('has-prep'),false);
  h.status('attending');h.emit();h.settle();assert.equal(h.actions.children.length,1);
});
test('event title changes update the accessible link label and settle',()=>{
  const h=harness();h.settle();h.rename('Renamed synthetic event');h.settle();
  assert.equal(h.actions.children[0]['aria-label'],'Open Event Prep for Renamed synthetic event');
});
