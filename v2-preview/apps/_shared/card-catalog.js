(function(){
  'use strict';

  const API='https://api.tcgdex.net/v2/en';
  const detailCache=new Map();
  const setCache=new Map();
  let setsPromise=null;

  function qs(params={}){
    const out=new URLSearchParams();
    const put=(key,value)=>{
      if(value===undefined||value===null||value==='')return;
      out.set(key,String(value));
    };
    put('name',params.name);
    put('category',params.category&&params.category!=='all'?`eq:${params.category}`:'');
    put('regulationMark',params.regulationMark?`eq:${params.regulationMark}`:'');
    put('rarity',params.rarity);
    put('stage',params.stage&&params.stage!=='all'?`eq:${params.stage}`:'');
    put('trainerType',params.trainerType&&params.trainerType!=='all'?`eq:${params.trainerType}`:'');
    put('types',params.type&&params.type!=='all'?`eq:${params.type}`:'');
    put('set.id',params.setId?`eq:${params.setId}`:'');
    if(params.standardOnly)put('legal.standard','eq:true');
    if(params.hpMin!=='')put('hp',`gte:${params.hpMin}`);
    if(params.hpMax!=='')put('hp',`lte:${params.hpMax}`);
    if(params.retreatMax!=='')put('retreat',`lte:${params.retreatMax}`);
    put('illustrator',params.illustrator);
    put('sort:field',params.sortField||'name');
    put('sort:order',params.sortOrder||'ASC');
    put('pagination:page',params.page||1);
    put('pagination:itemsPerPage',params.pageSize||30);
    return out;
  }

  async function json(url){
    const response=await fetch(url,{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Card data request failed (${response.status})`);
    return response.json();
  }

  async function search(params={}){
    const url=`${API}/cards?${qs(params).toString()}`;
    return json(url);
  }

  async function card(id){
    if(!id)return null;
    if(detailCache.has(id))return detailCache.get(id);
    const promise=json(`${API}/cards/${encodeURIComponent(id)}`).catch(error=>{detailCache.delete(id);throw error;});
    detailCache.set(id,promise);
    return promise;
  }

  async function set(id){
    if(!id)return null;
    if(setCache.has(id))return setCache.get(id);
    const promise=json(`${API}/sets/${encodeURIComponent(id)}`).catch(error=>{setCache.delete(id);throw error;});
    setCache.set(id,promise);
    return promise;
  }

  async function sets(){
    if(!setsPromise)setsPromise=json(`${API}/sets`).catch(error=>{setsPromise=null;throw error;});
    return setsPromise;
  }

  function image(cardOrBrief,quality='low'){
    const root=cardOrBrief?.image;
    return root?`${root}/${quality}.webp`:'';
  }

  function cardText(card){
    return [
      card?.description,
      ...(card?.abilities||[]).flatMap(item=>[item.name,item.effect]),
      ...(card?.attacks||[]).flatMap(item=>[item.name,item.effect,item.damage]),
      ...(card?.effect?[card.effect]:[])
    ].filter(Boolean).join(' ').toLocaleLowerCase('en');
  }

  function matchesClientFilters(card,params={}){
    const text=String(params.text||'').trim().toLocaleLowerCase('en');
    if(text&&!cardText(card).includes(text))return false;
    return true;
  }

  async function exactDeckIdentity(cardObject){
    if(!cardObject)return null;
    const fullSet=await set(cardObject.set?.id);
    const setCode=String(fullSet?.tcgOnline||'').trim().toUpperCase();
    const number=String(cardObject.localId??'').trim();
    if(!setCode||!number)return null;
    return {
      name:cardObject.name,
      set:setCode,
      number,
      section:categoryToSection(cardObject.category),
      tcgdexId:cardObject.id,
      setName:cardObject.set?.name||fullSet?.name||'',
      regulationMark:cardObject.regulationMark||'',
      legal:cardObject.legal||{}
    };
  }

  function categoryToSection(category){
    const value=String(category||'').toLocaleLowerCase('en');
    if(value==='pokemon')return 'pokemon';
    if(value==='trainer')return 'trainers';
    if(value==='energy')return 'energy';
    return 'unknown';
  }

  window.PTCGCardCatalog={API,search,card,set,sets,image,matchesClientFilters,exactDeckIdentity,categoryToSection};
})();
