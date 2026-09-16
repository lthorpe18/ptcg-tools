(function(){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';
  const PAGE_SIZE=48;
  const POKEMON=[
    'Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise','Caterpie','Metapod','Butterfree','Weedle','Kakuna','Beedrill','Pidgey','Pidgeotto','Pidgeot','Rattata','Raticate','Spearow','Fearow','Ekans','Arbok','Pikachu','Raichu','Sandshrew','Sandslash','Nidoran♀','Nidorina','Nidoqueen','Nidoran♂','Nidorino','Nidoking','Clefairy','Clefable','Vulpix','Ninetales','Jigglypuff','Wigglytuff','Zubat','Golbat','Oddish','Gloom','Vileplume','Paras','Parasect','Venonat','Venomoth','Diglett','Dugtrio','Meowth','Persian','Psyduck','Golduck','Mankey','Primeape','Growlithe','Arcanine','Poliwag','Poliwhirl','Poliwrath','Abra','Kadabra','Alakazam','Machop','Machoke','Machamp','Bellsprout','Weepinbell','Victreebel','Tentacool','Tentacruel','Geodude','Graveler','Golem','Ponyta','Rapidash','Slowpoke','Slowbro','Magnemite','Magneton',"Farfetch'd",'Doduo','Dodrio','Seel','Dewgong','Grimer','Muk','Shellder','Cloyster','Gastly','Haunter','Gengar','Onix','Drowzee','Hypno','Krabby','Kingler','Voltorb','Electrode','Exeggcute','Exeggutor','Cubone','Marowak','Hitmonlee','Hitmonchan','Lickitung','Koffing','Weezing','Rhyhorn','Rhydon','Chansey','Tangela','Kangaskhan','Horsea','Seadra','Goldeen','Seaking','Staryu','Starmie','Mr. Mime','Scyther','Jynx','Electabuzz','Magmar','Pinsir','Tauros','Magikarp','Gyarados','Lapras','Ditto','Eevee','Vaporeon','Jolteon','Flareon','Porygon','Omanyte','Omastar','Kabuto','Kabutops','Aerodactyl','Snorlax','Articuno','Zapdos','Moltres','Dratini','Dragonair','Dragonite','Mewtwo','Mew'
  ].map((name,index)=>({number:index+1,name}));

  const grid=document.getElementById('pokedex-grid');
  const ownedCount=document.getElementById('owned-count');
  const chosenCount=document.getElementById('chosen-count');
  const searchDialog=document.getElementById('search-dialog');
  const zoomDialog=document.getElementById('zoom-dialog');
  const pickerNumber=document.getElementById('picker-number');
  const pickerTitle=document.getElementById('picker-title');
  const searchForm=document.getElementById('search-form');
  const searchInput=document.getElementById('card-search');
  const filtersToggle=document.getElementById('filters-toggle');
  const filtersPanel=document.getElementById('filters-panel');
  const removeChoice=document.getElementById('remove-choice');
  const resultsStatus=document.getElementById('results-status');
  const resultsRoot=document.getElementById('card-results');
  const showMore=document.getElementById('show-more');
  const setFilter=document.getElementById('filter-set');
  const filters={
    regulation:document.getElementById('filter-regulation'),
    type:document.getElementById('filter-type'),
    stage:document.getElementById('filter-stage'),
    rarity:document.getElementById('filter-rarity'),
    illustrator:document.getElementById('filter-illustrator'),
    hpMin:document.getElementById('filter-hp-min'),
    hpMax:document.getElementById('filter-hp-max'),
    standard:document.getElementById('filter-standard')
  };

  const catalog=window.PTCGCardCatalog;
  const images=window.PTCGCardImages;
  let state=loadState();
  let activePokemon=null;
  let searchResults=[];
  let visibleCount=PAGE_SIZE;
  let searchSerial=0;
  let zoomCard=null;
  let setOptionsLoaded=false;
  let debounceTimer=null;

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
  function dexNumber(number){return `#${String(number).padStart(3,'0')}`;}
  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }
  function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  function slotState(number){return state[String(number)]||null;}
  function imageUrl(card,quality='low'){
    const root=String(card?.image||'').trim().replace(/\/$/,'');
    return root?`${root}/${quality==='high'?'high':'low'}.webp`:'';
  }

  function renderGrid(){
    grid.innerHTML=POKEMON.map(pokemon=>{
      const saved=slotState(pokemon.number);
      const hasCard=Boolean(saved?.card?.id);
      const owned=Boolean(hasCard&&saved.owned);
      const art=hasCard?imageUrl(saved.card,'low'):'';
      return `<article class="dex-slot${owned?' owned':''}" data-number="${pokemon.number}">
        <button class="slot-main" type="button" data-open-picker="${pokemon.number}" aria-label="Choose card for ${escapeHtml(pokemon.name)}">
          ${art?`<img class="slot-art" src="${escapeHtml(art)}" alt="${escapeHtml(saved.card.name||pokemon.name)} card art" loading="lazy" decoding="async">`:`<span class="slot-fallback"><strong>${dexNumber(pokemon.number)}</strong><span>${escapeHtml(pokemon.name)}</span></span>`}
          <span class="slot-overlay"><span class="slot-number">${dexNumber(pokemon.number)}</span><span class="slot-name">${escapeHtml(pokemon.name)}</span></span>
        </button>
        ${hasCard?`<button class="owned-toggle" type="button" data-owned-toggle="${pokemon.number}" aria-label="Mark ${escapeHtml(pokemon.name)} as ${owned?'not owned':'owned'}" aria-pressed="${owned}">✓</button>`:''}
      </article>`;
    }).join('');

    const chosen=POKEMON.filter(item=>slotState(item.number)?.card?.id).length;
    const owned=POKEMON.filter(item=>slotState(item.number)?.card?.id&&slotState(item.number)?.owned).length;
    chosenCount.textContent=`${chosen} chosen`;
    ownedCount.textContent=`${owned} / 151 owned`;
  }

  async function ensureSetOptions(){
    if(setOptionsLoaded||!catalog?.sets)return;
    setOptionsLoaded=true;
    try{
      const sets=await catalog.sets();
      const rows=[...(sets||[])].sort((a,b)=>String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||'')));
      setFilter.insertAdjacentHTML('beforeend',rows.map(set=>`<option value="${escapeHtml(set.id)}">${escapeHtml(set.name||set.id)}</option>`).join(''));
    }catch{
      setOptionsLoaded=false;
    }
  }

  function openPicker(number){
    activePokemon=POKEMON[number-1];
    if(!activePokemon)return;
    pickerNumber.textContent=dexNumber(activePokemon.number);
    pickerTitle.textContent=activePokemon.name;
    searchInput.value=activePokemon.name;
    removeChoice.hidden=!slotState(number)?.card?.id;
    searchResults=[];
    visibleCount=PAGE_SIZE;
    resultsRoot.innerHTML='';
    resultsStatus.textContent='Searching…';
    searchDialog.showModal();
    ensureSetOptions();
    runSearch();
    requestAnimationFrame(()=>searchInput.focus({preventScroll:true}));
  }

  function currentSearchParams(){
    return {
      name:searchInput.value.trim(),
      category:'Pokemon',
      setId:setFilter.value,
      regulationMark:filters.regulation.value,
      type:filters.type.value,
      stage:filters.stage.value,
      rarity:filters.rarity.value.trim(),
      illustrator:filters.illustrator.value.trim(),
      hpMin:filters.hpMin.value,
      hpMax:filters.hpMax.value,
      standardOnly:filters.standard.checked
    };
  }

  async function runSearch(){
    if(!catalog?.searchAdvanced){
      resultsStatus.textContent='Card search is unavailable.';
      return;
    }
    const serial=++searchSerial;
    const params=currentSearchParams();
    visibleCount=PAGE_SIZE;
    resultsStatus.textContent='Searching…';
    showMore.hidden=true;
    try{
      const rows=await catalog.searchAdvanced(params);
      if(serial!==searchSerial)return;
      searchResults=rows||[];
      renderResults();
    }catch(error){
      if(serial!==searchSerial)return;
      searchResults=[];
      resultsRoot.innerHTML='';
      resultsStatus.textContent=error?.message||'Could not search cards.';
    }
  }

  function cardMeta(card){
    const pieces=[card?.set?.name,card?.localId?`#${card.localId}`:'',card?.rarity].filter(Boolean);
    return pieces.join(' · ');
  }

  function renderResults(){
    const visible=searchResults.slice(0,visibleCount);
    if(!searchResults.length){
      resultsRoot.innerHTML='';
      resultsStatus.textContent='No matching cards.';
      showMore.hidden=true;
      return;
    }
    resultsStatus.textContent=searchResults.length>visible.length?`Showing ${visible.length} of ${searchResults.length} cards`:`${searchResults.length} card${searchResults.length===1?'':'s'}`;
    resultsRoot.innerHTML=visible.map(card=>{
      const art=catalog.image(card,'low')||imageUrl(card,'low');
      return `<article class="search-card" data-card-id="${escapeHtml(card.id)}">
        <button class="preview-button" type="button" data-preview-card="${escapeHtml(card.id)}" aria-label="View ${escapeHtml(card.name)} larger">
          ${art?`<img src="${escapeHtml(art)}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async">`:'<span class="slot-fallback">No image</span>'}
        </button>
        <div class="result-copy"><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(cardMeta(card))}</span></div>
        <button class="choose-button" type="button" data-choose-card="${escapeHtml(card.id)}" aria-label="Choose ${escapeHtml(card.name)}">+</button>
      </article>`;
    }).join('');
    showMore.hidden=visible.length>=searchResults.length;
  }

  async function loadCard(id){
    const existing=searchResults.find(card=>card.id===id);
    if(existing?.attacks||existing?.abilities||existing?.regulationMark||existing?.image)return existing;
    try{return await catalog.card(id)||existing||null;}catch{return existing||null;}
  }

  function compactCard(card){
    return {
      id:card.id,
      name:card.name,
      localId:card.localId,
      image:card.image,
      rarity:card.rarity||'',
      illustrator:card.illustrator||'',
      regulationMark:card.regulationMark||'',
      set:card.set?{id:card.set.id||'',name:card.set.name||''}:null
    };
  }

  async function chooseCard(id){
    if(!activePokemon)return;
    const card=await loadCard(id);
    if(!card?.id)return;
    const key=String(activePokemon.number);
    state[key]={card:compactCard(card),owned:Boolean(state[key]?.owned)};
    saveState();
    renderGrid();
    removeChoice.hidden=false;
    if(zoomDialog.open)zoomDialog.close();
    searchDialog.close();
  }

  async function previewCard(id){
    const card=await loadCard(id);
    if(!card)return;
    zoomCard=card;
    document.getElementById('zoom-name').textContent=card.name||'';
    document.getElementById('zoom-meta').textContent=cardMeta(card);
    const image=document.getElementById('zoom-image');
    image.src=catalog.image(card,'high')||imageUrl(card,'high')||catalog.image(card,'low')||'';
    image.alt=`${card.name||'Card'} card`;
    zoomDialog.showModal();
  }

  function clearFilters(){
    setFilter.value='';
    Object.entries(filters).forEach(([key,element])=>{
      if(key==='standard')element.checked=false;
      else element.value='';
    });
    runSearch();
  }

  grid.addEventListener('click',event=>{
    const ownedButton=event.target.closest('[data-owned-toggle]');
    if(ownedButton){
      const number=ownedButton.dataset.ownedToggle;
      if(state[number]?.card){
        state[number].owned=!state[number].owned;
        saveState();
        renderGrid();
      }
      return;
    }
    const pickerButton=event.target.closest('[data-open-picker]');
    if(pickerButton)openPicker(Number(pickerButton.dataset.openPicker));
  });

  resultsRoot.addEventListener('click',event=>{
    const choose=event.target.closest('[data-choose-card]');
    if(choose){chooseCard(choose.dataset.chooseCard);return;}
    const preview=event.target.closest('[data-preview-card]');
    if(preview)previewCard(preview.dataset.previewCard);
  });

  searchForm.addEventListener('submit',event=>{event.preventDefault();runSearch();});
  searchInput.addEventListener('input',()=>{clearTimeout(debounceTimer);debounceTimer=setTimeout(runSearch,320);});
  setFilter.addEventListener('change',runSearch);
  Object.values(filters).forEach(element=>element.addEventListener('change',runSearch));

  filtersToggle.addEventListener('click',()=>{
    const opening=filtersPanel.hidden;
    filtersPanel.hidden=!opening;
    filtersToggle.setAttribute('aria-expanded',String(opening));
  });
  document.getElementById('clear-filters').addEventListener('click',clearFilters);
  document.getElementById('close-picker').addEventListener('click',()=>searchDialog.close());
  document.getElementById('close-zoom').addEventListener('click',()=>zoomDialog.close());
  document.getElementById('zoom-choose').addEventListener('click',()=>{if(zoomCard?.id)chooseCard(zoomCard.id);});
  showMore.addEventListener('click',()=>{visibleCount+=PAGE_SIZE;renderResults();});
  removeChoice.addEventListener('click',()=>{
    if(!activePokemon)return;
    delete state[String(activePokemon.number)];
    saveState();
    renderGrid();
    removeChoice.hidden=true;
    searchDialog.close();
  });

  [searchDialog,zoomDialog].forEach(dialog=>dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  }));
  images?.bindFallback?.(document);
  renderGrid();
})();
