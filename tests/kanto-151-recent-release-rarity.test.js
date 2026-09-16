const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Kanto recent-release overlay supplies missing MEP 101 Nidorina without duplicating upstream rows',async()=>{
  const source=read('recent-release-cards.js');
  let upstreamRows=[{id:'old-nidorina',name:'Nidorina',localId:'40',category:'Pokemon',rarity:'Uncommon'}];
  const catalog={
    searchAdvanced:async()=>upstreamRows,
    card:async id=>{throw new Error(`missing ${id}`);}
  };
  const window={PTCGCardCatalog:catalog};
  vm.runInNewContext(source,{window,String,Map});

  let rows=await catalog.searchAdvanced({name:'Nidorina',category:'Pokemon'});
  const promo=rows.find(card=>card.id==='mep-101');
  assert.ok(promo,'MEP 101 is added when upstream is missing it');
  assert.equal(promo.localId,'101');
  assert.equal(promo.rarity,'Promo');
  assert.equal(promo._kantoSortRarity,'Illustration Rare');
  assert.equal(promo.illustrator,'Taiga Kasai');
  assert.match(promo.image,/30th_EN_101\.webp#$/);

  const detail=await catalog.card('mep-101');
  assert.equal(detail.name,'Nidorina');

  upstreamRows=[{...promo,image:'upstream-image'}];
  rows=await catalog.searchAdvanced({name:'Nidorina',category:'Pokemon'});
  assert.equal(rows.filter(card=>card.id==='mep-101').length,1,'upstream row wins once TCGdex catches up');
  assert.equal(rows.find(card=>card.id==='mep-101').image,'upstream-image');
});

test('Kanto recent-release overlay respects Standard-only filtering',async()=>{
  const source=read('recent-release-cards.js');
  const catalog={searchAdvanced:async()=>[],card:async()=>null};
  const window={PTCGCardCatalog:catalog};
  vm.runInNewContext(source,{window,String,Map});
  const rows=await catalog.searchAdvanced({name:'Nidorina',category:'Pokemon',standardOnly:true});
  assert.equal(rows.length,0);
});

test('Kanto rarity sorting puts illustration/full-art tiers ahead of ordinary rarities and stays stable within a tier',async()=>{
  const source=read('rarity-sort.js');
  const catalog={searchAdvanced:async()=>[
    {id:'common',rarity:'Common'},
    {id:'promo',rarity:'Promo'},
    {id:'ultra-1',rarity:'Ultra Rare'},
    {id:'nidorina',rarity:'Promo',_kantoSortRarity:'Illustration Rare'},
    {id:'sir',rarity:'Special Illustration Rare'},
    {id:'ultra-2',rarity:'Ultra Rare'}
  ]};
  const window={PTCGCardCatalog:catalog};
  vm.runInNewContext(source,{window,String});
  const rows=await catalog.searchAdvanced({name:'Nidorina'});
  assert.deepEqual(rows.map(card=>card.id),['sir','nidorina','ultra-1','ultra-2','promo','common']);
  assert.ok(window.PTCGKantoRaritySort.rarityRank({rarity:'Ultra Rare'})>window.PTCGKantoRaritySort.rarityRank({rarity:'Rare Holo'}));
});

test('Kanto loads release overlay before filters and rarity sort before app search',()=>{
  const html=read('index.html');
  const order=[
    './recent-release-cards.js',
    './set-code-identity.js',
    './card-number-filter.js',
    './rarity-sort.js',
    './app.js'
  ].map(src=>html.indexOf(`<script src="${src}"></script>`));
  assert.ok(order.every(index=>index>=0));
  assert.deepEqual([...order].sort((a,b)=>a-b),order);
});
