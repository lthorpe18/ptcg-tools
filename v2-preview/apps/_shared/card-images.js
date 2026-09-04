(function(global){
  'use strict';

  const fallbackByUrl=new Map();

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }
  function setCode(card){return String(card?.set||'').trim().toUpperCase()}
  function cardNumber(card){
    const raw=String(card?.number||'').trim(),match=raw.match(/\d+/);
    return match?String(Number(match[0])).padStart(3,'0'):raw.padStart(3,'0');
  }
  function imageUrl(card){
    const set=setCode(card),number=cardNumber(card);
    return set&&number?`https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(number)}_R_EN.png`:'';
  }
  function tcgdexUrl(card,quality='low'){
    const root=String(card?.image||'').trim();
    return root?`${root}/${quality==='high'?'high':'low'}.webp`:'';
  }
  function registerFallback(primary,fallback){
    if(primary&&fallback&&primary!==fallback)fallbackByUrl.set(primary,fallback);
    return primary||fallback||'';
  }
  async function resolve(card,options={}){
    const catalog=options.catalog||global.PTCGCardCatalog;
    const quality=options.quality==='high'?'high':'low';
    let source=card||null;
    if(source?.id&&(!source?.set||typeof source.set!=='object'||!source.localId)&&catalog?.card){
      try{source=await catalog.card(source.id)||source}catch{}
    }

    let exact='';
    if(source&&typeof source.set==='string'&&source.number){
      exact=imageUrl(source);
    }else if(source&&catalog?.exactDeckIdentity){
      try{
        const identity=await catalog.exactDeckIdentity(source);
        if(identity)exact=imageUrl({set:identity.set,number:identity.number});
      }catch{}
    }

    const fallback=tcgdexUrl(source,quality)||tcgdexUrl(card,quality);
    const primary=registerFallback(exact,fallback);
    return {primary,fallback:exact?fallback:'',source:exact?'limitless':'tcgdex'};
  }
  function printLabel(card){return [card?.set,card?.number].filter(Boolean).join(' ')}
  function thumbnailMarkup(card,options={}){
    const url=imageUrl(card),loading=options.loading==='eager'?'eager':'lazy',className=String(options.className||'').trim();
    return `<span class="ptcg-card-thumb${className?` ${esc(className)}`:''}" data-card-thumb>${url?`<img src="${esc(url)}" alt="${esc(card?.name||'Card')}" loading="${loading}" decoding="async">`:''}<span class="ptcg-card-thumb-fallback" aria-hidden="true">No art</span></span>`;
  }
  function bindFallback(root=document){
    if(!root||root.__ptcgCardImagesResolverBound)return;
    root.__ptcgCardImagesResolverBound=true;
    root.addEventListener('error',event=>{
      const image=event.target;
      if(!(image instanceof HTMLImageElement))return;
      const current=image.currentSrc||image.src||'';
      const fallback=fallbackByUrl.get(current)||fallbackByUrl.get(image.src||'');
      if(fallback&&image.dataset.ptcgFallbackTried!=='1'){
        image.dataset.ptcgFallbackTried='1';
        image.src=fallback;
        return;
      }
      const thumb=image.closest?.('[data-card-thumb]');
      if(!thumb)return;
      thumb.classList.add('is-missing');
      image.hidden=true;
    },true);
  }

  global.PTCGCardImages={setCode,cardNumber,imageUrl,tcgdexUrl,resolve,registerFallback,printLabel,thumbnailMarkup,bindFallback};
})(window);
