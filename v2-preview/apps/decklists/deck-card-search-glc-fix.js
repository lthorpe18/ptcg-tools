(function(){
  'use strict';

  const catalog=window.PTCGCardCatalog;
  const format=document.getElementById('cardFilterFormat');
  if(!catalog||!format||catalog.__ptcgGlcFilterPatched)return;
  catalog.__ptcgGlcFilterPatched=true;

  if(!format.querySelector('option[value="glc"]')){
    const option=document.createElement('option');
    option.value='glc';
    option.textContent='GLC';
    format.appendChild(option);
  }

  const style=document.createElement('style');
  style.textContent='@media(max-width:700px){body[data-app-section="decks"] input,body[data-app-section="decks"] select,body[data-app-section="decks"] textarea{font-size:16px!important}}';
  document.head.appendChild(style);

  const lower=value=>String(value||'').trim().toLocaleLowerCase('en');
  const number=value=>String(value??'').trim().replace(/^0+/, '');
  const normaliseName=value=>lower(value).replace(/[’‘]/g,"'");

  const allPrintingBans=new Set([
    "lysandre's trump card",
    'forest of giant plants',
    'chip-chip ice axe',
    'pokémon research lab',
    'double colorless energy',
    'twin energy',
    'dimension valley'
  ]);

  function isBannedPrinting(card){
    const name=normaliseName(card?.name);
    if(allPrintingBans.has(name))return true;
    const setName=lower(card?.set?.name);
    const local=number(card?.localId);

    if(name==='oranguru'&&setName.includes('ultra prism')&&local==='114')return true;
    if(name==='kyogre'&&setName.includes('shining fates')&&local==='21')return true;
    if(name==='raikou'&&setName.includes('vivid voltage')&&local==='50')return true;
    if(name==='duskull'&&setName.includes('cosmic eclipse')&&local==='83')return true;
    if(name==='hiker'&&((setName.includes('celestial storm')&&local==='133')||String(card?.localId||'').toUpperCase()==='SV85'))return true;
    if(name==='marshadow'&&((setName.includes('shining legends')&&local==='45')||String(card?.localId||'').toUpperCase()==='SM85'))return true;
    return false;
  }

  function hasRuleBox(card){
    if(lower(card?.category)!=='pokemon')return false;
    const suffix=lower(card?.suffix).replace(/\s+/g,'');
    if(['ex','gx','v','vmax','vstar','v-union','vunion','break','lv.x','lvx'].includes(suffix))return true;
    const rarity=lower(card?.rarity);
    const name=lower(card?.name);
    const rules=[...(card?.rules||[]),catalog.cardText?.(card)||''].join(' ').toLocaleLowerCase('en');
    if(name.startsWith('radiant '))return true;
    if(rarity.includes('prism star'))return true;
    return rules.includes('rule box')||rules.includes('radiant pokémon rule')||rules.includes('radiant pokemon rule')||rules.includes('prism star rule');
  }

  function isAceSpec(card){
    const rarity=lower(card?.rarity);
    const text=[...(card?.rules||[]),catalog.cardText?.(card)||''].join(' ').toLocaleLowerCase('en');
    return rarity.includes('ace spec')||text.includes('ace spec');
  }

  async function isGlcLegal(card){
    if(!card)return false;
    if(hasRuleBox(card)||isAceSpec(card)||isBannedPrinting(card))return false;
    try{
      const set=await catalog.set(card?.set?.id);
      const release=String(set?.releaseDate||'').slice(0,10);
      if(!release)return false;
      return release>='2011-04-25';
    }catch{return false;}
  }

  const originalSearchAdvanced=catalog.searchAdvanced.bind(catalog);
  catalog.searchAdvanced=async function(params={}){
    const glc=format.value==='glc';
    const results=await originalSearchAdvanced(params);
    if(!glc)return results;
    const detailed=results.length&&results.every(card=>card&&('category' in card||'rules' in card||'attacks' in card))
      ? results
      : await catalog.cards(results.map(card=>card?.id).filter(Boolean));
    const checks=await Promise.all(detailed.map(card=>isGlcLegal(card)));
    return detailed.filter((card,index)=>card&&checks[index]);
  };

  function reflectGlcFilter(){
    const button=document.getElementById('cardFilterButton');
    const badge=document.getElementById('cardFilterBadge');
    if(!button||!badge||format.value!=='glc')return;
    const current=Number(badge.textContent||0);
    button.classList.add('active');
    badge.hidden=false;
    badge.textContent=String(Math.max(1,current+1));
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('#cardFilterApply'))setTimeout(reflectGlcFilter,0);
    if(event.target.closest('#cardFilterClear'))setTimeout(()=>{
      if(format.value!=='glc')return;
      format.value='all';
    },0);
  });
})();
