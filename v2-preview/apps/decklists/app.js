(function(){
'use strict';

const $=id=>document.getElementById(id);
let decks=[],active=null,activeTab='overview',dirty=false,unsubscribeStore=null;

function toast(msg){
  const el=$('toast');
  el.textContent=msg;
  el.hidden=false;
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.hidden=true,2200);
}
function esc(value){
  return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
function ago(ts){
  if(!ts)return '—';
  const minutes=Math.max(0,Math.floor((Date.now()-ts)/60000));
  if(minutes<1)return 'just now';
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
}
function parsed(){return window.PTCGDeckParser.parseDeck($('deckText').value||'')}
function canonical(value){return window.PTCGDeckParser.canonicalDecklist(value||'')}
function currentVersion(deck=active){return window.PTCGDeckStore.currentVersion(deck)}
function versionTitle(version){return version?.label||`V${version?.ordinal||1}`}
function versionDescription(version){return [version?.name,new Date(version?.createdAt||Date.now()).toLocaleDateString()].filter(Boolean).join(' · ')}
function workingMatches(version){return !!version&&canonical($('deckText').value)===canonical(version.rawText)}
function summary(deck){
  const parsedDeck=window.PTCGDeckParser.parseDeck(deck.rawText||'');
  const version=currentVersion(deck);
  const versionText=version?` · ${versionTitle(version)}`:' · no version';
  return `${parsedDeck.totalCards} cards${versionText} · ${ago(deck.updatedAt)}`;
}
async function refresh(){
  decks=await window.PTCGDeckStore.all();
  renderLibrary();
}
function renderLibrary(){
  const q=$('search').value.trim().toLowerCase(),sort=$('sort').value;
  const list=decks.filter(deck=>`${deck.name||''} ${deck.archetype||''}`.toLowerCase().includes(q));
  list.sort((a,b)=>sort==='name'?(a.name||'').localeCompare(b.name||''):(b.updatedAt||0)-(a.updatedAt||0));
  $('deckGrid').innerHTML=list.map(deck=>`
    <article class="deck-card" tabindex="0" role="button" data-id="${esc(deck.id)}">
      <div><h3>${esc(deck.name)}</h3>${deck.archetype?`<span class="deck-archetype">${esc(deck.archetype)}</span>`:''}<p>${esc(summary(deck))}</p></div>
      <div class="deck-card-sprites">${(deck.sprites||[]).filter(Boolean).map(sprite=>`<img src="${esc(sprite.spriteUrl||'')}" alt="${esc(sprite.name||'')}">`).join('')}</div>
    </article>`).join('');
  $('emptyState').hidden=list.length>0;
}
function showLibrary(){
  active=null;
  dirty=false;
  if($('trainingScreen'))$('trainingScreen').hidden=true;
  if($('workspaceNav'))$('workspaceNav').hidden=false;
  if($('newDeckTop'))$('newDeckTop').hidden=false;
  document.querySelectorAll('[data-workspace]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.workspace==='decks')));
  $('libraryScreen').hidden=false;
  $('deckScreen').hidden=true;
  refresh();
}
function fillEditor(deck){
  $('deckName').value=deck.name||'';
  $('deckArchetype').value=deck.archetype||'';
  $('deckSourceUrl').value=deck.sourceUrl||'';
  $('deckText').value=deck.rawText||'';
  $('sprite1').value=deck.sprites?.[0]?.name||'';
  $('sprite2').value=deck.sprites?.[1]?.name||'';
}
async function openDeck(id){
  const deck=await window.PTCGDeckStore.get(id);
  if(!deck)return;
  active=JSON.parse(JSON.stringify(deck));
  fillEditor(active);
  if($('trainingScreen'))$('trainingScreen').hidden=true;
  if($('workspaceNav'))$('workspaceNav').hidden=true;
  $('libraryScreen').hidden=true;
  $('deckScreen').hidden=false;
  dirty=false;
  setTab('overview');
  renderDeck();
}
function workingContext(){
  const version=currentVersion();
  if(!version)return {title:'Working list',detail:'No version saved yet',changed:Boolean(canonical($('deckText').value))};
  if(workingMatches(version))return {title:versionTitle(version),detail:'Working list matches this version',changed:false};
  return {title:'Working list',detail:`Changed from ${versionTitle(version)}`,changed:true};
}
function renderWorkingStatus(){
  const context=workingContext();
  $('workingListStatus').innerHTML=`<b>${esc(context.title)}</b><span>${esc(context.detail)}</span>`;
  $('workingListStatus').classList.toggle('changed',context.changed);
}
function renderDeck(){
  if(!active)return;
  const parsedDeck=parsed(),context=workingContext();
  $('deckSummary').textContent=`${parsedDeck.totalCards} cards · ${context.detail}`;
  $('cardCountPill').textContent=`${parsedDeck.totalCards} cards`;
  $('saveStatus').textContent=dirty?'Unsaved changes':`Saved ${ago(active.updatedAt)}`;
  $('deckHeaderSprites').innerHTML=(active.sprites||[]).filter(Boolean).map(sprite=>`<img src="${esc(sprite.spriteUrl||'')}" alt="${esc(sprite.name||'')}">`).join('');
  $('overviewMetrics').innerHTML=[
    ['Cards',parsedDeck.totalCards],
    ['Pokémon',parsedDeck.totals.pokemon],
    ['Trainers',parsedDeck.totals.trainers],
    ['Energy',parsedDeck.totals.energy]
  ].map(([label,value])=>`<div class="metric-mini"><b>${value}</b><span>${label}</span></div>`).join('');
  renderWorkingStatus();
  renderVersions();
  renderPreview(parsedDeck);
  renderOdds(parsedDeck);
}
function renderVersions(){
  const list=[...(active?.versions||[])].reverse();
  if(!list.length){
    $('versionList').innerHTML='<div class="version-empty">No versions yet. Save one when this list becomes meaningful.</div>';
    return;
  }
  $('versionList').innerHTML=list.map(version=>{
    const selected=version.id===active.currentVersionId;
    const matches=workingMatches(version);
    return `<div class="version-row ${selected?'current':''}">
      <div><b>${esc(versionTitle(version))}</b><small>${esc(versionDescription(version))}${selected?' · current version':''}${matches?' · matches working list':''}</small></div>
      <button type="button" data-load-version="${esc(version.id)}">Use as working list</button>
    </div>`;
  }).join('');
}
function renderPreview(parsedDeck){
  const sections=[['pokemon','Pokémon'],['trainers','Trainers'],['energy','Energy'],['unknown','Other']];
  const visible=sections.filter(([key])=>parsedDeck.sections[key]?.length);
  if(!visible.length){
    $('parsedPreview').innerHTML='<div class="app-empty"><strong>No cards yet</strong><p>Paste a PTCGL or Limitless list below to start editing.</p></div>';
    return;
  }
  $('parsedPreview').innerHTML=visible.map(([key,label])=>`
    <section class="parsed-section ${key}"><h3><span>${label}</span><span>${parsedDeck.totals[key]||0}</span></h3>
      ${parsedDeck.sections[key].map(card=>{
        const index=parsedDeck.cards.indexOf(card),print=[card.set,card.number].filter(Boolean).join(' ');
        return `<div class="parsed-card"><div class="parsed-card-copy"><b>${esc(card.name)}</b>${print?`<small>${esc(print)}</small>`:''}</div><div class="quantity-editor"><button type="button" data-card-change="-1" data-card-index="${index}" aria-label="Remove one ${esc(card.name)}">−</button><output>${card.count}</output><button type="button" data-card-change="1" data-card-index="${index}" aria-label="Add one ${esc(card.name)}">+</button></div></div>`;
      }).join('')}
    </section>`).join('');
}
function serialiseCards(parsedDeck){
  const groups=[['pokemon','Pokémon'],['trainers','Trainer'],['energy','Energy'],['unknown','Other']];
  return groups.map(([key,label])=>{
    const cards=parsedDeck.cards.filter(card=>card.section===key&&card.count>0);
    if(!cards.length)return '';
    const total=cards.reduce((sum,card)=>sum+card.count,0);
    return `${label}: ${total}\n${cards.map(card=>`${card.count} ${card.name}${card.set?` ${card.set}`:''}${card.number?` ${card.number}`:''}`).join('\n')}`;
  }).filter(Boolean).join('\n\n');
}
function changeCardCount(index,delta){
  const parsedDeck=parsed(),card=parsedDeck.cards[Number(index)];
  if(!card)return;
  card.count=Math.max(0,Math.min(60,Number(card.count||0)+Number(delta||0)));
  $('deckText').value=serialiseCards(parsedDeck);
  markDirty();
}
function cardOptions(parsedDeck){
  const cards=new Map();
  parsedDeck.cards.forEach(card=>cards.set(card.name,(cards.get(card.name)||0)+card.count));
  return [...cards.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function renderOdds(parsedDeck){
  const options=cardOptions(parsedDeck),select=$('oddsCard'),prior=select.value;
  select.innerHTML=options.map(([name,count])=>`<option value="${esc(name)}">${esc(name)} · ${count}</option>`).join('');
  if(options.some(([name])=>name===prior))select.value=prior;
  const name=select.value;
  if(!name){
    $('oddsResults').innerHTML='<div class="app-empty">Add cards to the deck list to calculate odds.</div>';
    $('oddsDistribution').innerHTML='';
    return;
  }
  const copies=options.find(([option])=>option===name)?.[1]||0;
  const deckSize=Math.max(parsedDeck.totalCards,1);
  const seen=Math.min(Math.max(parseInt($('oddsSeen').value)||7,1),deckSize);
  const zero=hyper(deckSize,copies,seen,0),atLeast=1-zero,expected=seen*copies/deckSize;
  $('oddsResults').innerHTML=`<div class="odds-result"><b>${pct(atLeast)}</b><span>AT LEAST ONE</span></div><div class="odds-result"><b>${pct(zero)}</b><span>ZERO COPIES</span></div><div class="odds-result"><b>${expected.toFixed(2)}</b><span>EXPECTED COPIES</span></div>`;
  let rows='';
  for(let amount=0;amount<=Math.min(copies,seen);amount++)rows+=`<div class="dist-row"><span>Exactly ${amount}</span><b>${pct(hyper(deckSize,copies,seen,amount))}</b></div>`;
  $('oddsDistribution').innerHTML=rows;
}
function choose(n,k){
  if(k<0||k>n)return 0;
  k=Math.min(k,n-k);
  let result=1;
  for(let i=1;i<=k;i++)result=result*(n-k+i)/i;
  return result;
}
function hyper(N,K,n,k){const denominator=choose(N,n);return denominator?choose(K,k)*choose(N-K,n-k)/denominator:0}
function pct(value){return `${(100*value).toFixed(1)}%`}
function setTab(tab){
  activeTab=tab;
  document.querySelectorAll('.deck-tabs button').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.tab===tab)));
  document.querySelectorAll('.deck-tab').forEach(section=>section.hidden=section.id!==`tab-${tab}`);
  if(tab==='odds')renderDeck();
}
function markDirty(){
  if(!active)return;
  dirty=true;
  active.name=$('deckName').value.trim()||'Untitled deck';
  active.archetype=$('deckArchetype').value.trim();
  active.sourceUrl=$('deckSourceUrl').value.trim();
  active.sourceType=active.sourceUrl?'limitless':'';
  active.rawText=$('deckText').value||'';
  $('saveStatus').textContent='Unsaved changes';
  renderDeck();
}
async function saveActive(){
  if(!active)return;
  active.name=$('deckName').value.trim()||'Untitled deck';
  active.archetype=$('deckArchetype').value.trim();
  active.sourceUrl=$('deckSourceUrl').value.trim();
  active.sourceType=active.sourceUrl?'limitless':'';
  active.rawText=$('deckText').value||'';
  active=await window.PTCGDeckStore.put(active);
  dirty=false;
  renderDeck();
  toast('Working list saved');
  await refresh();
}
async function createDeck(){
  const deck=window.PTCGDeckStore.newDeck();
  const saved=await window.PTCGDeckStore.put(deck);
  await refresh();
  openDeck(saved.id);
}
function importMode(){return document.querySelector('input[name="deckImportMode"]:checked')?.value||'new'}
function renderImportMode(){
  const updating=importMode()==='existing';
  $('importExistingWrap').hidden=!updating;
  $('importDeckSubmit').textContent=updating?'Add as next version':'Create deck';
}
function importPreview(){
  const result=window.PTCGDeckParser.parseDeck($('importDeckText').value||'');
  $('importDeckSummary').textContent=result.totalCards?`${result.totalCards} cards found`:'Paste a deck list to begin';
  $('importDeckSummary').classList.toggle('valid',result.totalCards>0);
}
function sourceUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{
    const url=new URL(raw);
    if(!/^https?:$/.test(url.protocol)||!/(^|\.)limitlesstcg\.com$/i.test(url.hostname))throw new Error();
    return url.href;
  }catch{throw new Error('Use a valid Limitless URL, or leave it blank')}
}
function openAddDeck(){
  $('addDeckForm').reset();
  $('importDeckModeNew').checked=true;
  $('importExistingDeck').innerHTML=decks.map(deck=>`<option value="${esc(deck.id)}">${esc(deck.name)}${deck.archetype?` · ${esc(deck.archetype)}`:''}</option>`).join('');
  $('importExistingMode').disabled=!decks.length;
  renderImportMode();
  importPreview();
  openSheet('addDeckSheet');
  setTimeout(()=>$('importDeckText').focus(),80);
}
async function importDecklist(event){
  event.preventDefault();
  const rawText=$('importDeckText').value||'';
  const parsedDeck=window.PTCGDeckParser.parseDeck(rawText);
  if(!parsedDeck.totalCards){toast('Paste a valid deck list first');return}
  const updating=importMode()==='existing';
  let deck=updating?await window.PTCGDeckStore.get($('importExistingDeck').value):window.PTCGDeckStore.newDeck();
  if(!deck){toast('Choose a deck to update');return}
  const suppliedName=$('importDeckName').value.trim();
  const suppliedArchetype=$('importDeckArchetype').value.trim();
  const url=sourceUrl($('importDeckSource').value);
  if(!updating||suppliedName)deck.name=suppliedName||suppliedArchetype||'Untitled deck';
  if(!updating||suppliedArchetype)deck.archetype=suppliedArchetype;
  if(url){deck.sourceType='limitless';deck.sourceUrl=url}
  deck.rawText=rawText;
  const result=await window.PTCGDeckStore.checkpoint(deck,{name:$('importVersionName').value,sourceType:url?'limitless':deck.sourceType,sourceUrl:url||deck.sourceUrl});
  const saved=await window.PTCGDeckStore.put(result.deck);
  closeSheets();
  await refresh();
  await openDeck(saved.id);
  toast(result.created?`${versionTitle(result.version)} saved`:result.renamed?`${versionTitle(result.version)} renamed`:`Already saved as ${versionTitle(result.version)}`);
}
async function saveCheckpoint(){
  if(!active)return;
  active.name=$('deckName').value.trim()||'Untitled deck';
  active.archetype=$('deckArchetype').value.trim();
  active.sourceUrl=$('deckSourceUrl').value.trim();
  active.sourceType=active.sourceUrl?'limitless':'';
  active.rawText=$('deckText').value||'';
  const result=await window.PTCGDeckStore.checkpoint(active,{name:$('versionLabel').value,sourceType:active.sourceType,sourceUrl:active.sourceUrl});
  active=await window.PTCGDeckStore.put(result.deck);
  $('versionLabel').value='';
  dirty=false;
  renderDeck();
  toast(result.created?`Version saved: ${versionTitle(result.version)}`:result.renamed?`${versionTitle(result.version)} renamed`:`Already saved as ${versionTitle(result.version)}`);
  await refresh();
}
async function duplicate(){
  if(!active)return;
  const copy=await window.PTCGDeckStore.cloneWithNewIds(active,`${active.name} copy`);
  const saved=await window.PTCGDeckStore.put(copy);
  closeSheets();
  await refresh();
  openDeck(saved.id);
  toast('Deck duplicated');
}
async function deleteActive(){
  if(!active||!confirm(`Delete ${active.name}?`))return;
  await window.PTCGDeckStore.remove(active.id);
  closeSheets();
  showLibrary();
  toast('Deck deleted');
}
function download(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function exportAll(){
  download(`ptcg-tools-decks-${new Date().toISOString().slice(0,10)}.json`,{kind:'ptcg-tools-decklists-backup',version:3,exportedAt:new Date().toISOString(),decks});
  closeSheets();
}
function exportOne(){
  if(active)download(`${active.name.replace(/[^\w-]+/g,'_')}.json`,{kind:'ptcg-tools-decklists-backup',version:3,exportedAt:new Date().toISOString(),decks:[active]});
  closeSheets();
}
async function importFile(file){
  try{
    const data=JSON.parse(await file.text()),list=Array.isArray(data?.decks)?data.decks:[];
    if(!list.length)throw new Error('No decks found');
    const existingIds=new Set((await window.PTCGDeckStore.all()).map(deck=>deck.id));
    let copied=0;
    for(const item of list){
      let deck=await window.PTCGDeckStore.prepare(item);
      if(existingIds.has(deck.id)){
        deck=await window.PTCGDeckStore.cloneWithNewIds(deck,`${deck.name} import`);
        copied++;
      }
      existingIds.add(deck.id);
      await window.PTCGDeckStore.put(deck);
    }
    await refresh();
    toast(`Imported ${list.length} deck${list.length===1?'':'s'}${copied?' without replacing existing decks':''}`);
  }catch(error){toast(error.message||'Import failed')}
}
async function copyText(){
  const text=$('deckText').value||'';
  try{await navigator.clipboard.writeText(text);toast('Deck list copied')}catch{toast('Clipboard unavailable')}
}
function toLimitless(){
  const parsedDeck=parsed();
  return parsedDeck.cards.map(card=>`${card.count} ${card.name}${card.set?` ${card.set}`:''}${card.number?` ${card.number}`:''}`).join('\n');
}
async function copyLimitless(){
  try{await navigator.clipboard.writeText(toLimitless());toast('Limitless list copied')}catch{toast('Clipboard unavailable')}
}
async function createDeckImage(){
  const target=window.open('https://limitlesstcg.com/tools/imggen','_blank','noopener');
  try{await navigator.clipboard.writeText(toLimitless());toast('List copied — paste it into ImgGen')}catch{toast(target?'ImgGen opened; copy the list manually':'Clipboard unavailable')}
}
function openLimitless(){
  let url;
  try{url=sourceUrl(active?.sourceUrl)}catch{toast('Save a valid Limitless source link first');return}
  window.open(url||'https://my.limitlesstcg.com/','_blank','noopener');
}
function openSheet(id){$(id).hidden=false}
function closeSheets(){document.querySelectorAll('.sheet').forEach(sheet=>sheet.hidden=true)}
async function selectSprite(slot,name){
  const key=name.trim().toLowerCase();
  if(!key){active.sprites[slot]=null;markDirty();return}
  const sprite=await window.PTCGSprites.fetchSprite(key);
  if(sprite){active.sprites[slot]=sprite;$(slot===0?'sprite1':'sprite2').value=sprite.name;markDirty()}
}
function wireSprite(inputId,listId,slot){
  const input=$(inputId),list=$(listId);
  input.addEventListener('input',()=>{
    const q=input.value.trim(),rows=window.PTCGSprites.searchNamesSync(q,8);
    list.innerHTML=rows.map(row=>`<button type="button" data-sprite="${esc(row.name)}">${esc(row.name)}</button>`).join('');
    if(!q){active.sprites[slot]=null;markDirty()}
  });
  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-sprite]');
    if(!button)return;
    selectSprite(slot,button.dataset.sprite);
    list.innerHTML='';
  });
}
function wireArchetype(inputId,listId){
  const input=$(inputId),list=$(listId);
  function render(){
    const rows=window.PTCGArchetypes?.search(input.value,12)||[];
    list.innerHTML=rows.map(row=>`<button type="button" data-archetype="${esc(row.name)}">${esc(row.name)}<small>${esc(row.sources.join(' + '))}</small></button>`).join('');
  }
  input.addEventListener('focus',render);
  input.addEventListener('input',render);
  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-archetype]');
    if(!button)return;
    input.value=button.dataset.archetype;
    list.innerHTML='';
    if(inputId==='deckArchetype')markDirty();
  });
}
async function loadArchetypes(){
  const status=$('archetypeCatalogStatus');
  try{
    const rows=await window.PTCGArchetypes.load();
    window.PTCGArchetypes.mergeSaved(decks.map(deck=>deck.archetype));
    status.textContent=rows.length?`${rows.length} current Online + IRL archetypes`:'Use an archetype already saved in My Decks';
  }catch{
    window.PTCGArchetypes?.mergeSaved(decks.map(deck=>deck.archetype));
    status.textContent='Using archetypes from My Decks';
  }
}
async function useVersion(versionId){
  const version=active?.versions.find(item=>item.id===versionId);
  if(!version)return;
  $('deckText').value=version.rawText;
  active.currentVersionId=version.id;
  markDirty();
  setTab('list');
  toast(`${versionTitle(version)} loaded as working list`);
}
async function handleExternalDeckChange(){
  if(dirty){toast('Decks changed on another device. Save or reopen to refresh.');return}
  const activeId=active?.id||null;
  await refresh();
  if(!activeId)return;
  const fresh=await window.PTCGDeckStore.get(activeId);
  if(!fresh){showLibrary();toast('This deck was removed on another device.');return}
  active=JSON.parse(JSON.stringify(fresh));
  fillEditor(active);
  renderDeck();
  toast('Decks refreshed');
}
function events(){
  $('newDeckTop').addEventListener('click',openAddDeck);
  $('emptyNew').addEventListener('click',openAddDeck);
  $('backDecks').addEventListener('click',showLibrary);
  $('search').addEventListener('input',renderLibrary);
  $('sort').addEventListener('change',renderLibrary);
  $('deckGrid').addEventListener('click',event=>{const card=event.target.closest('[data-id]');if(card)openDeck(card.dataset.id)});
  $('deckGrid').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-id]')){event.preventDefault();openDeck(event.target.closest('[data-id]').dataset.id)}});
  document.querySelectorAll('.deck-tabs button').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.tab)));
  $('deckName').addEventListener('input',markDirty);
  $('deckArchetype').addEventListener('input',markDirty);
  $('deckSourceUrl').addEventListener('input',markDirty);
  $('deckText').addEventListener('input',markDirty);
  $('parsedPreview').addEventListener('click',event=>{const button=event.target.closest('[data-card-change]');if(button)changeCardCount(button.dataset.cardIndex,button.dataset.cardChange)});
  $('saveDeck').addEventListener('click',saveActive);
  $('saveList').addEventListener('click',saveActive);
  $('saveVersion').addEventListener('click',saveCheckpoint);
  $('copyList').addEventListener('click',copyText);
  $('copyLimitless').addEventListener('click',copyLimitless);
  $('openLimitless').addEventListener('click',openLimitless);
  $('createDeckImage').addEventListener('click',createDeckImage);
  $('oddsCard').addEventListener('change',()=>renderOdds(parsed()));
  $('oddsSeen').addEventListener('input',()=>renderOdds(parsed()));
  $('versionList').addEventListener('click',event=>{const button=event.target.closest('[data-load-version]');if(button)useVersion(button.dataset.loadVersion)});
  $('libraryMenu').addEventListener('click',()=>openSheet('ioSheet'));
  $('deckMenu').addEventListener('click',()=>openSheet('deckSheet'));
  document.querySelectorAll('[data-close-sheet]').forEach(item=>item.addEventListener('click',closeSheets));
  $('exportDecks').addEventListener('click',exportAll);
  $('exportDeck').addEventListener('click',exportOne);
  $('duplicateDeck').addEventListener('click',duplicate);
  $('deleteDeck').addEventListener('click',deleteActive);
  $('importDecks').addEventListener('change',async event=>{const file=event.target.files?.[0];if(file)await importFile(file);event.target.value='';closeSheets()});
  $('addDeckForm').addEventListener('submit',event=>importDecklist(event).catch(error=>toast(error.message||'Import failed')));
  document.querySelectorAll('input[name="deckImportMode"]').forEach(input=>input.addEventListener('change',renderImportMode));
  $('importDeckText').addEventListener('input',importPreview);
  $('startBlankDeck').addEventListener('click',async()=>{closeSheets();await createDeck()});
  wireSprite('sprite1','sprite1Suggestions',0);
  wireSprite('sprite2','sprite2Suggestions',1);
  wireArchetype('deckArchetype','deckArchetypeSuggestions');
  wireArchetype('importDeckArchetype','importArchetypeSuggestions');
}
async function init(){
  await window.PTCGDeckStore.open();
  try{await window.PTCGSprites.getIndex()}catch{}
  events();
  unsubscribeStore=window.PTCGDeckStore.subscribe(()=>handleExternalDeckChange().catch(console.error));
  await refresh();
  await loadArchetypes();
  const query=new URLSearchParams(location.search).get('deck');
  if(query)openDeck(query);
}
window.addEventListener('pagehide',()=>{if(unsubscribeStore)unsubscribeStore()});
window.PTCGDecksApp={showLibrary,openDeck,refresh};
init().catch(error=>{console.error(error);toast('Decks failed to load')});

})();
