(function(global){
  'use strict';

  const catalog=global.PTCGCardCatalog;
  if(!catalog?.searchAdvanced||!catalog?.card)return;

  // Temporary release-day overlay for cards not yet present in TCGdex.
  // Canonical ids match the expected TCGdex ids, so upstream rows automatically win once available.
  const directImageRoot=url=>`${url}#`;
  const SET={id:'mep',name:'MEP Black Star Promos'};
  const RELEASED=[
    {
      id:'mep-096',name:'Moltres',localId:'096',category:'Pokemon',hp:120,stage:'Basic',rarity:'Promo',
      illustrator:'Krgc',regulationMark:'J',legal:{standard:false},set:SET,releaseDate:'2026-09-16',
      image:directImageRoot('https://bills-archive.nyc3.cdn.digitaloceanspaces.com/30th/MEP_EN_96.webp'),
      sourceUrl:'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase',_kantoRecent:true
    },
    {
      id:'mep-097',name:'Articuno',localId:'097',category:'Pokemon',hp:120,stage:'Basic',rarity:'Promo',
      illustrator:'Taira Akitsu',regulationMark:'J',legal:{standard:false},set:SET,releaseDate:'2026-09-16',
      image:directImageRoot('https://bills-archive.nyc3.cdn.digitaloceanspaces.com/30th/MEP_EN_97.webp'),
      sourceUrl:'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase',_kantoRecent:true
    },
    {
      id:'mep-098',name:'Zapdos',localId:'098',category:'Pokemon',hp:120,stage:'Basic',rarity:'Promo',
      illustrator:'SIE NANAHARA',regulationMark:'J',legal:{standard:false},set:SET,releaseDate:'2026-09-16',
      image:directImageRoot('https://bills-archive.nyc3.cdn.digitaloceanspaces.com/30th/MEP_EN_98.webp'),
      sourceUrl:'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase',_kantoRecent:true
    },
    {
      id:'mep-099',name:'Greninja ex',localId:'099',category:'Pokemon',hp:300,stage:'Stage2',rarity:'Promo',
      illustrator:'5ban Graphics',regulationMark:'J',legal:{standard:false},set:SET,releaseDate:'2026-09-16',
      image:directImageRoot('https://bills-archive.nyc3.cdn.digitaloceanspaces.com/30th/MEP_EN_99.webp'),
      sourceUrl:'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase',_kantoRecent:true
    },
    {
      id:'mep-100',name:'Sylveon ex',localId:'100',category:'Pokemon',hp:270,stage:'Stage1',rarity:'Promo',
      illustrator:'5ban Graphics',regulationMark:'J',legal:{standard:false},set:SET,releaseDate:'2026-09-16',
      image:directImageRoot('https://bills-archive.nyc3.cdn.digitaloceanspaces.com/30th/MEP_EN_100.webp'),
      sourceUrl:'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase',_kantoRecent:true
    },
    {
      id:'mep-101',name:'Nidorina',localId:'101',category:'Pokemon',hp:90,stage:'Stage1',rarity:'Promo',
      illustrator:'Taiga Kasai',regulationMark:'J',legal:{standard:false},set:SET,releaseDate:'2026-09-16',
      abilities:[{name:'Share Happiness'}],attacks:[{name:'Bite'}],
      image:directImageRoot('https://bills-archive.nyc3.cdn.digitaloceanspaces.com/30th/30th_EN_101.webp'),
      sourceUrl:'https://www.pokemon.com/uk/news/pokemon-tcg-30th-celebration-product-showcase',
      _kantoRecent:true,_kantoSortRarity:'Illustration Rare'
    }
  ];

  const byId=new Map(RELEASED.map(card=>[card.id,card]));
  const originalSearchAdvanced=catalog.searchAdvanced.bind(catalog);
  const originalCard=catalog.card.bind(catalog);

  function lower(value){return String(value||'').trim().toLocaleLowerCase('en');}
  function clone(card){return {...card,set:{...card.set},legal:{...(card.legal||{})}};}

  function matches(card,params={}){
    const name=lower(params.name);
    if(name&&!lower(card.name).includes(name))return false;
    if(params.category&&lower(card.category)!==lower(params.category))return false;
    if(params.regulationMark&&lower(card.regulationMark)!==lower(params.regulationMark))return false;
    if(params.illustrator&&!lower(card.illustrator).includes(lower(params.illustrator)))return false;
    if(params.rarity&&!lower(card.rarity).includes(lower(params.rarity)))return false;
    if(params.standardOnly&&card.legal?.standard!==true)return false;
    return true;
  }

  catalog.searchAdvanced=async function(params={}){
    let rows=[];
    let upstreamError=null;
    try{rows=[...(await originalSearchAdvanced(params)||[])];}catch(error){upstreamError=error;}

    const existing=new Set(rows.map(card=>String(card?.id||'').trim()).filter(Boolean));
    for(const card of RELEASED){
      if(!existing.has(card.id)&&matches(card,params))rows.push(clone(card));
    }

    if(!rows.length&&upstreamError)throw upstreamError;
    return rows;
  };

  catalog.card=async function(id){
    const key=String(id||'').trim();
    const recent=byId.get(key);
    if(!recent)return originalCard(id);
    try{
      const upstream=await originalCard(id);
      if(upstream)return upstream;
    }catch{}
    return clone(recent);
  };

  global.PTCGKantoRecentRelease={
    cards:RELEASED.map(clone),
    has:id=>byId.has(String(id||'').trim())
  };
})(window);
