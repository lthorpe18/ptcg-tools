(function(global){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';
  const catalog=global.PTCGCardCatalog;

  function classify(saved){
    if(!saved?.card?.id)return 'unselected';
    return saved.owned?'owned':'wanted';
  }

  function visibleFor(status,filter){
    if(filter==='wanted')return status==='wanted';
    if(filter==='owned')return status==='owned';
    return true;
  }

  function sortOrder(number,status,mode){
    const n=Number(number)||0;
    if(mode==='wanted'){
      const group=status==='wanted'?0:status==='owned'?1:2;
      return group*1000+n;
    }
    if(mode==='owned'){
      const group=status==='owned'?0:status==='wanted'?1:2;
      return group*1000+n;
    }
    return n;
  }

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }

  function wantedEntries(state){
    return Object.entries(state||{})
      .filter(([,saved])=>classify(saved)==='wanted')
      .map(([number,saved])=>({number:Number(number)||0,saved}))
      .sort((a,b)=>a.number-b.number);
  }

  function uniqueNames(values){
    const seen=new Set();
    const result=[];
    (values||[]).forEach(value=>{
      const text=String(value||'').trim();
      const key=text.toLocaleLowerCase('en');
      if(!text||seen.has(key))return;
      seen.add(key);
      result.push(text);
    });
    return result;
  }

  function cardmarketTerms(card){
    return uniqueNames([
      ...(card?.abilities||[]).map(item=>item?.name),
      ...(card?.attacks||[]).map(item=>item?.name)
    ]);
  }

  function formatCardmarketLine(card){
    const name=String(card?.name||'').trim();
    if(!name)return '';
    const terms=cardmarketTerms(card);
    const setName=String(card?.set?.name||'').trim();
    return `1x ${name}${terms.length?` ${terms.join(' ')}`:''}${setName?` (${setName})`:''}`;
  }

  const api={classify,visibleFor,sortOrder,wantedEntries,cardmarketTerms,formatCardmarketLine};
  global.PTCGKantoCollectionControls=api;

  const grid=document.getElementById('pokedex-grid');
  const filterButtons=[...document.querySelectorAll('[data-collection-filter]')];
  const sortSelect=document.getElementById('collection-sort');
  const copyButton=document.getElementById('copy-wanted');
  const copyStatus=document.getElementById('collection-copy-status');
  const allCount=document.getElementById('collection-count-all');
  const wantedCount=document.getElementById('collection-count-wanted');
  const ownedCount=document.getElementById('collection-count-owned');
  if(!grid||!filterButtons.length||!sortSelect||!copyButton)return;

  let filterMode='all';

  function stateCounts(state){
    let wanted=0,owned=0;
    for(const saved of Object.values(state||{})){
      const status=classify(saved);
      if(status==='wanted')wanted++;
      else if(status==='owned')owned++;
    }
    return {all:151,wanted,owned};
  }

  function applyView(){
    const state=loadState();
    const counts=stateCounts(state);
    if(allCount)allCount.textContent=String(counts.all);
    if(wantedCount)wantedCount.textContent=String(counts.wanted);
    if(ownedCount)ownedCount.textContent=String(counts.owned);
    copyButton.disabled=counts.wanted===0;

    filterButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.collectionFilter===filterMode)));

    grid.querySelectorAll('.dex-slot[data-number]').forEach(slot=>{
      const number=Number(slot.dataset.number)||0;
      const status=classify(state[String(number)]);
      slot.hidden=!visibleFor(status,filterMode);
      slot.style.order=String(sortOrder(number,status,sortSelect.value));
    });
  }

  async function detailsFor(entry){
    const compact=entry?.saved?.card||null;
    if(!compact?.id)return compact;
    try{return await catalog?.card?.(compact.id)||compact;}catch{return compact;}
  }

  async function writeClipboard(text){
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea=document.createElement('textarea');
    textarea.value=text;
    textarea.setAttribute('readonly','');
    textarea.style.position='fixed';
    textarea.style.opacity='0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied=document.execCommand?.('copy');
    textarea.remove();
    if(!copied)throw new Error('Clipboard unavailable');
  }

  async function copyWanted(){
    const entries=wantedEntries(loadState());
    if(!entries.length)return;
    copyButton.disabled=true;
    copyStatus.textContent='Preparing Cardmarket list…';
    try{
      const details=await Promise.all(entries.map(detailsFor));
      let lowConfidence=0;
      const lines=details.map((detail,index)=>{
        const card=detail||entries[index].saved.card;
        if(!cardmarketTerms(card).length)lowConfidence++;
        return formatCardmarketLine(card);
      }).filter(Boolean);
      await writeClipboard(lines.join('\n'));
      copyStatus.textContent=`Copied ${lines.length} wanted card${lines.length===1?'':'s'}${lowConfidence?` · ${lowConfidence} may need manual matching`:''}.`;
    }catch(error){
      copyStatus.textContent=error?.message||'Could not copy wanted list.';
    }finally{
      applyView();
    }
  }

  filterButtons.forEach(button=>button.addEventListener('click',()=>{
    filterMode=button.dataset.collectionFilter||'all';
    applyView();
  }));
  sortSelect.addEventListener('change',applyView);
  copyButton.addEventListener('click',copyWanted);

  const observer=new MutationObserver(()=>applyView());
  observer.observe(grid,{childList:true});
  applyView();
})(window);
