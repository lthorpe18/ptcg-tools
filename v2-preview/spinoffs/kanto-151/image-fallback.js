(function(){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';
  const catalog=window.PTCGCardCatalog;
  const images=window.PTCGCardImages;
  if(!catalog||!images?.resolve)return;

  const resolving=new WeakMap();
  const resolvedByCard=new Map();

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }

  function resolveKey(card,quality){
    const id=String(card?.id||'').trim();
    return id?`${id}:${quality==='high'?'high':'low'}`:'';
  }

  async function resolveCard(card,quality='low'){
    const key=resolveKey(card,quality);
    if(key&&resolvedByCard.has(key))return resolvedByCard.get(key);
    const promise=images.resolve(card,{catalog,quality});
    if(key)resolvedByCard.set(key,promise);
    try{
      const resolved=await promise;
      if(key)resolvedByCard.set(key,resolved);
      return resolved;
    }catch(error){
      if(key)resolvedByCard.delete(key);
      throw error;
    }
  }

  async function resolveInto(img,card,quality='low',fallbackNode=null){
    if(!img||!card)return false;
    const token={};
    resolving.set(img,token);
    try{
      const resolved=await resolveCard(card,quality);
      if(resolving.get(img)!==token)return false;
      if(!resolved?.primary){
        if(img.dataset.kantoCreated==='1')img.remove();
        return false;
      }

      const currentSrc=String(img.getAttribute('src')||'').trim();
      const brokenExisting=Boolean(currentSrc&&img.complete&&img.naturalWidth===0);
      const needsResolvedSource=img.dataset.kantoCreated==='1'||!currentSrc||brokenExisting;

      if(needsResolvedSource)img.src=resolved.primary;
      img.hidden=false;
      fallbackNode?.remove?.();
      return true;
    }catch{
      if(img.dataset.kantoCreated==='1')img.remove();
      return false;
    }
  }

  function ensureImage(container,className,alt){
    let img=container?.querySelector?.('img');
    if(img){
      if(className==='slot-art')img.loading='eager';
      return img;
    }
    if(!container)return null;
    img=document.createElement('img');
    img.className=className||'';
    img.alt=alt||'';
    img.loading=className==='slot-art'?'eager':'lazy';
    img.decoding='async';
    img.hidden=true;
    img.dataset.kantoCreated='1';
    const overlay=container.querySelector?.('.slot-overlay');
    if(overlay)container.insertBefore(img,overlay);
    else container.prepend(img);
    return img;
  }

  async function hydrateSearchCard(article){
    if(!article||article.dataset.kantoImageResolved==='1'||article.dataset.kantoImageResolving==='1')return;
    const id=String(article.dataset.cardId||'').trim();
    if(!id)return;
    article.dataset.kantoImageResolving='1';
    try{
      const card=await catalog.card(id);
      if(!card)return;
      const button=article.querySelector('.preview-button');
      const fallback=button?.querySelector('.slot-fallback')||null;
      const img=ensureImage(button,'',card.name||'Card');
      if(!img)return;
      const ok=await resolveInto(img,card,'low',fallback);
      if(ok)article.dataset.kantoImageResolved='1';
    }catch{}
    finally{delete article.dataset.kantoImageResolving;}
  }

  async function hydrateSlot(slot,state){
    if(!slot||slot.dataset.kantoImageResolved==='1'||slot.dataset.kantoImageResolving==='1')return;
    const number=String(slot.dataset.number||'').trim();
    const card=state?.[number]?.card;
    if(!card?.id)return;
    slot.dataset.kantoImageResolving='1';
    try{
      const button=slot.querySelector('.slot-main');
      const fallback=button?.querySelector('.slot-fallback')||null;
      const img=ensureImage(button,'slot-art',`${card.name||'Pokémon'} card art`);
      if(!img)return;
      const ok=await resolveInto(img,card,'low',fallback);
      if(ok)slot.dataset.kantoImageResolved='1';
    }catch{}
    finally{delete slot.dataset.kantoImageResolving;}
  }

  function hydrate(root=document){
    if(!root?.querySelectorAll)return;
    const state=loadState();
    root.querySelectorAll('.search-card[data-card-id]').forEach(hydrateSearchCard);
    root.querySelectorAll('.dex-slot[data-number]').forEach(slot=>hydrateSlot(slot,state));
    if(root.matches?.('.search-card[data-card-id]'))hydrateSearchCard(root);
    if(root.matches?.('.dex-slot[data-number]'))hydrateSlot(root,state);
  }

  const observer=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType===Node.ELEMENT_NODE)hydrate(node);
    }));
  });
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',async event=>{
    const trigger=event.target.closest?.('[data-preview-card]');
    if(!trigger)return;
    const id=String(trigger.dataset.previewCard||'').trim();
    if(!id)return;
    try{
      const card=await catalog.card(id);
      const img=document.getElementById('zoom-image');
      if(img&&card)await resolveInto(img,card,'high');
    }catch{}
  });

  hydrate();
})();
