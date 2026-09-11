(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const engine=window.PTCGPersonalResults;
  if(!engine||!window.PTCGDeckStore||!window.PTCGMatchStore)return;

  let currentDeckId=new URLSearchParams(location.search).get('deck')||null;
  let libraryRenderTimer=null;
  let detailRenderTimer=null;

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }
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
    if(!grid||!window.PTCGDeckStore)return;
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

  function metric(label,value,sub=''){
    return `<div class="deck-results-metric"><b>${esc(value)}</b><span>${esc(label)}${sub?` · ${esc(sub)}`:''}</span></div>`;
  }
  function sourceBox(label,stats){
    return `<div class="deck-results-source"><b>${esc(record(stats))}</b><span>${esc(label)} · ${esc(countText(stats.total))}</span></div>`;
  }
  function breakdownRows(rows){
    if(!rows.length)return '<div class="deck-results-empty">No evidence yet.</div>';
    return rows.map(row=>`<div class="deck-results-row"><div class="deck-results-row-main"><b>${esc(row.label)}</b><small>${esc(countText(row.stats.total))}</small></div><div class="deck-results-row-stat"><b>${esc(record(row.stats))}</b><small>${esc(pct(row.stats.winRate))}</small></div></div>`).join('');
  }
  function recentHref(match){
    if(match.participationId)return `../events/tournament-day.html?participation=${encodeURIComponent(match.participationId)}`;
    return `?trainingMatch=${encodeURIComponent(match.id)}`;
  }
  function recentRows(rows){
    if(!rows.length)return '<div class="deck-results-empty">No scored matches yet.</div>';
    return rows.map(match=>{
      const opponent=match.opponentArchetype||'Unknown opponent';
      const meta=[sourceLabel(match),shortDate(match.playedAt)];
      if(match.deckVersionLabelSnapshot)meta.push(match.deckVersionLabelSnapshot);
      return `<a class="deck-results-match" href="${esc(recentHref(match))}"><span class="deck-results-badge ${esc(match.result)}">${esc(resultLetter(match.result))}</span><span class="deck-results-match-copy"><b>vs ${esc(opponent)}</b><small>${esc(meta.join(' · '))}</small></span><span class="deck-results-chevron">›</span></a>`;
    }).join('');
  }

  async function renderDeckResults(){
    if(!$('deckResultsPanel')||$('deckScreen')?.hidden)return;
    const deck=await resolveCurrentDeck();
    if(!deck)return;
    const result=engine.aggregateDeck(deck,window.PTCGMatchStore.all());
    const low=result.overall.total>0&&result.overall.total<10;
    $('deckResultsSample').textContent=result.sampleLabel;
    $('deckResultsSample').classList.toggle('low',low);
    $('deckResultsMetrics').innerHTML=[
      metric('Overall record',record(result.overall),countText(result.overall.total)),
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
    $('deckResultsVersions').innerHTML=breakdownRows(result.versions);
    $('deckResultsRecent').innerHTML=recentRows(result.recent);
    $('deckResultsOpponentCount').textContent=result.opponents.length?`${result.opponents.length} matchup${result.opponents.length===1?'':'s'}`:'';
    $('deckResultsVersionCount').textContent=result.versions.length?`${result.versions.length} used`:'';
    $('deckResultsUnscored').textContent=result.unscoredCount?`${result.unscoredCount} linked match${result.unscoredCount===1?'':'es'} without a scored result ${result.unscoredCount===1?'is':'are'} excluded from the record.`:'';
    $('deckResultsUnscored').hidden=!result.unscoredCount;
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
      if(card){currentDeckId=card.dataset.id;scheduleDetail()}
    },true);
    grid?.addEventListener('keydown',event=>{
      const card=event.target.closest('.deck-card[data-id]');
      if(card&&(event.key==='Enter'||event.key===' ')){currentDeckId=card.dataset.id;scheduleDetail()}
    },true);
    $('backDecks')?.addEventListener('click',()=>{currentDeckId=null;scheduleLibrary()});
    $('deckResultsOpenTraining')?.addEventListener('click',()=>document.querySelector('[data-workspace="training"]')?.click());

    if(grid){
      new MutationObserver(mutations=>{
        if(mutations.some(mutation=>mutation.target===grid))scheduleLibrary();
      }).observe(grid,{childList:true});
    }
    const deckScreen=$('deckScreen');
    if(deckScreen){
      new MutationObserver(()=>{if(!deckScreen.hidden)scheduleDetail()}).observe(deckScreen,{attributes:true,attributeFilter:['hidden']});
    }
    window.addEventListener('storage',scheduleAll);
    window.addEventListener('ptcg:local-change',scheduleAll);
  }

  bind();
  scheduleAll();
  openTrainingMatchFromQuery().catch(console.error);
})();