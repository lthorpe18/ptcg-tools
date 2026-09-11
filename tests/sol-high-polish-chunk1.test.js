const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('Home shows the current Online format while field surfaces default to Blended',()=>{
  const home=read('v2-preview/home-content.html');
  const homeJs=read('v2-preview/scripts/home.js');
  const metaHtml=read('v2-preview/apps/meta/index.html');
  const metaHome=read('v2-preview/apps/meta/meta-home.js');
  const prepField=read('v2-preview/apps/events/prep-field.js');

  assert.match(home,/id="formatPill"[^>]*>[\s\S]*?<span>Current format<\/span>/);
  assert.doesNotMatch(home,/id="formatPill"[^>]*>[\s\S]*?<span>Standard<\/span>/);
  assert.match(homeJs,/const onlineFormat=metaCore\?\.currentFormats\?\.online\?\.label\|\|metaCore\?\.online\?\.format/);
  assert.match(homeJs,/pillText\.textContent=onlineFormat\|\|'Current format'/);

  assert.match(metaHtml,/data-current-source="blend" class="active">Blended/);
  assert.match(metaHtml,/id="playFieldSource"><option value="blend" selected>Blended current field/);
  assert.match(metaHome,/const state = \{ source: 'blend'/);
  assert.match(metaHome,/setSource\('blend'\);/);
  assert.match(prepField,/name:'Suggested Blended'/);
});

test('Card Search sorts newest releases first and replaces terminal artwork failures',async()=>{
  const source=read('v2-preview/apps/decklists/deck-card-search-glc-fix.js');
  const css=read('v2-preview/apps/decklists/deck-card-search.css');
  assert.match(css,/\.card-search-art-fallback\{/);

  const listeners=new Map();
  const format={value:'all',querySelector:()=>({}),appendChild(){}};
  const document={
    head:{appendChild(){}},
    getElementById:id=>id==='cardFilterFormat'?format:null,
    createElement:tag=>({tagName:String(tag).toUpperCase(),className:'',textContent:'',title:'',style:{}}),
    addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list)},
  };
  const releases={new:'2026-09-01',mid:'2025-06-01',old:'2024-01-01'};
  const cards=[
    {id:'old-card',name:'Old',set:{id:'old'}},
    {id:'unknown-card',name:'Unknown'},
    {id:'new-card',name:'New',set:{id:'new'}},
    {id:'mid-card',name:'Mid',set:{id:'mid'}},
  ];
  const catalog={
    image:()=>'',cardText:()=>'',
    searchAdvanced:async()=>cards.slice(),
    set:async id=>({id,releaseDate:releases[id]||''}),
    card:async cardId=>cards.find(card=>card.id===cardId)||null,
    cards:async ids=>cards.filter(card=>ids.includes(card.id)),
  };
  const images={
    resolve:async card=>({primary:`art:${card.id}`,card}),
    bindFallback(){},
  };
  const context=vm.createContext({window:{PTCGCardCatalog:catalog,PTCGCardImages:images},document,console,setTimeout,queueMicrotask,Set,Map,Promise,String,Number,Array,Object});
  vm.runInContext(source,context);

  const sorted=await catalog.searchAdvanced({name:'anything'});
  assert.deepEqual(sorted.map(card=>card.id),['new-card','mid-card','old-card','unknown-card']);

  let fallback=null,removed=false,zoomRemoved=false;
  const tile={
    querySelector:()=>fallback,
    prepend(node){fallback=node},
    removeAttribute(name){if(name==='data-card-zoom')zoomRemoved=true},
  };
  const image={tagName:'IMG',src:'https://example.test/broken.webp',alt:'Missing Card · TEST 001',closest:selector=>selector==='.card-search-tile'?tile:null,remove(){removed=true}};
  for(const listener of listeners.get('error')||[])listener({target:image});
  await Promise.resolve();
  assert.equal(removed,true);
  assert.equal(zoomRemoved,true);
  assert.equal(fallback?.className,'card-search-art-fallback');
  assert.equal(fallback?.textContent,'Missing Card · TEST 001');
});
