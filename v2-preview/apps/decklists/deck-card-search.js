(function(){
  'use strict';

  const catalog=window.PTCGCardCatalog;
  const parser=window.PTCGDeckParser;
  if(!catalog||!parser)return;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  let mode='browse',page=1,loading=false;

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
      <div id="cardSearchSheet" class="sheet card-search-sheet" hidden>
        <div class="sheet-backdrop" data-close-card-search></div>
        <section class="sheet-card card-search-card" role="dialog" aria-modal="true" aria-labelledby="cardSearchTitle">
          <div class="sheet-handle"></div>
          <header class="card-search-head">
            <div><small id="cardSearchEyebrow">CARD DATABASE</small><h2 id="cardSearchTitle">Card search</h2></div>
            <button class="sheet-close" type="button" data-close-card-search aria-label="Close">×</button>
          </header>
          <form id="cardSearchForm" class="card-search-form">
            <label class="card-search-name">Card name<input id="cardSearchName" type="search" placeholder="e.g. Buddy-Buddy Poffin" autocomplete="off"></label>
            <div class="card-search-core-filters">
              <label>Format<select id="cardSearchFormat"><option value="standard">Standard legal</option><option value="all">All cards</option></select></label>
              <label>Category<select id="cardSearchCategory"><option value="all">All</option><option value="Pokemon">Pokémon</option><option value="Trainer">Trainer</option><option value="Energy">Energy</option></select></label>
              <label>Set<select id="cardSearchSet"><option value="">All sets</option></select></label>
              <label>Reg mark<input id="cardSearchReg" type="text" maxlength="2" placeholder="e.g. H"></label>
            </div>
            <details class="card-search-advanced">
              <summary>Advanced filters</summary>
              <div class="card-search-advanced-grid">
                <label>Type<select id="cardSearchType"><option value="all">Any</option>${['Colorless','Darkness','Dragon','Fairy','Fighting','Fire','Grass','Lightning','Metal','Psychic','Water'].map(x=>`<option>${x}</option>`).join('')}</select></label>
                <label>Stage<select id="cardSearchStage"><option value="all">Any</option><option value="Basic">Basic</option><option value="Stage1">Stage 1</option><option value="Stage2">Stage 2</option></select></label>
                <label>Trainer type<select id="cardSearchTrainerType"><option value="all">Any</option>${['Item','Supporter','Stadium','Tool','Technical Machine'].map(x=>`<option>${x}</option>`).join('')}</select></label>
                <label>Rarity<input id="cardSearchRarity" type="text" placeholder="e.g. Rare"></label>
                <label>Min HP<input id="cardSearchHpMin" type="number" min="0" step="10" inputmode="numeric"></label>
                <label>Max HP<input id="cardSearchHpMax" type="number" min="0" step="10" inputmode="numeric"></label>
                <label>Max retreat<input id="cardSearchRetreat" type="number" min="0" max="8" inputmode="numeric"></label>
                <label>Illustrator<input id="cardSearchIllustrator" type="text" placeholder="Name contains…"></label>
                <label class="wide">Card text<input id="cardSearchText" type="search" placeholder="Attack, Ability or effect text…"></label>
                <label>Sort<select id="cardSearchSort"><option value="name:ASC">Name A–Z</option><option value="name:DESC">Name Z–A</option><option value="hp:DESC">HP high–low</option><option value="hp:ASC">HP low–high</option></select></label>
              </div>
            </details>
            <div class="card-search-actions"><button class="app-button" id="cardSearchClear" type="button">Clear</button><button class="app-button primary" type="submit">Search</button></div>
          </form>
          <div id="cardSearchStatus" class="card-search-status">Search the Pokémon TCG card database.</div>
          <section id="cardSearchResults" class="card-search-results" aria-live="polite"></section>
          <div class="card-search-pager"><button id="cardSearchPrev" class="app-button" type="button" disabled>Previous</button><span id="cardSearchPage">Page 1</span><button id="cardSearchNext" class="app-button" type="button" disabled>Next</button></div>
        </section>
      </div>`);
    loadSets();
  }

  async function loadSets(){
    const select=$('cardSearchSet');
    if(!select||select.dataset.loaded)return;
    try{
      const sets=await catalog.sets();
      select.insertAdjacentHTML('beforeend',sets.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(set=>`<option value="${esc(set.id)}">${esc(set.name)}</option>`).join(''));
      select.dataset.loaded='true';
    }catch{}
  }

  function open(nextMode){
    ensureUi();
    mode=nextMode==='add'?'add':'browse';
    $('cardSearchEyebrow').textContent=mode==='add'?'DECK EDITOR':'CARD DATABASE';
    $('cardSearchTitle').textContent=mode==='add'?'Add card':'Card search';
    $('cardSearchSheet').hidden=false;
    document.documentElement.classList.add('sheet-open');
    setTimeout(()=>$('cardSearchName')?.focus(),20);
  }

  function close(){
    if(!$('cardSearchSheet'))return;
    $('cardSearchSheet').hidden=true;
    document.documentElement.classList.remove('sheet-open');
  }

  function params(){
    const [sortField,sortOrder]=($('cardSearchSort')?.value||'name:ASC').split(':');
    return {
      name:$('cardSearchName').value.trim(),
      standardOnly:$('cardSearchFormat').value==='standard',
      category:$('cardSearchCategory').value,
      setId:$('cardSearchSet').value,
      regulationMark:$('cardSearchReg').value.trim().toUpperCase(),
      type:$('cardSearchType').value,
      stage:$('cardSearchStage').value,
      trainerType:$('cardSearchTrainerType').value,
      rarity:$('cardSearchRarity').value.trim(),
      hpMin:$('cardSearchHpMin').value,
      hpMax:$('cardSearchHpMax').value,
      retreatMax:$('cardSearchRetreat').value,
      illustrator:$('cardSearchIllustrator').value.trim(),
      text:$('cardSearchText').value.trim(),
      sortField,sortOrder,page,pageSize:30
    };
  }

  async function runSearch(){
    if(loading)return;
    loading=true;
    const status=$('cardSearchStatus'),root=$('cardSearchResults');
    status.textContent='Searching…';
    root.innerHTML='<div class="card-search-loading">Loading cards…</div>';
    $('cardSearchPrev').disabled=true;$('cardSearchNext').disabled=true;
    try{
      const filters=params();
      const briefs=await catalog.search(filters);
      const detailNeeded=Boolean(filters.text);
      let results=briefs;
      if(detailNeeded){
        const details=await Promise.all(briefs.map(item=>catalog.card(item.id).catch(()=>null)));
        results=details.filter(card=>card&&catalog.matchesClientFilters(card,filters));
      }
      await renderResults(results,detailNeeded);
      status.textContent=results.length?`${results.length} result${results.length===1?'':'s'} on this page${filters.text?' after card-text filtering':''}.`:'No cards matched these filters.';
      $('cardSearchPrev').disabled=page<=1;
      $('cardSearchNext').disabled=briefs.length<30;
      $('cardSearchPage').textContent=`Page ${page}`;
    }catch(error){
      root.innerHTML='<div class="app-empty"><strong>Card search unavailable</strong><p>Check your connection and try again.</p></div>';
      status.textContent=error?.message||'Card search failed.';
    }finally{loading=false;}
  }

  async function renderResults(results,alreadyDetailed){
    const root=$('cardSearchResults');
    if(!results.length){root.innerHTML='';return;}
    const details=alreadyDetailed?results:await Promise.all(results.map(item=>catalog.card(item.id).catch(()=>item)));
    root.innerHTML=details.map(card=>{
      const setName=card.set?.name||'';
      const meta=[setName,card.localId,card.regulationMark?`Reg ${card.regulationMark}`:'',card.rarity||''].filter(Boolean).join(' · ');
      const category=[card.category,card.stage,card.trainerType,(card.types||[]).join('/')].filter(Boolean).join(' · ');
      const hp=card.hp?`${card.hp} HP`:'';
      return `<article class="card-search-result" data-card-id="${esc(card.id)}">
        <img src="${esc(catalog.image(card,'low'))}" alt="${esc(card.name)}" loading="lazy" decoding="async">
        <div class="card-search-result-copy"><h3>${esc(card.name)}</h3><small>${esc(meta)}</small><p>${esc([category,hp].filter(Boolean).join(' · '))}</p></div>
        <div class="card-search-result-actions"><button class="app-button" type="button" data-card-detail="${esc(card.id)}">Details</button>${mode==='add'?`<button class="app-button primary" type="button" data-card-add="${esc(card.id)}">Add</button>`:''}</div>
      </article>`;
    }).join('');
  }

  async function showDetail(id){
    const row=document.querySelector(`.card-search-result[data-card-id="${CSS.escape(id)}"]`);
    if(!row)return;
    let panel=row.querySelector('.card-search-detail');
    if(panel){panel.hidden=!panel.hidden;return;}
    try{
      const card=await catalog.card(id);
      panel=document.createElement('div');
      panel.className='card-search-detail';
      const abilities=(card.abilities||[]).map(a=>`<p><b>${esc(a.name||'Ability')}</b> ${esc(a.effect||'')}</p>`).join('');
      const attacks=(card.attacks||[]).map(a=>`<p><b>${esc(a.name||'Attack')}${a.damage?` · ${esc(a.damage)}`:''}</b> ${esc(a.effect||'')}</p>`).join('');
      const weak=(card.weaknesses||[]).map(x=>`${x.type} ${x.value}`).join(', ');
      panel.innerHTML=`${abilities}${attacks}<div class="card-search-detail-meta">${[
        card.hp?`HP ${card.hp}`:'',
        card.retreat!=null?`Retreat ${card.retreat}`:'',
        weak?`Weak ${weak}`:'',
        card.illustrator?`Illus. ${card.illustrator}`:''
      ].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`;
      row.appendChild(panel);
    }catch{}
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

  async function addCard(id){
    const text=$('deckText');
    if(!text)return;
    const button=document.querySelector(`[data-card-add="${CSS.escape(id)}"]`);
    if(button){button.disabled=true;button.textContent='Adding…';}
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
      if(button){button.textContent='Added ✓';setTimeout(()=>{button.disabled=false;button.textContent='Add';},900);}
      const status=$('cardSearchStatus');
      if(status)status.textContent=`Added ${exact.name} (${exact.set} ${exact.number}) to the working list.`;
    }catch(error){
      if(button){button.disabled=false;button.textContent='Add';}
      const status=$('cardSearchStatus');if(status)status.textContent=error?.message||'Could not add this card.';
    }
  }

  function clear(){
    $('cardSearchForm').reset();
    $('cardSearchFormat').value='standard';
    page=1;
    $('cardSearchResults').innerHTML='';
    $('cardSearchStatus').textContent='Search the Pokémon TCG card database.';
    $('cardSearchPage').textContent='Page 1';
    $('cardSearchPrev').disabled=true;$('cardSearchNext').disabled=true;
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('#browseCardsButton'))open('browse');
    if(event.target.closest('#addCardButton'))open('add');
    if(event.target.closest('[data-close-card-search]'))close();
    const detail=event.target.closest('[data-card-detail]');if(detail)showDetail(detail.dataset.cardDetail);
    const add=event.target.closest('[data-card-add]');if(add)addCard(add.dataset.cardAdd);
    if(event.target.closest('#cardSearchClear'))clear();
    if(event.target.closest('#cardSearchPrev')){page=Math.max(1,page-1);runSearch();}
    if(event.target.closest('#cardSearchNext')){page+=1;runSearch();}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='cardSearchForm')return;
    event.preventDefault();page=1;runSearch();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('cardSearchSheet')&&!$('cardSearchSheet').hidden)close();});

  ensureUi();
})();
