(function(global){
  'use strict';

  const fallbackByUrl=new Map();

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }
  function setCode(card){return String(card?.set||'').trim().toUpperCase()}
  function rawCardNumber(card){return String(card?.number??'').trim().toUpperCase().replace(/\s+/g,'')}
  function cardNumber(card){
    const raw=rawCardNumber(card),match=raw.match(/\d+/);
    return match?String(Number(match[0])).padStart(3,'0'):raw.padStart(3,'0');
  }
  function unique(values){return [...new Set((values||[]).filter(Boolean))]}
  function imageUrl(card){
    const set=setCode(card),number=cardNumber(card);
    return set&&number?`https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(number)}_R_EN.png`:'';
  }
  function limitlessUrls(card){
    const set=setCode(card),raw=rawCardNumber(card),padded=cardNumber(card);
    if(!set||(!raw&&!padded))return [];
    const numbers=unique([padded,raw]);
    const hosts=['https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com','https://limitlesstcg.nyc3.digitaloceanspaces.com'];
    return unique(hosts.flatMap(host=>numbers.map(number=>`${host}/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(number)}_R_EN.png`)));
  }
  function tcgdexUrl(card,quality='low',extension='webp'){
    const root=String(card?.image||'').trim();
    return root?`${root}/${quality==='high'?'high':'low'}.${extension}`:'';
  }
  function tcgdexUrls(root,quality='low'){
    root=String(root||'').trim().replace(/\/$/,'');
    if(!root)return [];
    const qualities=quality==='high'?['high','low']:['low','high'];
    const extensions=['webp','png','jpg'];
    return qualities.flatMap(item=>extensions.map(extension=>`${root}/${item}.${extension}`));
  }
  function registerFallbackChain(urls){
    const candidates=unique(urls);
    for(let index=0;index<candidates.length-1;index++)fallbackByUrl.set(candidates[index],candidates[index+1]);
    return candidates;
  }
  function registerFallback(primary,fallback){
    const candidates=registerFallbackChain([primary,fallback]);
    return candidates[0]||'';
  }
  async function derivedTcgdexRoot(source,catalog){
    const explicit=String(source?.image||'').trim();
    if(explicit)return explicit;
    const setId=String(source?.set?.id||'').trim();
    const localId=String(source?.localId??source?.number??'').trim();
    if(!setId||!localId||!catalog?.set)return '';
    try{
      const fullSet=await catalog.set(setId);
      const serie=String(fullSet?.serie?.id||'').trim();
      if(!serie)return '';
      return `https://assets.tcgdex.net/en/${encodeURIComponent(serie)}/${encodeURIComponent(setId)}/${encodeURIComponent(localId)}`;
    }catch{return ''}
  }
  async function resolve(card,options={}){
    const catalog=options.catalog||global.PTCGCardCatalog;
    const quality=options.quality==='high'?'high':'low';
    let source=card||null;
    if(source?.id&&(!source?.set||typeof source.set!=='object'||!source.localId||!source.image)&&catalog?.card){
      try{source=await catalog.card(source.id)||source}catch{}
    }
    if(catalog?.isPocketCard){
      try{if(await catalog.isPocketCard(source||card))return {primary:'',fallback:'',candidates:[],source:'excluded-pocket',card:source||card}}catch{}
    }

    let identity=null;
    if(source&&typeof source.set==='string'&&source.number){
      identity={set:source.set,number:source.number};
    }else if(source&&catalog?.exactDeckIdentity){
      try{identity=await catalog.exactDeckIdentity(source)}catch{}
    }

    const root=await derivedTcgdexRoot(source,catalog)||String(card?.image||'').trim();
    const candidates=registerFallbackChain([
      ...limitlessUrls(identity),
      ...tcgdexUrls(root,quality)
    ]);
    return {
      primary:candidates[0]||'',
      fallback:candidates[1]||'',
      candidates,
      source:candidates[0]?.includes('limitlesstcg')?'limitless':candidates[0]?.includes('tcgdex')?'tcgdex':'',
      card:source||card
    };
  }
  function printLabel(card){return [card?.set,card?.number].filter(Boolean).join(' ')}
  function thumbnailMarkup(card,options={}){
    const url=imageUrl(card),loading=options.loading==='eager'?'eager':'lazy',className=String(options.className||'').trim();
    return `<span class="ptcg-card-thumb${className?` ${esc(className)}`:''}" data-card-thumb>${url?`<img src="${esc(url)}" alt="${esc(card?.name||'Card')}" loading="${loading}" decoding="async">`:''}</span>`;
  }
  function bindFallback(root=document){
    if(!root||root.__ptcgCardImagesResolverBound)return;
    root.__ptcgCardImagesResolverBound=true;
    root.addEventListener('error',event=>{
      const image=event.target;
      if(typeof HTMLImageElement!=='undefined'&&!(image instanceof HTMLImageElement))return;
      if(!image||String(image.tagName||'').toUpperCase()!=='IMG')return;
      const current=image.currentSrc||image.src||'';
      const fallback=fallbackByUrl.get(current)||fallbackByUrl.get(image.src||'');
      if(fallback){
        image.src=fallback;
        return;
      }
      const searchTile=image.closest?.('.card-search-tile');
      if(searchTile){
        searchTile.remove?.();
        return;
      }
      const thumb=image.closest?.('[data-card-thumb]');
      if(thumb)thumb.remove?.();
    },true);
  }

  global.PTCGCardImages={setCode,rawCardNumber,cardNumber,imageUrl,limitlessUrls,tcgdexUrl,tcgdexUrls,resolve,registerFallback,registerFallbackChain,printLabel,thumbnailMarkup,bindFallback};
})(window);