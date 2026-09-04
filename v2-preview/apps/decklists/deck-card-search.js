(function(){
  'use strict';

  const catalog=window.PTCGCardCatalog;
  const parser=window.PTCGDeckParser;
  if(!catalog||!parser)return;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const PAGE_SIZE=36;
  let mode='browse',page=1,debounceTimer=null,requestSeq=0,currentBriefs=[],setsLoaded=false;

  function ensureUi(){
    const nav=$('workspaceNav');
    if(nav&&!nav.querySelector('[data-workspace="cards"]')){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.workspace='cards';
      button.setAttribute('aria-selected','false');
      button.textContent='Card Search';
      nav.appendChild(button);
    }

    document.getElementById('browseCardsButton')?.remove();
    const libraryMenu=$('libraryMenu');
    if(libraryMenu){
      libraryMenu.textContent='•••';
      libraryMenu.setAttribute('aria-label','Deck library options');
      libraryMenu.setAttribute('title','Deck library options');
      libraryMenu.classList.add('library-options-button');
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

    if(!$('cardSearchScreen')){
      const screen=document.createElement('section');
      screen.id='cardSearchScreen';
      screen.hidden=true;
      screen.innerHTML='<div id="cardSearchInlineMount" class="card-search-inline-mount"></div>';
      nav?.insertAdjacentElement('afterend',screen);
    }

    if(!$('cardSearchOverlay')){
      document.body.insertAdjacentHTML('beforeend',`
        <div id="cardSearchOverlay" class="card-search-screen" hidden>
          <section class="card-search-card" role="dialog" aria-modal="true" aria-labelledby="cardSearchTitle">
            <header class="card-search-head">
              <div><small>DECK EDITOR</small><h2 id="cardSearchTitle">Add card</h2></div>
              <button class="sheet-close" type="button" data-close-card-search aria-label="Close">×</button>
            </header>
            <div id="cardSearchOverlayMount"></div>
          </section>
        </div>`);
    }

    if(!$('cardSearchSurface')){
      const surface=document.createElement('div');
      surface.id='cardSearchSurface';
      surface.className='card-search-surface';
      surface.innerHTML=`
        <div class="card-search-controls">
          <div class="card-search-input-row">
            <input id="cardSearchName" type="search" placeholder="Search card name…" autocomplete="off" aria-label="Card name">
            <button id="cardFilterButton" class="card-filter-button" type="button" aria-label="Advanced search filters" title="Advanced search filters">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M10 17h10M4 17h2M14 4v6M10 14v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="7" r="2" fill="currentColor"/><circle cx="10" cy="17" r="2" fill="currentColor"/></svg>
              <span id="cardFilterBadge" class="card-filter-badge" hidden></span>
            </button>
          </div>
        </div>
        <div id="cardSearchStatus" class="card-search-status">Type a card name, or use advanced filters.</div>
        <section id="cardSearchResults" class="card-search-results" aria-live="polite"></section>
        <div class="card-search-more"><button id="cardSearchMore" class="app-button" type="button" hidden>More results</button></div>`;
      $('cardSearchInlineMount')?.appendChild(surface);
    }

    if(!$('cardFilterOverlay')){
      document.body.insertAdjacentHTML('beforeend',`
        <div id="cardFilterOverlay" class="card-filter-overlay" hidden>
          <section class="card-filter-panel" role="dialog" aria-modal="true" aria-labelledby="cardFilterTitle">
            <header class="card-filter-head"><div><small>CARD DATABASE</small><h2 id="cardFilterTitle">Advanced search</h2></div><button class="sheet-close" type="button" data-close-card-filter aria-label="Close">×</button></header>
            <div class="card-filter-fields">
              <label class="wide">Card text contains<input id="cardFilterText" type="search" placeholder="e.g. switch your Active Pokémon" autocomplete="off"><small>Searches effects, attacks, abilities, rules and other printed card text.</small></label>
              <label>Format<select id="cardFilterFormat"><option value="all">All cards</option><option value="standard">Standard</option></select></label>
              <label>Category<select id="cardFilterCategory"><option value="">Any</option><option value="Pokemon">Pokémon</option><option value="Trainer">Trainer</option><option value="Energy">Energy</option></select></label>
              <label class="wide">Set<select id="cardFilterSet"><option value="">All sets</option></select></label>
              <label>Regulation mark<select id="cardFilterReg"><option value="">Any</option><option>D</option><option>E</option><option>F</option><option>G</option><option>H</option><option>I</option><option>J</option></select></label>
              <label>Pokémon type<select id="cardFilterType"><option value="">Any</option><option>Colorless</option><option>Darkness</option><option>Dragon</option><option>Fairy</option><option>Fighting</option><option>Fire</option><option>Grass</option><option>Lightning</option><option>Metal</option><option>Psychic</option><option>Water</option></select></label>
              <label>Stage<input id="cardFilterStage" type="text" placeholder="Basic, Stage1…"></label>
              <label>Trainer type<select id="cardFilterTrainer"><option value="">Any</option><option>Item</option><option>Supporter</option><option>Stadium</option><option>Tool</option></select></label>
              <label>Rarity<input id="cardFilterRarity" type="text" placeholder="e.g. Rare"></label>
              <label>Illustrator<input id="cardFilterIllustrator" type="text" placeholder="Name contains…"></label>
              <label>Minimum HP<input id="cardFilterHpMin" type="number" min="0" step="10" inputmode="numeric" placeholder="Any"></label>
              <label>Maximum HP<input id="cardFilterHpMax" type="number" min="0" step="10" inputmode="numeric" placeholder="Any"></label>
            </div>
            <footer class="card-filter-actions"><button id="cardFilterClear" class="app-button" type="button">Clear</button><button id="cardFilterApply" class="app-button primary" type="button">Apply filters</button></footer>
          </section>
        </div>`);
    }

    if(!$('cardZoomOverlay')){
      document.body.insertAdjacentHTML('beforeend',`<div id="cardZoomOverlay" class="card-zoom-overlay" hidden role="dialog" aria-modal="true" aria-label="Card image"><img id="cardZoomImage" alt=""></div>`);
    }

    if(!$('cardZoomStyle')){
      const style=document.createElement('style');
      style.id='cardZoomStyle';
      style.textContent='.card-search-tile.zoomable{cursor:zoom-in}.card-zoom-overlay{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;padding:max(18px,env(safe-area-inset-top)) 18px max(18px,env(safe-area-inset-bottom));background:rgba(0,0,0,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.card-zoom-overlay[hidden]{display:none}.card-zoom-overlay img{display:block;max-width:min(92vw,520px);max-height:90dvh;width:auto;height:auto;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.45);cursor:zoom-out}';
      document.head.appendChild(style);
    }
  }

  function selectWorkspace(value){document.querySelectorAll('[data-workspace]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.workspace===value)))}

  function mountSurface(hostId){const surface=$('cardSearchSurface'),host=$(hostId);if(surface&&host&&surface.parentElement!==host)host.appendChild(surface)}

  function rerenderCurrentPage(){
    if(!currentBriefs.length)return;
    const start=(page-1)*PAGE_SIZE;
    renderResults(currentBriefs.slice(start,start+PAGE_SIZE),false);
    const more=$('cardSearchMore');if(more)more.hidden=start+PAGE_SIZE>=currentBriefs.length;
  }

  function hideBrowseScreen(){if($('cardSearchScreen'))$('cardSearchScreen').hidden=true;closeZoom();closeFilters()}

  function showBrowse(){
    ensureUi();mode='browse';mountSurface('cardSearchInlineMount');rerenderCurrentPage();$('cardSearchOverlay').hidden=true;
    document.documentElement.classList.remove('sheet-open');document.body.classList.remove('card-search-open');
    if($('libraryScreen'))$('libraryScreen').hidden=true;if($('trainingScreen'))$('trainingScreen').hidden=true;if($('deckScreen'))$('deckScreen').hidden=true;
    if($('workspaceNav'))$('workspaceNav').hidden=false;if($('newDeckTop'))$('newDeckTop').hidden=true;$('cardSearchScreen').hidden=false;selectWorkspace('cards');
    updateSearchHint();setTimeout(()=>$('cardSearchName')?.focus(),20);
  }

  function openAdd(){
    ensureUi();closeZoom();mode='add';mountSurface('cardSearchOverlayMount');rerenderCurrentPage();updateSearchHint();$('cardSearchOverlay').hidden=false;
    document.documentElement.classList.add('sheet-open');document.body.classList.add('card-search-open');setTimeout(()=>$('cardSearchName')?.focus(),20);
  }

  function closeAdd(){
    if(!$('cardSearchOverlay'))return;$('cardSearchOverlay').hidden=true;document.documentElement.classList.remove('sheet-open');document.body.classList.remove('card-search-open');
    mode='browse';mountSurface('cardSearchInlineMount');rerenderCurrentPage();
  }

  function openZoom(src,alt){if(mode!=='browse'||!src)return;ensureUi();const image=$('cardZoomImage');image.src=src;image.alt=alt||'Card';$('cardZoomOverlay').hidden=false}
  function closeZoom(){const overlay=$('cardZoomOverlay');if(!overlay||overlay.hidden)return;overlay.hidden=true;const image=$('cardZoomImage');if(image){image.removeAttribute('src');image.alt=''}}

  async function loadFilterSets(){
    if(setsLoaded)return;
    const select=$('cardFilterSet');
    try{
      const rows=await catalog.sets();
      const current=select.value;
      const sorted=[...rows].sort((a,b)=>String(b.id||'').localeCompare(String(a.id||''),undefined,{numeric:true}));
      select.innerHTML='<option value="">All sets</option>'+sorted.map(set=>`<option value="${esc(set.id)}">${esc(set.name||set.id)}</option>`).join('');
      if([...select.options].some(option=>option.value===current))select.value=current;
      setsLoaded=true;
    }catch{}
  }

  function openFilters(){ensureUi();loadFilterSets();$('cardFilterOverlay').hidden=false;document.body.classList.add('card-filter-open')}
  function closeFilters(){if(!$('cardFilterOverlay'))return;$('cardFilterOverlay').hidden=true;document.body.classList.remove('card-filter-open')}

  function clearFilterFields(){
    $('cardFilterText').value='';$('cardFilterFormat').value='all';$('cardFilterCategory').value='';$('cardFilterSet').value='';$('cardFilterReg').value='';$('cardFilterType').value='';
    $('cardFilterStage').value='';$('cardFilterTrainer').value='';$('cardFilterRarity').value='';$('cardFilterIllustrator').value='';$('cardFilterHpMin').value='';$('cardFilterHpMax').value='';
    updateFilterButton();
  }

  function filters(){
    return {
      text:$('cardFilterText')?.value.trim()||'',standardOnly:$('cardFilterFormat')?.value==='standard',category:$('cardFilterCategory')?.value||'',setId:$('cardFilterSet')?.value||'',
      regulationMark:$('cardFilterReg')?.value||'',type:$('cardFilterType')?.value||'',stage:$('cardFilterStage')?.value.trim()||'',trainerType:$('cardFilterTrainer')?.value||'',
      rarity:$('cardFilterRarity')?.value.trim()||'',illustrator:$('cardFilterIllustrator')?.value.trim()||'',hpMin:$('cardFilterHpMin')?.value||'',hpMax:$('cardFilterHpMax')?.value||''
    };
  }

  function activeFilterCount(){
    const f=filters();
    return Object.entries(f).filter(([key,value])=>key==='standardOnly'?value:Boolean(String(value||'').trim())).length;
  }

  function updateFilterButton(){
    const count=activeFilterCount(),button=$('cardFilterButton'),badge=$('cardFilterBadge');
    if(!button||!badge)return;
    button.classList.toggle('active',count>0);badge.hidden=!count;badge.textContent=count?String(count):'';
  }

  function hasCriteria(name,f){
    if(name.length>=2||f.text.length>=2)return true;
    return Boolean(f.category||f.setId||f.regulationMark||f.type||f.stage||f.trainerType||f.rarity||f.illustrator||f.hpMin||f.hpMax);
  }

  function updateSearchHint(){
    const status=$('cardSearchStatus');if(!status)return;
    const name=$('cardSearchName')?.value.trim()||'',f=filters();
    if(hasCriteria(name,f))return;
    status.textContent=mode==='add'?'Search by card name, or use advanced filters.':'Type a card name, or use advanced filters.';
  }

  async function runSearch(append=false){
    const name=$('cardSearchName').value.trim(),f=filters(),seq=++requestSeq;
    const root=$('cardSearchResults'),status=$('cardSearchStatus'),more=$('cardSearchMore');

    if(!hasCriteria(name,f)){
      currentBriefs=[];page=1;root.innerHTML='';more.hidden=true;updateSearchHint();return;
    }

    if(!append){page=1;root.innerHTML='<div class="card-search-loading">Loading…</div>'}
    status.textContent=f.text?'Searching card text…':'Searching…';more.hidden=true;

    try{
      if(!append){
        currentBriefs=await catalog.searchAdvanced({name,...f});
        if(seq!==requestSeq)return;
      }
      const start=(page-1)*PAGE_SIZE,pageResults=currentBriefs.slice(start,start+PAGE_SIZE);renderResults(pageResults,append);
      const total=currentBriefs.length,filterCount=activeFilterCount();
      status.textContent=total?`${total} printing${total===1?'':'s'} found${filterCount?` · ${filterCount} filter${filterCount===1?'':'s'}`:''}${mode==='add'?' · tap one to add':''}`:'No matching cards found.';
      more.hidden=start+PAGE_SIZE>=total;
    }catch(error){
      if(seq!==requestSeq)return;if(!append)root.innerHTML='';status.textContent=error?.message||'Card search failed.';
    }
  }

  function renderResults(results,append){
    const root=$('cardSearchResults');
    const html=results.map(card=>{
      const image=catalog.image(card,'low'),highImage=catalog.image(card,'high')||image,title=esc(`${card.name||'Card'}${card.localId?` ${card.localId}`:''}`);
      if(mode==='add')return `<button class="card-search-tile addable" type="button" data-card-add="${esc(card.id)}" aria-label="Add ${esc(card.name||'card')}"><img src="${esc(image)}" alt="${title}" loading="lazy" decoding="async"><span class="card-add-badge">+</span></button>`;
      return `<button class="card-search-tile zoomable" type="button" data-card-zoom="${esc(highImage)}" aria-label="View ${title} larger"><img src="${esc(image)}" alt="${title}" loading="lazy" decoding="async"></button>`;
    }).join('');
    if(append)root.insertAdjacentHTML('beforeend',html);else root.innerHTML=html;
  }

  function serialise(parsedDeck){
    const groups=[['pokemon','Pokémon'],['trainers','Trainer'],['energy','Energy'],['unknown','Other']];
    return groups.map(([key,label])=>{const cards=parsedDeck.cards.filter(card=>card.section===key&&Number(card.count)>0);if(!cards.length)return '';const total=cards.reduce((sum,card)=>sum+Number(card.count||0),0);return `${label}: ${total}\n${cards.map(card=>`${card.count} ${card.name}${card.set?` ${card.set}`:''}${card.number?` ${card.number}`:''}`).join('\n')}`}).filter(Boolean).join('\n\n');
  }

  async function addCard(id,button){
    const text=$('deckText');if(!text)return;button.disabled=true;button.classList.add('adding');
    try{
      const full=await catalog.card(id),exact=await catalog.exactDeckIdentity(full);if(!exact)throw new Error(`No deck-list set code is available for ${full?.set?.name||'this printing'} yet.`);
      const deck=parser.parseDeck(text.value||'');
      const existing=deck.cards.find(card=>String(card.name||'').toLocaleLowerCase('en')===String(exact.name||'').toLocaleLowerCase('en')&&String(card.set||'').toUpperCase()===exact.set&&String(card.number||'').toUpperCase()===String(exact.number).toUpperCase());
      if(existing)existing.count=Math.min(60,Number(existing.count||0)+1);else deck.cards.push({count:1,name:exact.name,set:exact.set,number:exact.number,section:exact.section});
      text.value=serialise(deck);text.dispatchEvent(new Event('input',{bubbles:true}));button.classList.remove('adding');button.classList.add('added');button.querySelector('.card-add-badge').textContent='✓';
      $('cardSearchStatus').textContent=`Added ${exact.name} (${exact.set} ${exact.number}).`;
      setTimeout(()=>{button.disabled=false;button.classList.remove('added');const badge=button.querySelector('.card-add-badge');if(badge)badge.textContent='+'},900);
    }catch(error){button.disabled=false;button.classList.remove('adding');$('cardSearchStatus').textContent=error?.message||'Could not add this card.'}
  }

  function queueSearch(){clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>runSearch(false),180)}

  document.addEventListener('input',event=>{if(event.target.id==='cardSearchName')queueSearch()});

  document.addEventListener('click',event=>{
    const zoom=event.target.closest('[data-card-zoom]');if(zoom){openZoom(zoom.dataset.cardZoom,zoom.querySelector('img')?.alt);return}
    if(event.target.closest('#cardZoomOverlay')){closeZoom();return}
    if(event.target.closest('[data-workspace="cards"]'))showBrowse();
    if(event.target.closest('[data-workspace="decks"],[data-workspace="training"]'))hideBrowseScreen();
    if(event.target.closest('#addCardButton'))openAdd();
    if(event.target.closest('[data-close-card-search]'))closeAdd();
    if(event.target.closest('#cardFilterButton'))openFilters();
    if(event.target.closest('[data-close-card-filter]')||event.target=== $('cardFilterOverlay'))closeFilters();
    if(event.target.closest('#cardFilterClear'))clearFilterFields();
    if(event.target.closest('#cardFilterApply')){updateFilterButton();closeFilters();runSearch(false)}
    const add=event.target.closest('[data-card-add]');if(add)addCard(add.dataset.cardAdd,add);
    if(event.target.closest('#cardSearchMore')){page+=1;runSearch(true)}
  });

  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if($('cardFilterOverlay')&&!$('cardFilterOverlay').hidden){closeFilters();return}
    if($('cardZoomOverlay')&&!$('cardZoomOverlay').hidden){closeZoom();return}
    if($('cardSearchOverlay')&&!$('cardSearchOverlay').hidden)closeAdd();
  });

  ensureUi();updateFilterButton();
  window.PTCGCardSearch={showBrowse,hideBrowseScreen,openAdd,closeAdd};
})();
