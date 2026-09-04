(function(){
  'use strict';

  const catalog=window.PTCGCardCatalog;
  const parser=window.PTCGDeckParser;
  if(!catalog||!parser)return;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const PAGE_SIZE=36;
  let mode='browse',page=1,debounceTimer=null,requestSeq=0,currentBriefs=[];

  function ensureUi(){
    if($('cardSearchSheet'))return;

    const libraryControls=document.querySelector('.deck-library-controls');
    if(libraryControls&&!$('browseCardsButton')){
      const button=document.createElement('button');
      button.id='browseCardsButton';
      button.type='button';
      button.className='app-button';
      button.textContent='Card search';
      libraryControls.appendChild(button);
    }

    const listHead=$('tab-list')?.querySelector('.app-section-head');
    if(listHead&&!$('addCardButton')){
      const right=document.createElement('div');
      right.className='deck-list-head-actions';
      const pill=$('cardCountPill');
      if(pill)right.appendChild(pill);
      const add=document.createElement('button');
      add.id='addCardButton';
      add.type='button';
      add.className='app-button primary';
      add.textContent='+ Add card';
      right.appendChild(add);
      listHead.appendChild(right);
    }

    document.body.insertAdjacentHTML('beforeend',`
      <div id="cardSearchSheet" class="card-search-screen" hidden>
        <section class="card-search-card" role="dialog" aria-modal="true" aria-labelledby="cardSearchTitle">
          <header class="card-search-head">
            <div><small id="cardSearchEyebrow">CARD DATABASE</small><h2 id="cardSearchTitle">Card search</h2></div>
            <button class="sheet-close" type="button" data-close-card-search aria-label="Close">×</button>
          </header>
          <div class="card-search-controls">
            <input id="cardSearchName" type="search" placeholder="Search card name…" autocomplete="off" aria-label="Card name">
            <div class="card-search-scope" role="group" aria-label="Card legality">
              <button type="button" data-card-scope="all" aria-pressed="true">All cards</button>
              <button type="button" data-card-scope="standard" aria-pressed="false">Standard</button>
            </div>
          </div>
          <div id="cardSearchStatus" class="card-search-status">Type a card name.</div>
          <section id="cardSearchResults" class="card-search-results" aria-live="polite"></section>
          <div class="card-search-more"><button id="cardSearchMore" class="app-button" type="button" hidden>More results</button></div>
        </section>
      </div>`);
  }

  function open(nextMode){
    ensureUi();
    mode=nextMode==='add'?'add':'browse';
    $('cardSearchEyebrow').textContent=mode==='add'?'DECK EDITOR':'CARD DATABASE';
    $('cardSearchTitle').textContent=mode==='add'?'Add card':'Card search';
    $('cardSearchStatus').textContent=mode==='add'?'Search, then tap a card image to add that exact printing.':'Type a card name.';
    $('cardSearchSheet').hidden=false;
    document.documentElement.classList.add('sheet-open');
    document.body.classList.add('card-search-open');
    setTimeout(()=>$('cardSearchName')?.focus(),20);
  }

  function close(){
    if(!$('cardSearchSheet'))return;
    $('cardSearchSheet').hidden=true;
    document.documentElement.classList.remove('sheet-open');
    document.body.classList.remove('card-search-open');
  }

  function scope(){
    return document.querySelector('[data-card-scope][aria-pressed="true"]')?.dataset.cardScope||'all';
  }

  function setScope(value){
    document.querySelectorAll('[data-card-scope]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cardScope===value)));
    page=1;
    runSearch(false);
  }

  async function standardBriefs(briefs,seq){
    const accepted=[];
    const batchSize=24;
    for(let i=0;i<briefs.length;i+=batchSize){
      if(seq!==requestSeq)return [];
      const batch=briefs.slice(i,i+batchSize);
      const details=await catalog.cards(batch.map(card=>card.id));
      if(seq!==requestSeq)return [];
      for(const detail of details){
        if(detail&&catalog.isStandard(detail))accepted.push(detail);
      }
    }
    return accepted;
  }

  async function runSearch(append=false){
    const name=$('cardSearchName').value.trim();
    const standardOnly=scope()==='standard';
    const seq=++requestSeq;
    const root=$('cardSearchResults'),status=$('cardSearchStatus'),more=$('cardSearchMore');

    if(name.length<2){
      currentBriefs=[];
      page=1;
      root.innerHTML='';
      more.hidden=true;
      status.textContent=mode==='add'?'Search, then tap a card image to add that exact printing.':'Type at least 2 letters.';
      return;
    }

    if(!append){
      page=1;
      root.innerHTML='<div class="card-search-loading">Loading…</div>';
    }
    status.textContent='Searching…';
    more.hidden=true;

    try{
      if(!append){
        const briefs=await catalog.search({name});
        if(seq!==requestSeq)return;
        currentBriefs=standardOnly?await standardBriefs(briefs,seq):briefs;
        if(seq!==requestSeq)return;
      }
      const start=(page-1)*PAGE_SIZE;
      const pageResults=currentBriefs.slice(start,start+PAGE_SIZE);
      renderResults(pageResults,append);
      const total=currentBriefs.length;
      status.textContent=total
        ? `${total} ${standardOnly?'Standard ':''}printing${total===1?'':'s'} found${mode==='add'?' · tap one to add':''}`
        : 'No matching cards found.';
      more.hidden=start+PAGE_SIZE>=total;
    }catch(error){
      if(seq!==requestSeq)return;
      if(!append)root.innerHTML='';
      status.textContent=error?.message||'Card search failed.';
    }
  }

  function renderResults(results,append){
    const root=$('cardSearchResults');
    const html=results.map(card=>{
      const image=catalog.image(card,'low');
      const title=esc(`${card.name||'Card'}${card.localId?` ${card.localId}`:''}`);
      if(mode==='add'){
        return `<button class="card-search-tile addable" type="button" data-card-add="${esc(card.id)}" aria-label="Add ${esc(card.name||'card')}">
          <img src="${esc(image)}" alt="${title}" loading="lazy" decoding="async"><span class="card-add-badge">+</span>
        </button>`;
      }
      return `<div class="card-search-tile"><img src="${esc(image)}" alt="${title}" loading="lazy" decoding="async"></div>`;
    }).join('');
    if(append)root.insertAdjacentHTML('beforeend',html);
    else root.innerHTML=html;
  }

  function serialise(parsedDeck){
    const groups=[['pokemon','Pokémon'],['trainers','Trainer'],['energy','Energy'],['unknown','Other']];
    return groups.map(([key,label])=>{
      const cards=parsedDeck.cards.filter(card=>card.section===key&&Number(card.count)>0);
      if(!cards.length)return '';
      const total=cards.reduce((sum,card)=>sum+Number(card.count||0),0);
      return `${label}: ${total}\n${cards.map(card=>`${card.count} ${card.name}${card.set?` ${card.set}`:''}${card.number?` ${card.number}`:''}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
  }

  async function addCard(id,button){
    const text=$('deckText');
    if(!text)return;
    button.disabled=true;
    button.classList.add('adding');
    try{
      const full=await catalog.card(id);
      const exact=await catalog.exactDeckIdentity(full);
      if(!exact)throw new Error('This printing cannot be mapped to a PTCGL/Limitless set code.');
      const deck=parser.parseDeck(text.value||'');
      const existing=deck.cards.find(card=>
        String(card.name||'').toLocaleLowerCase('en')===String(exact.name||'').toLocaleLowerCase('en')&&
        String(card.set||'').toUpperCase()===exact.set&&
        String(card.number||'').toUpperCase()===String(exact.number).toUpperCase());
      if(existing)existing.count=Math.min(60,Number(existing.count||0)+1);
      else deck.cards.push({count:1,name:exact.name,set:exact.set,number:exact.number,section:exact.section});
      text.value=serialise(deck);
      text.dispatchEvent(new Event('input',{bubbles:true}));
      button.classList.remove('adding');
      button.classList.add('added');
      button.querySelector('.card-add-badge').textContent='✓';
      $('cardSearchStatus').textContent=`Added ${exact.name} (${exact.set} ${exact.number}).`;
      setTimeout(()=>{
        button.disabled=false;
        button.classList.remove('added');
        const badge=button.querySelector('.card-add-badge');
        if(badge)badge.textContent='+';
      },900);
    }catch(error){
      button.disabled=false;
      button.classList.remove('adding');
      $('cardSearchStatus').textContent=error?.message||'Could not add this card.';
    }
  }

  function queueSearch(){
    clearTimeout(debounceTimer);
    debounceTimer=setTimeout(()=>runSearch(false),180);
  }

  document.addEventListener('input',event=>{
    if(event.target.id==='cardSearchName')queueSearch();
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('#browseCardsButton'))open('browse');
    if(event.target.closest('#addCardButton'))open('add');
    if(event.target.closest('[data-close-card-search]'))close();
    const scopeButton=event.target.closest('[data-card-scope]');
    if(scopeButton)setScope(scopeButton.dataset.cardScope);
    const add=event.target.closest('[data-card-add]');
    if(add)addCard(add.dataset.cardAdd,add);
    if(event.target.closest('#cardSearchMore')){page+=1;runSearch(true);}
  });

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&$('cardSearchSheet')&&!$('cardSearchSheet').hidden)close();
  });

  ensureUi();
})();
