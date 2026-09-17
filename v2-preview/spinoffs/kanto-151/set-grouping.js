(function(global){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }

  function setKey(saved){
    const card=saved?.card;
    if(!card?.id)return '\uffff';
    return String(card?.set?.name||card?.set?.id||'Unknown set').trim().toLocaleLowerCase('en');
  }

  function collectorKey(saved){
    const value=String(saved?.card?.localId||'').trim().toUpperCase();
    if(!value)return '\uffff';
    const match=value.match(/^([^0-9]*)(\d+)(.*)$/);
    if(!match)return value;
    return `${match[1]}${String(Number(match[2])||0).padStart(8,'0')}${match[3]}`;
  }

  function compareEntries(a,b){
    const aSelected=Boolean(a?.saved?.card?.id);
    const bSelected=Boolean(b?.saved?.card?.id);
    if(aSelected!==bSelected)return aSelected?-1:1;
    if(!aSelected)return (a.number||0)-(b.number||0);

    const bySet=setKey(a.saved).localeCompare(setKey(b.saved),'en',{sensitivity:'base'});
    if(bySet)return bySet;
    const byCollector=collectorKey(a.saved).localeCompare(collectorKey(b.saved),'en',{numeric:false,sensitivity:'base'});
    if(byCollector)return byCollector;
    return (a.number||0)-(b.number||0);
  }

  global.PTCGKantoSetGrouping={setKey,collectorKey,compareEntries};

  const grid=document.getElementById('pokedex-grid');
  const sortSelect=document.getElementById('collection-sort');
  if(!grid||!sortSelect)return;

  function applySetGrouping(){
    if(sortSelect.value!=='set')return;
    const state=loadState();
    const entries=[...grid.querySelectorAll('.dex-slot[data-number]')].map(slot=>{
      const number=Number(slot.dataset.number)||0;
      return {number,saved:state[String(number)]||null,slot};
    }).sort(compareEntries);

    entries.forEach((entry,index)=>{entry.slot.style.order=String(index);});
  }

  sortSelect.addEventListener('change',applySetGrouping);
  document.querySelectorAll('[data-collection-filter]').forEach(button=>button.addEventListener('click',applySetGrouping));

  const observer=new MutationObserver(()=>applySetGrouping());
  observer.observe(grid,{childList:true});
  applySetGrouping();
})(window);
