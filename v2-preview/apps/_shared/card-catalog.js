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

  async function search(params={}){
    const name=String(params.name||'').trim();
    const url=name?`${API}/cards?name=${encodeURIComponent(name)}`:`${API}/cards`;
    return json(url);
  }

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

  window.PTCGCardCatalog={API,search,card,cards,set,sets,image,isStandard,exactDeckIdentity,categoryToSection};
})();
