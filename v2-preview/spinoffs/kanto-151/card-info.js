(function(global){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';
  const catalog=global.PTCGCardCatalog;

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }

  function statusLabel(saved){
    if(!saved?.card?.id)return 'Unselected';
    return saved.owned?'Owned':'Wanted';
  }

  function formatStage(value){
    return String(value||'').replace(/^Stage(\d+)$/i,'Stage $1');
  }

  function setCodeFrom(setMeta){
    return String(setMeta?.tcgOnline||setMeta?.abbreviations?.official||'').trim().toUpperCase();
  }

  function formatSetLabel(card,identity,setMeta){
    const name=String(card?.set?.name||identity?.setName||setMeta?.name||'').trim();
    const code=String(identity?.set||setCodeFrom(setMeta)||'').trim().toUpperCase();
    if(name&&code)return `${name} (${code})`;
    return name||code;
  }

  function cardInfoRows(card={},identity=null,setMeta=null,status='Wanted'){
    const legal=card?.legal?.standard;
    const rows=[
      ['Status',status],
      ['Set',formatSetLabel(card,identity,setMeta)],
      ['Collector number',String(identity?.number||card?.localId||'').trim()],
      ['Rarity',String(card?.rarity||'').trim()],
      ['Illustrator',String(card?.illustrator||'').trim()],
      ['Release date',String(card?.releaseDate||setMeta?.releaseDate||'').trim()],
      ['Regulation mark',String(card?.regulationMark||'').trim()],
      ['HP',card?.hp!=null?String(card.hp):''],
      ['Type',Array.isArray(card?.types)?card.types.filter(Boolean).join(' / '):String(card?.types||'').trim()],
      ['Stage',formatStage(card?.stage)],
      ['Standard legality',legal===true?'Legal':legal===false?'Not legal':'']
    ];
    return rows.filter(([,value])=>String(value||'').trim());
  }

  global.PTCGKantoCardInfo={statusLabel,formatStage,formatSetLabel,cardInfoRows};

  const grid=document.getElementById('pokedex-grid');
  if(!grid)return;

  const dialog=document.createElement('dialog');
  dialog.className='card-info-dialog';
  dialog.innerHTML=`<section class="card-info-panel">
    <header class="card-info-header">
      <div>
        <strong id="card-info-title">Card information</strong>
        <span id="card-info-subtitle"></span>
      </div>
      <button id="close-card-info" class="icon-button" type="button" aria-label="Close card information">×</button>
    </header>
    <dl id="card-info-details" class="card-info-details"></dl>
  </section>`;
  document.body.appendChild(dialog);

  const title=dialog.querySelector('#card-info-title');
  const subtitle=dialog.querySelector('#card-info-subtitle');
  const details=dialog.querySelector('#card-info-details');
  const closeButton=dialog.querySelector('#close-card-info');

  function decorateSlots(){
    const state=loadState();
    grid.querySelectorAll('.dex-slot[data-number]').forEach(slot=>{
      const number=String(Number(slot.dataset.number)||'');
      const saved=state[number];
      let button=slot.querySelector('[data-card-info]');
      if(!saved?.card?.id){
        button?.remove();
        return;
      }
      if(!button){
        button=document.createElement('button');
        button.className='card-info-button';
        button.type='button';
        button.textContent='i';
        button.dataset.cardInfo=number;
        slot.appendChild(button);
      }
      button.setAttribute('aria-label',`Information about ${saved.card.name||'selected card'}`);
    });
  }

  function renderRows(rows){
    details.replaceChildren();
    rows.forEach(([label,value])=>{
      const row=document.createElement('div');
      const dt=document.createElement('dt');
      const dd=document.createElement('dd');
      dt.textContent=label;
      dd.textContent=value;
      row.append(dt,dd);
      details.appendChild(row);
    });
  }

  async function openInfo(number){
    const state=loadState();
    const saved=state[String(number)];
    const compact=saved?.card;
    if(!compact?.id)return;

    title.textContent=compact.name||'Card information';
    subtitle.textContent='Loading details…';
    renderRows([['Status',statusLabel(saved)]]);
    dialog.showModal();

    let card=compact;
    let identity=null;
    let setMeta=null;
    try{card=await catalog?.card?.(compact.id)||compact;}catch{}
    try{identity=await catalog?.exactDeckIdentity?.(card);}catch{}
    const setId=String(card?.set?.id||compact?.set?.id||'').trim();
    if(setId){
      try{setMeta=await catalog?.set?.(setId)||null;}catch{}
    }

    const rows=cardInfoRows(card,identity,setMeta,statusLabel(saved));
    title.textContent=card?.name||compact.name||'Card information';
    const setLabel=formatSetLabel(card,identity,setMeta);
    const numberLabel=String(identity?.number||card?.localId||compact.localId||'').trim();
    subtitle.textContent=[setLabel,numberLabel?`#${numberLabel}`:''].filter(Boolean).join(' · ');
    renderRows(rows);
  }

  grid.addEventListener('click',event=>{
    const button=event.target.closest('[data-card-info]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    openInfo(button.dataset.cardInfo);
  });

  closeButton.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});

  const observer=new MutationObserver(()=>decorateSlots());
  observer.observe(grid,{childList:true});
  decorateSlots();
})(window);
