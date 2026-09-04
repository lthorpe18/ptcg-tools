(function(global){
  'use strict';

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
  function printLabel(card){return [card?.set,card?.number].filter(Boolean).join(' ')}
  function thumbnailMarkup(card,options={}){
    const url=imageUrl(card),loading=options.loading==='eager'?'eager':'lazy',className=String(options.className||'').trim();
    return `<span class="ptcg-card-thumb${className?` ${esc(className)}`:''}" data-card-thumb>${url?`<img src="${esc(url)}" alt="${esc(card?.name||'Card')}" loading="${loading}" decoding="async">`:''}<span class="ptcg-card-thumb-fallback" aria-hidden="true">No art</span></span>`;
  }
  function bindFallback(root=document){
    if(!root||root.__ptcgCardImagesBound)return;
    root.__ptcgCardImagesBound=true;
    root.addEventListener('error',event=>{
      const image=event.target;
      if(!(image instanceof HTMLImageElement))return;
      const thumb=image.closest?.('[data-card-thumb]');
      if(!thumb)return;
      thumb.classList.add('is-missing');
      image.hidden=true;
    },true);
  }

  global.PTCGCardImages={setCode,cardNumber,imageUrl,printLabel,thumbnailMarkup,bindFallback};
})(window);
