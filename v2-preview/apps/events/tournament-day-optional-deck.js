(function(){
'use strict';
const participationId=new URLSearchParams(location.search).get('participation');
const now=()=>new Date().toISOString();
let decks=[],pokemonIndexPromise=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
function participation(){return window.PTCGStorage?.getParticipation?.(participationId)||null}
function playedRef(){const ref=participation()?.usedDeckRef;return ref?.deckId?ref:null}
function suggestedRef(){const ref=playedRef()||participation()?.plannedDeckRef;return ref?.deckId?ref:null}
function tournamentMatches(){return (window.PTCGMatchStore?.all?.()||[]).filter(match=>match.participationId===participationId)}
function applyRefToMatches(ref){for(const match of tournamentMatches())window.PTCGMatchStore.put({...match,deckId:ref?.deckId||null,deckVersionId:ref?.deckVersionId||null,listHash:ref?.listHash||null,deckNameSnapshot:ref?.deckNameSnapshot||null,deckVersionLabelSnapshot:ref?.deckVersionLabelSnapshot||null})}
function normalise(text){return String(text||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\b(ex|vstar|vmax|v|gx|mega)\b/g,' ').replace(/\s+/g,' ').trim()}
async function pokemonIndex(){if(!pokemonIndexPromise)pokemonIndexPromise=window.PTCGSprites?.getIndex?.().catch(()=>[])||Promise.resolve([]);return pokemonIndexPromise}
async function spriteUrls(text){if(!text||!window.PTCGSprites)return[];const source=` ${normalise(text)} `,rows=await pokemonIndex(),found=[];for(const item of rows){const phrase=String(item.name||'').toLowerCase().replace(/-/g,' ');if(phrase.length>=3&&source.includes(` ${phrase} `))found.push({name:item.name,len:phrase.length})}const names=found.sort((a,b)=>b.len-a.len).filter((item,index,arr)=>arr.findIndex(x=>x.name===item.name)===index).slice(0,2).map(x=>x.name);const sprites=await Promise.all(names.map(name=>window.PTCGSprites.fetchSprite(name).catch(()=>null)));return sprites.filter(Boolean).map(item=>item.spriteUrl).filter(Boolean)}
async function renderSlot(){
  const summary=document.getElementById('deckSummary'),quick=document.querySelector('.quick-actions');
  if(summary)summary.hidden=true;
  if(!quick)return;
  const ref=playedRef();
  let slot=document.getElementById('tournamentDeckSlot');
  if(!slot){
    slot=document.createElement('button');
    slot.id='tournamentDeckSlot';
    slot.type='button';
    const idCalc=document.getElementById('openIdCalc');
    quick.insertBefore(slot,idCalc||quick.firstChild);
  }
  slot.className=`tournament-deck-slot ${ref?'has-deck':'is-empty'}`;
  slot.setAttribute('aria-label',ref?'Change tournament deck':'Choose tournament deck');
  slot.title=ref?'Change deck':'Choose deck';
  slot.innerHTML='<span class="deck-slot-placeholder">My Deck</span><span class="deck-slot-sprites" aria-hidden="true"></span>';
  if(slot.dataset.bound!=='true'){slot.dataset.bound='true';slot.addEventListener('click',openPicker)}
  const legacy=document.getElementById('manageTournamentDeck');if(legacy)legacy.hidden=true;
  if(!ref)return;
  const urls=await spriteUrls(ref.archetypeSnapshot||ref.deckNameSnapshot||'');
  const host=slot.querySelector('.deck-slot-sprites');
  if(host&&urls.length)host.innerHTML=urls.map(url=>`<img src="${esc(url)}" alt="">`).join('');
}
function ensurePicker(){let backdrop=document.getElementById('deckPickerBackdrop');if(backdrop)return backdrop;backdrop=document.createElement('div');backdrop.id='deckPickerBackdrop';backdrop.className='sheet-backdrop hidden';backdrop.setAttribute('aria-hidden','true');backdrop.innerHTML=`<section class="td-sheet deck-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="deckPickerTitle"><div class="sheet-handle"></div><div class="sheet-head"><div><small>Optional</small><h2 id="deckPickerTitle">Deck played</h2></div><button type="button" class="sheet-close" data-close aria-label="Close">×</button></div><div id="deckPickerStatus" class="deck-picker-status">Loading saved decks…</div><div id="deckPickerControls" class="deck-picker-grid hidden"><label><span>Deck</span><select id="optionalDeckSelect"></select></label><label><span>Version</span><select id="optionalVersionSelect"></select></label></div><button type="button" class="primary-button full-button" id="saveOptionalDeck" disabled>Save deck</button><button type="button" class="secondary-button full-button" id="clearOptionalDeck">Remove deck from tournament</button></section>`;document.body.appendChild(backdrop);backdrop.querySelector('[data-close]').addEventListener('click',closePicker);backdrop.addEventListener('click',event=>{if(event.target===backdrop)closePicker()});backdrop.querySelector('#optionalDeckSelect').addEventListener('change',renderVersions);backdrop.querySelector('#saveOptionalDeck').addEventListener('click',saveDeck);backdrop.querySelector('#clearOptionalDeck').addEventListener('click',clearDeck);return backdrop}
function readDecksDirect(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB unavailable'));return}
    const name=window.PTCGDeckStore?.DB_NAME||'ptcg-tools-db',storeName=window.PTCGDeckStore?.STORE||'decks';
    const request=indexedDB.open(name);
    request.onerror=()=>reject(request.error||new Error('Could not open deck database'));
    request.onsuccess=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains(storeName)){database.close();resolve([]);return}
      let tx;
      try{tx=database.transaction([storeName],'readonly')}catch(error){database.close();reject(error);return}
      const get=tx.objectStore(storeName).getAll();
      get.onsuccess=()=>{
        const raw=Array.isArray(get.result)?get.result:[];
        const rows=raw.map(row=>{try{return window.PTCGDeckStore?.normalise?window.PTCGDeckStore.normalise(row):row}catch{return row}}).filter(Boolean);
        database.close();resolve(rows);
      };
      get.onerror=()=>{database.close();reject(get.error||new Error('Could not read saved decks'))};
    };
  });
}
async function loadDeckRows(){
  let primaryError=null;
  try{
    if(typeof window.PTCGDeckStore?.all==='function')return await window.PTCGDeckStore.all();
    primaryError=new TypeError('PTCGDeckStore.all unavailable');
  }catch(error){primaryError=error;console.warn('Deck store prepared read failed; using raw IndexedDB fallback',error)}
  try{return await readDecksDirect()}catch(error){error.cause=primaryError;throw error}
}
async function openPicker(){
  const backdrop=ensurePicker();backdrop.classList.remove('hidden');backdrop.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  const status=document.getElementById('deckPickerStatus'),controls=document.getElementById('deckPickerControls'),save=document.getElementById('saveOptionalDeck');
  status.textContent='Loading saved decks…';status.classList.remove('hidden');controls.classList.add('hidden');save.disabled=true;document.getElementById('clearOptionalDeck').disabled=!playedRef();
  try{
    decks=(await loadDeckRows())||[];
    const select=document.getElementById('optionalDeckSelect'),ref=suggestedRef();
    select.innerHTML=`<option value="">Choose a deck</option>${decks.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).map(deck=>`<option value="${esc(deck.id)}">${esc(deck.name||'Untitled deck')}${deck.archetype?` · ${esc(deck.archetype)}`:''}</option>`).join('')}`;
    if(ref?.deckId&&decks.some(deck=>deck.id===ref.deckId))select.value=ref.deckId;
    renderVersions();
    status.textContent=decks.length?'':'No saved decks found.';
    status.classList.toggle('hidden',decks.length>0);
    controls.classList.remove('hidden');
    save.disabled=decks.length===0;
  }catch(error){
    console.error('Tournament deck picker could not read decks',error);
    status.textContent=`Could not load saved decks${error?.name?` (${error.name})`:''}.`;
    controls.classList.add('hidden');save.disabled=true;
  }
}
function renderVersions(){const deck=decks.find(item=>item.id===document.getElementById('optionalDeckSelect')?.value),select=document.getElementById('optionalVersionSelect');if(!select)return;const ref=suggestedRef();select.innerHTML=`<option value="">Choose exact version</option>${(deck?.versions||[]).slice().reverse().map(version=>`<option value="${esc(version.id)}">${esc(version.name?`${version.label} · ${version.name}`:version.label)}</option>`).join('')}`;const preferred=ref?.deckId===deck?.id?ref.deckVersionId:deck?.currentVersionId;if(preferred&&(deck?.versions||[]).some(version=>version.id===preferred))select.value=preferred}
function closePicker(){const backdrop=document.getElementById('deckPickerBackdrop');if(backdrop){backdrop.classList.add('hidden');backdrop.setAttribute('aria-hidden','true')}document.body.style.overflow=''}
async function saveDeck(){
  const deck=decks.find(item=>item.id===document.getElementById('optionalDeckSelect')?.value),version=deck&&(deck.versions||[]).find(item=>item.id===document.getElementById('optionalVersionSelect')?.value);
  if(!deck||!version){alert('Choose a saved deck and exact version.');return}
  let listHash=version.listHash||null;
  if(!listHash&&window.PTCGDeckParser?.hashDecklist)listHash=await window.PTCGDeckParser.hashDecklist(version.rawText||'');
  if(!listHash){alert('That deck version could not be identified.');return}
  const ref={deckId:deck.id,deckVersionId:version.id,listHash,deckNameSnapshot:deck.name||null,deckVersionLabelSnapshot:version.name?`${version.label} · ${version.name}`:version.label||null,archetypeSnapshot:deck.archetype||null,selectedAt:now()};
  window.PTCGStorage.updateParticipation(participationId,row=>{row.usedDeckRef=ref;row.tournamentDay={...(row.tournamentDay||{}),lastOpenedAt:now()};return row});
  applyRefToMatches(ref);closePicker();renderSlot();
}
function clearDeck(){if(!playedRef())return;window.PTCGStorage.updateParticipation(participationId,row=>{row.usedDeckRef=null;return row});applyRefToMatches(null);closePicker();renderSlot()}
const observer=new MutationObserver(()=>{if(!document.getElementById('tournamentDeckSlot'))setTimeout(renderSlot,0)});
function boot(){renderSlot();const quick=document.querySelector('.quick-actions');if(quick)observer.observe(quick,{childList:true,subtree:true});window.addEventListener('ptcg:local-change',()=>setTimeout(renderSlot,0))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
