(function(){
  'use strict';

  const API='https://api.tcgdex.net/v2/en';
  const detailCache=new Map();
  const setCache=new Map();
  let setsPromise=null;

  const SET_CODE_BY_NAME=new Map(Object.entries({
    'scarlet & violet':'SVI','paldea evolved':'PAL','obsidian flames':'OBF','151':'MEW','pokémon 151':'MEW',
    'paradox rift':'PAR','paldean fates':'PAF','temporal forces':'TEF','twilight masquerade':'TWM',
    'shrouded fable':'SFA','stellar crown':'SCR','surging sparks':'SSP','prismatic evolutions':'PRE',
    'journey together':'JTG','destined rivals':'DRI','black bolt':'BLK','white flare':'WHT',
    'mega evolution':'MEG','mega evolution energy':'MEE','mega promos':'MEP','phantasmal flames':'PFL',
    'ascended heroes':'ASC','perfect order':'POR','chaos rising':'CRI','pitch black':'PBL'
  }));

  function normaliseSetName(value){return String(value||'').trim().toLocaleLowerCase('en').replace(/\s+/g,' ')}

  async function json(url){
    const response=await fetch(url,{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Card data request failed (${response.status})`);
    return response.json();
  }

  function addQuery(query,key,value,prefix=''){
    const text=String(value??'').trim();
    if(text)query.set(key,`${prefix}${text}`);
  }

  function baseQuery(params={}){
    const query=new URLSearchParams();
    addQuery(query,'name',params.name);
    addQuery(query,'category',params.category);
    addQuery(query,'set.id',params.setId);
    addQuery(query,'regulationMark',params.regulationMark);
    addQuery(query,'types',params.type);
    addQuery(query,'stage',params.stage);
    addQuery(query,'trainerType',params.trainerType);
    addQuery(query,'rarity',params.rarity);
    addQuery(query,'illustrator',params.illustrator);
    if(params.standardOnly)query.set('legal.standard','true');
    if(String(params.hpMin??'').trim())addQuery(query,'hp',params.hpMin,'gte:');
    if(String(params.hpMax??'').trim())addQuery(query,'hp',params.hpMax,'lte:');
    return query;
  }

  async function list(query){
    const suffix=query&&String(query)?`?${String(query)}`:'';
    return json(`${API}/cards${suffix}`);
  }

  async function search(params={}){return list(baseQuery(params))}

  async function card(id){
    if(!id)return null;
    if(detailCache.has(id))return detailCache.get(id);
    const promise=json(`${API}/cards/${encodeURIComponent(id)}`).catch(error=>{detailCache.delete(id);throw error;});
    detailCache.set(id,promise);
    return promise;
  }

  async function cards(ids=[]){return Promise.all(ids.map(id=>card(id).catch(()=>null)))}

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

  function isStandard(cardObject){return cardObject?.legal?.standard===true}

  function cardText(cardObject){
    if(!cardObject)return '';
    const values=[];
    const push=value=>{if(value!=null&&value!=='')values.push(String(value))};
    push(cardObject.effect);
    push(cardObject.description);
    (cardObject.rules||[]).forEach(push);
    (cardObject.attacks||[]).forEach(item=>{push(item?.name);push(item?.effect);push(item?.damage)});
    (cardObject.abilities||[]).forEach(item=>{push(item?.name);push(item?.effect)});
    push(cardObject.item?.name);push(cardObject.item?.effect);
    return values.join(' ').replace(/\s+/g,' ').trim();
  }

  function matchesAdvanced(cardObject,params={}){
    if(!cardObject)return false;
    const lower=value=>String(value||'').toLocaleLowerCase('en');
    if(params.standardOnly&&!isStandard(cardObject))return false;
    if(params.text&&!lower(cardText(cardObject)).includes(lower(params.text)))return false;
    if(params.category&&lower(cardObject.category)!==lower(params.category))return false;
    if(params.setId&&String(cardObject.set?.id||'')!==String(params.setId))return false;
    if(params.regulationMark&&lower(cardObject.regulationMark)!==lower(params.regulationMark))return false;
    if(params.type&&!(cardObject.types||[]).some(value=>lower(value)===lower(params.type)))return false;
    if(params.stage&&!lower(cardObject.stage).includes(lower(params.stage)))return false;
    if(params.trainerType&&!lower(cardObject.trainerType).includes(lower(params.trainerType)))return false;
    if(params.rarity&&!lower(cardObject.rarity).includes(lower(params.rarity)))return false;
    if(params.illustrator&&!lower(cardObject.illustrator).includes(lower(params.illustrator)))return false;
    const hp=Number(cardObject.hp);
    if(String(params.hpMin??'').trim()&&(!Number.isFinite(hp)||hp<Number(params.hpMin)))return false;
    if(String(params.hpMax??'').trim()&&(!Number.isFinite(hp)||hp>Number(params.hpMax)))return false;
    return true;
  }

  async function searchAdvanced(params={}){
    const text=String(params.text||'').trim();
    let briefs=[];
    if(!text){
      briefs=await search(params);
      if(!params.standardOnly||!String(params.name||'').trim())return briefs;
    }else if(String(params.name||'').trim()){
      briefs=await search(params);
    }else{
      const fields=['effect','description','rules','attacks.name','attacks.effect','abilities.name','abilities.effect','item.name','item.effect'];
      const groups=await Promise.all(fields.map(async field=>{
        const query=baseQuery(params);
        query.set(field,text);
        try{return await list(query)}catch{return []}
      }));
      const byId=new Map();
      groups.flat().forEach(item=>{if(item?.id)byId.set(item.id,item)});
      briefs=[...byId.values()];
    }

    const detailed=[];
    const batchSize=24;
    for(let index=0;index<briefs.length;index+=batchSize){
      const batch=await cards(briefs.slice(index,index+batchSize).map(item=>item.id));
      batch.forEach(item=>{if(matchesAdvanced(item,params))detailed.push(item)});
    }
    return detailed;
  }

  function fallbackSetCode(fullSet,cardObject){
    for(const name of [fullSet?.name,cardObject?.set?.name].map(normaliseSetName).filter(Boolean)){
      const code=SET_CODE_BY_NAME.get(name);
      if(code)return code;
    }
    return '';
  }

  async function exactDeckIdentity(cardObject){
    if(!cardObject)return null;
    const fullSet=await set(cardObject.set?.id);
    const setCode=String(fullSet?.tcgOnline||fallbackSetCode(fullSet,cardObject)||'').trim().toUpperCase();
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

  window.PTCGCardCatalog={API,search,searchAdvanced,card,cards,set,sets,image,isStandard,cardText,matchesAdvanced,exactDeckIdentity,categoryToSection};
})();
