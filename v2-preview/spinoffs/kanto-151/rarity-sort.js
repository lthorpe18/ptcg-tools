(function(global){
  'use strict';

  const catalog=global.PTCGCardCatalog;
  if(!catalog?.searchAdvanced)return;

  const originalSearchAdvanced=catalog.searchAdvanced.bind(catalog);

  function rarityRank(card){
    const text=String(card?._kantoSortRarity||card?.rarity||'').trim().toLocaleLowerCase('en');
    if(!text)return 0;
    if(text.includes('futuristic'))return 1200;
    if(text.includes('special illustration'))return 1150;
    if(text.includes('illustration'))return 1100;
    if(text.includes('hyper'))return 1050;
    if(text.includes('shiny ultra'))return 1025;
    if(text.includes('ultra'))return 1000;
    if(text.includes('secret'))return 950;
    if(text.includes('rainbow'))return 940;
    if(text.includes('shiny'))return 900;
    if(text.includes('radiant'))return 875;
    if(text.includes('amazing'))return 860;
    if(text.includes('ace spec'))return 850;
    if(text.includes('double'))return 800;
    if(text.includes('holo'))return 700;
    if(text.includes('promo'))return 650;
    if(text.includes('rare'))return 600;
    if(text.includes('uncommon'))return 300;
    if(text.includes('common'))return 200;
    return 100;
  }

  catalog.searchAdvanced=async function(params={}){
    const rows=await originalSearchAdvanced(params)||[];
    return rows
      .map((card,index)=>({card,index,rank:rarityRank(card)}))
      .sort((a,b)=>(b.rank-a.rank)||(a.index-b.index))
      .map(entry=>entry.card);
  };

  global.PTCGKantoRaritySort={rarityRank};
})(window);
