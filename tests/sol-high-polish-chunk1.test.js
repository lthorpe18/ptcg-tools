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

test('Card Search sorts newest releases first and uses image-only fallbacks',async()=>{
  const source=read('v2-preview/apps/decklists/deck-card-search-glc-fix.js');
  const imageSource=read('v2-preview/apps/_shared/card-images.js');

  assert.doesNotMatch(source,/card-search-art-fallback/);
  assert.doesNotMatch(imageSource,/>No art</);
  assert.match(imageSource,/const extensions=\['webp','png','jpg'\]/);
  assert.match(imageSource,/limitlesstcg\.nyc3\.cdn\.digitaloceanspaces\.com/);
  assert.match(imageSource,/assets\.tcgdex\.net\/en/);

  const format={value:'all',querySelector:()=>({}),appendChild(){}};
  const document={
    head:{appendChild(){}},
    getElementById:id=>id==='cardFilterFormat'?format:null,
    createElement:tag=>({tagName:String(tag).toUpperCase(),className:'',textContent:'',title:'',style:{}}),
    addEventListener(){},
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
});

test('Card catalog excludes every TCG Pocket set through the canonical tcgp series',async()=>{
  const source=read('v2-preview/apps/_shared/card-catalog.js');
  assert.match(source,/serie\('tcgp'\)/);
  assert.match(source,/withoutPocketCards/);

  const responses=new Map([
    ['https://api.tcgdex.net/v2/en/series/tcgp',{id:'tcgp',sets:[{id:'A1'},{id:'A2'}]}],
    ['https://api.tcgdex.net/v2/en/cards?name=Pikachu',[
      {id:'A1-001',localId:'001',name:'Pikachu'},
      {id:'sv01-025',localId:'025',name:'Pikachu',image:'https://assets.tcgdex.net/en/sv/sv01/025'}
    ]]
  ]);
  const fetch=async url=>({ok:responses.has(String(url)),status:responses.has(String(url))?200:404,json:async()=>responses.get(String(url))});
  const window={};
  const context=vm.createContext({window,fetch,URLSearchParams,Map,Set,Promise,String,Number,Array,Object,console});
  vm.runInContext(source,context);

  const results=await window.PTCGCardCatalog.searchAdvanced({name:'Pikachu'});
  assert.deepEqual(results.map(card=>card.id),['sv01-025']);
});
