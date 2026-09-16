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

test('Kanto image identity keeps alphanumeric card numbers intact so TG01 cannot resolve as set card 001',async()=>{
  const source=read('image-identity-fix.js');
  const wrong='https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/LOR/LOR_001_R_EN.png';
  const card={id:'swsh11tg-TG01',name:'Parasect',localId:'TG01',image:'https://wrong.example/oddish'};
  const catalog={
    searchAdvanced:async()=>[card],
    card:async()=>card,
    image:item=>item.image?`${item.image}/low.webp`:'',
    exactDeckIdentity:async()=>({set:'LOR',number:'TG01'})
  };
  const images={
    resolve:async item=>({primary:wrong,candidates:[wrong,'https://assets.tcgdex.net/en/swsh/swsh11tg/TG01/low.webp'],card:item}),
    registerFallbackChain:urls=>urls
  };
  const window={PTCGCardCatalog:catalog,PTCGCardImages:images};
  vm.runInNewContext(source,{window,String,Set,Map,encodeURIComponent});

  const rows=await catalog.searchAdvanced({name:'Parasect'});
  assert.equal(rows[0].image,'','untrusted TCGdex brief art is withheld for alphanumeric card numbers');
  assert.equal(catalog.image(rows[0],'low'),'');

  const resolved=await images.resolve(rows[0],{quality:'low'});
  assert.match(resolved.primary,/\/LOR\/LOR_TG1_R_EN\.png$/);
  assert.ok(!resolved.candidates[0].includes('LOR_001'));
  assert.deepEqual(Array.from(window.PTCGKantoImageIdentity.alphanumericVariants('TG01')),['TG1','TG01']);
});

test('Kanto image identity preserves ordinary numeric card image handling',async()=>{
  const source=read('image-identity-fix.js');
  const catalog={
    searchAdvanced:async()=>[{id:'lor-001',name:'Oddish',localId:'001',image:'https://correct.example/oddish'}],
    card:async()=>null,
    image:item=>`${item.image}/low.webp`,
    exactDeckIdentity:async()=>({set:'LOR',number:'001'})
  };
  const images={
    resolve:async item=>({primary:'numeric-ok',candidates:['numeric-ok'],card:item}),
    registerFallbackChain:urls=>urls
  };
  const window={PTCGCardCatalog:catalog,PTCGCardImages:images};
  vm.runInNewContext(source,{window,String,Set,Map,encodeURIComponent});
  const rows=await catalog.searchAdvanced({name:'Oddish'});
  assert.equal(rows[0].image,'https://correct.example/oddish');
  assert.equal(catalog.image(rows[0],'low'),'https://correct.example/oddish/low.webp');
  assert.equal((await images.resolve(rows[0])).primary,'numeric-ok');
});

test('Kanto loads release overlay and identity fixes before app search',()=>{
  const html=read('index.html');
  const order=[
    './recent-release-cards.js',
    './set-code-identity.js',
    './card-number-filter.js',
    './rarity-sort.js',
    '../../apps/_shared/card-images.js',
    './image-identity-fix.js',
    './app.js'
  ].map(src=>html.indexOf(`<script src="${src}"></script>`));
  assert.ok(order.every(index=>index>=0));
  assert.deepEqual([...order].sort((a,b)=>a-b),order);
});
