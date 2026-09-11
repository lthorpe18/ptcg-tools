(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const engine=window.PTCGPersonalResults;
  if(!engine||!window.PTCGDeckStore||!window.PTCGMatchStore)return;

  let currentDeckId=new URLSearchParams(location.search).get('deck')||null;
  let resultScope='deck';
  let selectedVersionId=null;
  let libraryRenderTimer=null;
  let detailRenderTimer=null;

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}
  function pct(value){return Number.isFinite(value)?`${Math.round(value*100)}%`:'—'}
  function resultLetter(value){return value==='win'?'W':value==='loss'?'L':value==='draw'?'D':'?'}
  function shortDate(value){
    const parsed=Date.parse(value||'');
    return Number.isFinite(parsed)?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(parsed)):'Unknown date';
  }
  function sourceLabel(match){
    if(match.participationId)return match.eventName||'Tournament';
    return match.source==='ptcgl'?'PTCGL':'In-person training';
  }
  function record(stats){return engine.recordText(stats)}
  function countText(total){return `${total} ${total===1?'match':'matches'}`}

  function setupResultsLayout(){
    const panel=$('deckResultsPanel');
    const deckScreen=$('deckScreen');
    const tabs=deckScreen?.querySelector('.deck-tabs');
    const oddsTab=tabs?.querySelector('[data-tab="odds"]');
    if(!panel||!deckScreen||!tabs||!oddsTab)return;

    oddsTab.dataset.tab='results';
    oddsTab.textContent='Results';
    oddsTab.setAttribute('aria-selected','false');

    let resultsTab=$('tab-results');
    if(!resultsTab){
      resultsTab=document.createElement('section');
      resultsTab.id='tab-results';
      resultsTab.className='deck-tab';
      resultsTab.hidden=true;
      const oddsSection=$('tab-odds');
      if(oddsSection)deckScreen.insertBefore(resultsTab,oddsSection);else deckScreen.appendChild(resultsTab);
    }
    resultsTab.appendChild(panel);

    const head=panel.querySelector('.app-section-head');
    const copy=panel.querySelector('.deck-results-head-copy p');
    if(copy)copy.textContent='Review your own Training Log and Tournament Day evidence at the level that matters.';
    if(head&&!$('deckResultsScopeBar')){
      head.insertAdjacentHTML('afterend',`
        <div id="deckResultsScopeBar" class="deck-results-scope-bar">
          <div class="app-segmented deck-results-scope" aria-label="Results analysis level">
            <button type="button" data-results-scope="archetype" aria-selected="false">Archetype</button>
            <button type="button" data-results-scope="deck" aria-selected="true">Deck</button>
            <button type="button" data-results-scope="version" aria-selected="false">Version</button>
          </div>
          <label id="deckResultsVersionWrap" class="deck-results-version" hidden><span>Exact version</span><select id="deckResultsVersion" aria-label="Exact deck version"></select></label>
        </div>
        <p id="deckResultsContext" class="deck-results-context"></p>
      `);
    }

    const secondary=panel.querySelector('.deck-results-grid .deck-results-section:nth-child(2)');
    if(secondary){
      secondary.id='deckResultsSecondary';
      const title=secondary.querySelector('h3');
      if(title)title.id='deckResultsSecondaryTitle';
    }
    const emptyCopy=panel.querySelector('#deckResultsEmpty p');
    if(emptyCopy)emptyCopy.id='deckResultsEmptyCopy';
  }

  function scheduleLibrary(){
    clearTimeout(libraryRenderTimer);
    libraryRenderTimer=setTimeout(()=>renderLibraryResults().catch(console.error),0);
  }
  function scheduleDetail(){
    clearTimeout(detailRenderTimer);
    detailRenderTimer=setTimeout(()=>renderDeckResults().catch(console.error),0);
  }
  function scheduleAll(){scheduleLibrary();scheduleDetail()}

  async function renderLibraryResults(){
    const grid=$('deckGrid');
    if(!grid)return;
    const decks=await window.PTCGDeckStore.all();
    const byDeck=engine.aggregateAll(decks,window.PTCGMatchStore.all());
    grid.querySelectorAll('.deck-card[data-id]').forEach(card=>{
      const result=byDeck.get(card.dataset.id);
      const copy=card.querySelector(':scope > div:first-child')||card.querySelector('div');
      if(!copy)return;
      let summary=copy.querySelector('.deck-result-summary');
      if(!summary){summary=document.createElement('div');summary.className='deck-result-summary';copy.appendChild(summary)}
      if(result?.overall.total){
        summary.classList.remove('empty');
        summary.textContent=`${record(result.overall)} · ${pct(result.overall.winRate)} · ${countText(result.overall.total)}`;
      }else{
        summary.classList.add('empty');
        summary.textContent='No linked results yet';
      }
    });
  }

  async function resolveCurrentDeck(){
    if(currentDeckId){
      const direct=await window.PTCGDeckStore.get(currentDeckId);
      if(direct)return direct;
    }
    if($('deckScreen')?.hidden)return null;
    const decks=await window.PTCGDeckStore.all();
    const name=$('deckName')?.value||'';
    const raw=$('deckText')?.value||'';
    const exact=decks.filter(deck=>deck.name===name&&String(deck.rawText||'')===String(raw||''));
    if(exact.length===1){currentDeckId=exact[0].id;return exact[0]}
    const named=decks.filter(deck=>deck.name===name);
    if(named.length===1){currentDeckId=named[0].id;return named[0]}
    return null;
  }

  function metric(label,value,sub=''){return `<div class="deck-results-metric"><b>${esc(value)}</b><span>${esc(label)}${sub?` · ${esc(sub)}`:''}</span></div>`}
  function sourceBox(label,stats){return `<div class="deck-results-source"><b>${esc(record(stats))}</b><span>${esc(label)} · ${esc(countText(stats.total))}</span></div>`}
  function breakdownRows(rows){
    if(!rows.length)return '<div class="deck-results-empty">No evidence yet.</div>';
    return rows.map(row=>`<div class="deck-results-row"><div class="deck-results-row-main"><b>${esc(row.label)}</b><small>${esc(countText(row.stats.total))}</small></div><div class="deck-results-row-stat"><b>${esc(record(row.stats))}</b><small>${esc(pct(row.stats.winRate))}</small></div></div>`).join('');
  }
  function recentHref(match){
    if(match.participationId)return `../events/tournament-day.html?participation=${encodeURIComponent(match.participationId)}`;
    return `?trainingMatch=${encodeURIComponent(match.id)}`;
  }
  function recentRows(rows,scope,deckById){
    if(!rows.length)return '<div class="deck-results-empty">No scored matches yet.</div>';
    return rows.map(match=>{
      const opponent=match.opponentArchetype||'Unknown opponent';
      const meta=[];
      if(scope==='archetype')meta.push(deckById.get(match.deckId)?.name||match.deckNameSnapshot||'Saved deck');
      meta.push(sourceLabel(match),shortDate(match.playedAt));
      if(match.deckVersionLabelSnapshot)meta.push(match.deckVersionLabelSnapshot);
      return `<a class="deck-results-match" href="${esc(recentHref(match))}"><span class="deck-results-badge ${esc(match.result)}">${esc(resultLetter(match.result))}</span><span class="deck-results-match-copy"><b>vs ${esc(opponent)}</b><small>${esc(meta.join(' · '))}</small></span><span class="deck-results-chevron">›</span></a>`;
    }).join('');
  }

  function selectedVersion(deck){
    const versions=Array.isArray(deck?.versions)?deck.versions:[];
    if(!versions.length)return null;
    let version=versions.find(row=>row.id===selectedVersionId)||versions.find(row=>row.id===deck.currentVersionId)||versions[versions.length-1];
    selectedVersionId=version?.id||null;
    return version||null;
  }

  function updateScopeControls(deck,version){
    const archetypeButton=document.querySelector('[data-results-scope="archetype"]');
    const versionButton=document.querySelector('[data-results-scope="version"]');
    const archetypeAvailable=!!String(deck.archetype||'').trim();
    const versionAvailable=Array.isArray(deck.versions)&&deck.versions.length>0;
    if(archetypeButton)archetypeButton.disabled=!archetypeAvailable;
    if(versionButton)versionButton.disabled=!versionAvailable;
    if(resultScope==='archetype'&&!archetypeAvailable)resultScope='deck';
    if(resultScope==='version'&&!versionAvailable)resultScope='deck';
    document.querySelectorAll('[data-results-scope]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.resultsScope===resultScope)));

    const wrap=$('deckResultsVersionWrap'),select=$('deckResultsVersion');
    if(wrap)wrap.hidden=resultScope!=='version';
    if(select&&versionAvailable){
      const versions=[...deck.versions].reverse();
      select.innerHTML=versions.map(row=>`<option value="${esc(row.id)}">${esc(engine.versionLabel(row))}</option>`).join('');
      if(version?.id)select.value=version.id;
    }
  }

  function scopeResult(deck,decks,matches,version){
    if(resultScope==='archetype')return engine.aggregateArchetype(deck.archetype,decks,matches);
    if(resultScope==='version')return engine.aggregateVersion(deck,version,matches);
    return engine.aggregateDeck(deck,matches);
  }

  function scopeContext(deck,result,version){
    if(resultScope==='archetype')return `${deck.archetype} · ${result.deckIds.length} saved ${result.deckIds.length===1?'deck':'decks'} · every linked exact list`;
    if(resultScope==='version')return `${deck.name} · ${version?engine.versionLabel(version):'No saved version'} · exact saved 60`;
    return `${deck.name} · all linked versions and working lists`;
  }

  function emptyMessage(deck,version){
    if(resultScope==='archetype')return `No scored matches are linked to saved decks currently classified as ${deck.archetype||'this archetype'}.`;
    if(resultScope==='version')return `No scored matches are linked to ${version?engine.versionLabel(version):'this exact version'} yet.`;
    return 'No scored matches are linked to this deck yet, across any of its exact lists.';
  }

  async function renderDeckResults(){
    if(!$('deckResultsPanel')||$('deckScreen')?.hidden)return;
    const deck=await resolveCurrentDeck();
    if(!deck)return;
    const decks=await window.PTCGDeckStore.all();
    const matches=window.PTCGMatchStore.all();
    const version=selectedVersion(deck);
    updateScopeControls(deck,version);
    const effectiveVersion=resultScope==='version'?selectedVersion(deck):version;
    const result=scopeResult(deck,decks,matches,effectiveVersion);
    const deckById=new Map(decks.map(row=>[row.id,row]));
    const low=result.overall.total>0&&result.overall.total<10;

    $('deckResultsSample').textContent=result.sampleLabel;
    $('deckResultsSample').classList.toggle('low',low);
    $('deckResultsContext').textContent=scopeContext(deck,result,effectiveVersion);

    const recordLabel=resultScope==='archetype'?'Archetype record':resultScope==='version'?'Version record':'Deck record';
    $('deckResultsMetrics').innerHTML=[
      metric(recordLabel,record(result.overall),countText(result.overall.total)),
      metric('Win rate',pct(result.overall.winRate)),
      metric('Tournament',record(result.tournament),countText(result.tournament.total)),
      metric('Training',record(result.training),countText(result.training.total))
    ].join('');
    $('deckResultsSources').innerHTML=[
      sourceBox('Tournament',result.tournament),
      sourceBox('PTCGL',result.ptcgl),
      sourceBox('In-person training',result.inPersonTraining)
    ].join('');
    $('deckResultsOpponents').innerHTML=breakdownRows(result.opponents);
    $('deckResultsOpponentCount').textContent=result.opponents.length?`${result.opponents.length} matchup${result.opponents.length===1?'':'s'}`:'';

    const secondary=$('deckResultsSecondary');
    if(resultScope==='version'){
      if(secondary)secondary.hidden=true;
    }else{
      if(secondary)secondary.hidden=false;
      const rows=resultScope==='archetype'?result.decks:result.versions;
      $('deckResultsSecondaryTitle').textContent=resultScope==='archetype'?'By deck':'By version';
      $('deckResultsVersions').innerHTML=breakdownRows(rows||[]);
      $('deckResultsVersionCount').textContent=rows?.length?`${rows.length} ${resultScope==='archetype'?(rows.length===1?'deck':'decks'):'used'}`:'';
    }

    $('deckResultsRecent').innerHTML=recentRows(result.recent,resultScope,deckById);
    $('deckResultsUnscored').textContent=result.unscoredCount?`${result.unscoredCount} linked match${result.unscoredCount===1?'':'es'} without a scored result ${result.unscoredCount===1?'is':'are'} excluded from this view.`:'';
    $('deckResultsUnscored').hidden=!result.unscoredCount;
    $('deckResultsEmptyCopy').textContent=emptyMessage(deck,effectiveVersion);
    $('deckResultsEmpty').hidden=result.overall.total>0;
    $('deckResultsContent').hidden=result.overall.total===0;
  }

  async function openTrainingMatchFromQuery(){
    const matchId=new URLSearchParams(location.search).get('trainingMatch');
    if(!matchId)return;
    const match=window.PTCGMatchStore.get(matchId);
    if(!match||match.participationId)return;
    const trainingButton=document.querySelector('[data-workspace="training"]');
    if(!trainingButton)return;
    trainingButton.click();
    let attempts=0;
    const find=()=>{
      const row=document.querySelector(`[data-match-id="${CSS.escape(matchId)}"]`);
      if(row){row.click();return}
      attempts++;
      if(attempts<40)setTimeout(find,50);
    };
    setTimeout(find,0);
  }

  function bind(){
    const grid=$('deckGrid');
    grid?.addEventListener('click',event=>{
      const card=event.target.closest('.deck-card[data-id]');
      if(card){currentDeckId=card.dataset.id;resultScope='deck';selectedVersionId=null;scheduleDetail()}
    },true);
    grid?.addEventListener('keydown',event=>{
      const card=event.target.closest('.deck-card[data-id]');
      if(card&&(event.key==='Enter'||event.key===' ')){currentDeckId=card.dataset.id;resultScope='deck';selectedVersionId=null;scheduleDetail()}
    },true);
    $('backDecks')?.addEventListener('click',()=>{currentDeckId=null;resultScope='deck';selectedVersionId=null;scheduleLibrary()});
    $('deckResultsOpenTraining')?.addEventListener('click',()=>document.querySelector('[data-workspace="training"]')?.click());
    document.querySelectorAll('[data-results-scope]').forEach(button=>button.addEventListener('click',()=>{
      if(button.disabled)return;
      resultScope=button.dataset.resultsScope||'deck';
      scheduleDetail();
    }));
    $('deckResultsVersion')?.addEventListener('change',event=>{selectedVersionId=event.target.value||null;scheduleDetail()});

    if(grid){
      new MutationObserver(mutations=>{if(mutations.some(mutation=>mutation.target===grid))scheduleLibrary()}).observe(grid,{childList:true});
    }
    const deckScreen=$('deckScreen');
    if(deckScreen)new MutationObserver(()=>{if(!deckScreen.hidden)scheduleDetail()}).observe(deckScreen,{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('storage',scheduleAll);
    window.addEventListener('ptcg:local-change',scheduleAll);
  }

  setupResultsLayout();
  bind();
  scheduleAll();
  openTrainingMatchFromQuery().catch(console.error);
})();