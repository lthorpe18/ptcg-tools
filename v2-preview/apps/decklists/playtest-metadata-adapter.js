(function(){
'use strict';

const nativeFetch=window.fetch.bind(window);
const POKEMON_API='https://api.pokemontcg.io/v2/cards';
const TCGDEX_API='https://api.tcgdex.net/v2/en';

function jsonResponse(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
}
function normaliseStage(stage){
  const value=String(stage||'').toLowerCase().replace(/\s+/g,'');
  if(value==='basic')return 'Basic';
  if(value==='stage1')return 'Stage 1';
  if(value==='stage2')return 'Stage 2';
  return stage||null;
}
function detailText(card){
  const abilities=Array.isArray(card?.abilities)?card.abilities:[];
  const rules=Array.isArray(card?.rules)?card.rules:[];
  const effect=typeof card?.effect==='string'?[card.effect]:[];
  return {
    abilities:abilities.map(row=>({name:row?.name||'',text:row?.effect||row?.text||''})),
    rules:[...rules,...effect]
  };
}
async function tcgdexByName(name){
  const listUrl=`${TCGDEX_API}/cards?name=${encodeURIComponent(`eq:${name}`)}&sort:field=id&sort:order=DESC&pagination:page=1&pagination:itemsPerPage=30`;
  const listResponse=await nativeFetch(listUrl,{cache:'force-cache'});
  if(!listResponse.ok)return [];
  const briefs=await listResponse.json();
  if(!Array.isArray(briefs)||!briefs.length)return [];
  const details=await Promise.all(briefs.slice(0,30).map(async brief=>{
    try{
      const response=await nativeFetch(`${TCGDEX_API}/cards/${encodeURIComponent(brief.id)}`,{cache:'force-cache'});
      return response.ok?await response.json():null;
    }catch{return null}
  }));
  return details.filter(card=>card&&String(card.name||'').toLowerCase()===name.toLowerCase()&&String(card.category||'').toLowerCase()==='pokemon');
}

window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:input?.url||'';
  if(!raw.startsWith(POKEMON_API))return nativeFetch(input,init);
  try{
    const url=new URL(raw),q=decodeURIComponent(url.searchParams.get('q')||'');
    const nameMatch=q.match(/name:\"([^\"]+)\"/i);
    if(!nameMatch)return jsonResponse({data:[]});
    const name=nameMatch[1];
    const cards=await tcgdexByName(name);
    const data=cards.map(card=>{
      const text=detailText(card);
      return {
        name:card.name,
        number:String(card.localId??''),
        supertype:'Pokémon',
        subtypes:normaliseStage(card.stage)?[normaliseStage(card.stage)]:[],
        set:{id:card.set?.id||'',name:card.set?.name||''},
        abilities:text.abilities,
        rules:text.rules
      };
    });
    return jsonResponse({data});
  }catch(error){
    console.warn('Playtest metadata adapter failed',error);
    return jsonResponse({data:[]});
  }
};
})();
