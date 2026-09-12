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
    return Number.isFinite(parsed)?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(new Date(parsed)):'Unknown';
  }
  function sourceLabel(row){
    if(row.participationId)return row.eventName||'Tournament';
    return row.source==='ptcgl'?'PTCGL':'In person';
  }
  function record(stats){return engine.recordText(stats)}
  function gameCount(total){return `${total} ${total===1?'game':'games'}`}
  function matchCount(total){return `${total} ${total===1?'match':'matches'}`}
  function spriteHtml(label,size=32){
    const text=String(label||'Unknown').trim()||'Unknown';
    if(window.DeckSprites?.html)return window.DeckSprites.html(text,{size,className:'deck-results-sprite-stack'});
    return `<span class="deck-results-sprite-fallback" aria-hidden="true">${esc(text.charAt(0).toUpperCase()||'?')}</span>`;
  }

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

    const copy=panel.querySelector('.deck-results-head-copy p');
    if(copy)copy.hidden=true;
    const head=panel.querySelector('.app-section-head');
    if(head&&!$('deckResultsScopeBar')){
      head.insertAdjacentHTML('afterend',`
        <div id="deckResultsScopeBar" class="deck-results-scope-bar">
          <div class="app-segmented deck-results-scope" aria-label="Results analysis level">
            <button type="button" data-results-scope="archetype" aria-selected="false">Archetype</button>
            <button type="button" data-results-scope="deck" aria-selected="true">Deck</button>
            <button type="button" data-results-scope="version" aria-selected="false">Version</button>
          </div>
          <label id="deckResultsVersionWrap" class="deck-results-version" hidden><select id="deckResultsVersion" aria-label="Exact deck version"></select></label>
        </div>
      `);
    }

    const primary=panel.querySelector('.deck-results-grid .deck-results-section:first-child');
    if(primary){
      primary.classList.add('deck-results-matchups');
      const title=primary.querySelector('h3');
      if(title)title.textContent='Matchups';
    }
    const secondary=panel.querySelector('.deck-results-grid .deck-results-section:nth-child(2)');
    if(secondary){
      secondary.id='deckResultsSecondary';
      const title=secondary.querySelector('h3');
      if(title)title.id='deckResultsSecondaryTitle';
    }
    const emptyCopy=panel.querySelector('#deckResultsEmpty p');
    if(emptyCopy)emptyCopy.id='deckResultsEmptyCopy';
    const recentTitle=panel.querySelector('.deck-results-recent h3');
    const recentHint=panel.querySelector('.deck-results-recent .deck-results-section-head span');
    if(recentTitle)recentTitle.textContent='Recent games';
    if(recentHint)recentHint.textContent='';
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
        summary.textContent=`${record(result.overall)} · ${pct(result.overall.winRate)} · ${gameCount(result.overall.total)}`;
      }else{
        summary.classList.add('empty');
        summary.textContent='No linked games yet';
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

  function summaryStrip(result){
    const tournament=result.tournament.total
      ? `<span class="deck-results-tournament-record"><b>${esc(record(result.tournament))}</b> tournament ${esc(matchCount(result.tournament.total))}</span>`
      : '';
    return `<div class="deck-results-summary-main">
      <span class="deck-results-summary-stat"><small>Record</small><b>${esc(record(result.overall))}</b></span>
      <span class="deck-results-summary-stat"><small>Win rate</small><b>${esc(pct(result.overall.winRate))}</b></span>
      <span class="deck-results-summary-games">${esc(gameCount(result.overall.total))}</span>
      ${tournament}
    </div>`;
  }

  function sourceStrip(result){
    const rows=[];
    if(result.ptcgl.total)rows.push(['PTCGL',result.ptcgl]);
    if(result.inPersonTraining.total)rows.push(['In person',result.inPersonTraining]);
    if(result.tournamentGames.total)rows.push(['Tournament games',result.tournamentGames]);
    return rows.map(([label,stats])=>`<span class="deck-results-source"><b>${esc(label)}</b><span>${esc(record(stats))} · ${esc(gameCount(stats.total))}</span></span>`).join('');
  }

  function tableHeader(identityLabel){
    return `<div class="deck-results-table-head"><span>${esc(identityLabel)}</span><span>Record</span><span>Win rate</span></div>`;
  }

  function matchupRows(rows){
    if(!rows.length)return '<div class="deck-results-empty">No matchup evidence yet.</div>';
    return tableHeader('Opponent')+rows.map(row=>`<div class="deck-results-row deck-results-stat-row">
      <div class="deck-results-row-main deck-results-row-identity"><span class="deck-results-row-sprite">${spriteHtml(row.label,32)}</span><b>${esc(row.label)}</b></div>
      <div class="deck-results-row-stat record"><b>${esc(record(row.stats))}</b><small>${esc(gameCount(row.stats.total))}</small></div>
      <div class="deck-results-row-stat rate"><b>${esc(pct(row.stats.winRate))}</b></div>
    </div>`).join('');
  }

  function deckRows(rows,deckById){
    if(!rows.length)return '<div class="deck-results-empty">No deck evidence yet.</div>';
    return tableHeader('Deck')+rows.map(row=>{
      const member=deckById.get(row.key);
      const spriteLabel=member?.archetype||row.label;
      return `<div class="deck-results-row deck-results-stat-row">
        <div class="deck-results-row-main deck-results-row-identity"><span class="deck-results-row-sprite">${spriteHtml(spriteLabel,32)}</span><b>${esc(row.label)}</b></div>
        <div class="deck-results-row-stat record"><b>${esc(record(row.stats))}</b><small>${esc(gameCount(row.stats.total))}</small></div>
        <div class="deck-results-row-stat rate"><b>${esc(pct(row.stats.winRate))}</b></div>
      </div>`;
    }).join('');
  }

  function versionRows(rows){
    if(!rows.length)return '<div class="deck-results-empty">No version evidence yet.</div>';
    return tableHeader('Version')+rows.map(row=>`<div class="deck-results-row deck-results-stat-row">
      <div class="deck-results-row-main deck-results-row-version"><span class="deck-results-version-mark">V</span><b>${esc(row.label)}</b></div>
      <div class="deck-results-row-stat record"><b>${esc(record(row.stats))}</b><small>${esc(gameCount(row.stats.total))}</small></div>
      <div class="deck-results-row-stat rate"><b>${esc(pct(row.stats.winRate))}</b></div>
    </div>`).join('');
  }

  function recentHref(row){
    if(row.participationId)return `../events/tournament-day.html?participation=${encodeURIComponent(row.participationId)}`;
    return `?trainingMatch=${encodeURIComponent(row.parentMatchId||row.id)}`;
  }

  function recentGameRows(rows,scope,deckById){
    if(!rows.length)return '<div class="deck-results-empty">No scored games yet.</div>';
    return rows.slice(0,8).map(game=>{
      const ownDeck=deckById.get(game.deckId);
      const ownLabel=ownDeck?.archetype||game.deckNameSnapshot||'Your deck';
      const opponent=game.opponentArchetype||'Unknown opponent';
      const meta=[];
      if(scope==='archetype')meta.push(ownDeck?.name||game.deckNameSnapshot||'Saved deck');
      meta.push(sourceLabel(game),shortDate(game.playedAt));
      if(game.deckVersionLabelSnapshot)meta.push(game.deckVersionLabelSnapshot);
      if(typeof game.wentFirst==='boolean')meta.push(game.wentFirst?'1st':'2nd');
      return `<a class="deck-results-match" href="${esc(recentHref(game))}">
        <span class="deck-results-recent-sprites"><span>${spriteHtml(ownLabel,27)}</span><i>vs</i><span>${spriteHtml(opponent,27)}</span></span>
        <span class="deck-results-match-copy"><b>${esc(opponent)}</b><small>${esc(meta.join(' · '))}</small></span>
        <span class="deck-results-badge ${esc(game.result)}">${esc(resultLetter(game.result))}</span>
        <span class="deck-results-chevron">›</span>
      </a>`;
    }).join('');
  }

  function selectedVersion(deck){
    const versions=Array.isArray(deck?.versions)?deck.versions:[];
    if(!versions.length)return null;
    const version=versions.find(row=>row.id===selectedVersionId)||versions.find(row=>row.id===deck.currentVersionId)||versions[versions.length-1];
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
    if(select&&versionAvailable&&resultScope==='version'){
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

  function emptyMessage(deck,version){
    if(resultScope==='archetype')return `No linked games for ${deck.archetype||'this archetype'} yet.`;
    if(resultScope==='version')return `No linked games for ${version?engine.versionLabel(version):'this version'} yet.`;
    return 'No linked games for this deck yet.';
  }

  async function renderDeckResults(){
    if(!$('deckResultsPanel')||$('deckScreen')?.hidden)return;
    const deck=await resolveCurrentDeck();
    if(!deck)return;
    const decks=await window.PTCGDeckStore.all();
    const matches=window.PTCGMatchStore.all();
    const version=selectedVersion(deck);
    updateScopeControls(deck,version);
    const effectiveVersion=resultScope==='version'?selectedVersion(deck):null;
    const result=scopeResult(deck,decks,matches,effectiveVersion);
    const deckById=new Map(decks.map(row=>[row.id,row]));
    const low=result.overall.total>0&&result.overall.total<10;

    $('deckResultsSample').textContent=result.sampleLabel;
    $('deckResultsSample').classList.toggle('low',low);
    $('deckResultsMetrics').innerHTML=summaryStrip(result);
    $('deckResultsSources').innerHTML=sourceStrip(result);
    $('deckResultsSources').hidden=!$('deckResultsSources').innerHTML;
    $('deckResultsOpponents').innerHTML=matchupRows(result.opponents);
    $('deckResultsOpponentCount').textContent=result.opponents.length?`${result.opponents.length}`:'';

    const secondary=$('deckResultsSecondary');
    if(resultScope==='version'){
      if(secondary)secondary.hidden=true;
    }else{
      if(secondary)secondary.hidden=false;
      const rows=resultScope==='archetype'?result.decks:result.versions;
      $('deckResultsSecondaryTitle').textContent=resultScope==='archetype'?'Decks':'Versions';
      $('deckResultsVersions').innerHTML=resultScope==='archetype'?deckRows(rows||[],deckById):versionRows(rows||[]);
      $('deckResultsVersionCount').textContent=rows?.length?String(rows.length):'';
    }

    $('deckResultsRecent').innerHTML=recentGameRows(result.recentGames,resultScope,deckById);
    $('deckResultsUnscored').textContent=result.unscoredCount?`${result.unscoredCount} unscored game${result.unscoredCount===1?'':'s'} excluded.`:'';
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
    window.addEventListener('decksprites:updated',scheduleDetail);
  }

  setupResultsLayout();
  bind();
  scheduleAll();
  openTrainingMatchFromQuery().catch(console.error);
})();