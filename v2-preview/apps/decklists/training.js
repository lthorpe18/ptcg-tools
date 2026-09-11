(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  let deckRefs=[],deckArchetypes=new Map(),parsedImport=null,editingMatch=null,formMode='manual',unsubscribe=null,importParseTimer=null;

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}
  function toast(message){
    const element=$('toast');element.textContent=message;element.hidden=false;
    clearTimeout(element._t);element._t=setTimeout(()=>element.hidden=true,2400);
  }
  function today(){return new Date().toISOString().slice(0,10)}
  function dateValue(value){const parsed=Date.parse(value||'');return Number.isFinite(parsed)?new Date(parsed).toISOString().slice(0,10):today()}
  function dateIso(value){const parsed=Date.parse(`${value||today()}T12:00:00`);return Number.isFinite(parsed)?new Date(parsed).toISOString():new Date().toISOString()}
  function shortDate(value){return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(value))}
  function resultLabel(result){return ({win:'Win',loss:'Loss',draw:'Draw',unknown:'Unknown'})[result]||'Unknown'}
  function sourceLabel(source){return source==='ptcgl'?'PTCGL':'In person'}
  function historySprite(name){
    if(window.DeckSprites?.html)return window.DeckSprites.html(name,{size:26,className:'training-history-sprite'});
    const initial=String(name||'?').trim().charAt(0).toUpperCase()||'?';
    return `<span class="training-history-fallback" aria-hidden="true">${esc(initial)}</span>`;
  }
  function resultFromScore(){
    const wins=Math.max(0,Number($('gameWins').value)||0),losses=Math.max(0,Number($('gameLosses').value)||0),draws=Math.max(0,Number($('gameDraws').value)||0);
    if(!wins&&!losses&&!draws)return 'unknown';
    if(wins>losses)return 'win';
    if(losses>wins)return 'loss';
    return 'draw';
  }
  function syncManualResult(){if(formMode!=='import'&&!editingMatch?.import)$('matchResult').value=resultFromScore()}
  function compareRecent(a,b){
    if(window.PTCGPersonalResults?.compareRecent)return window.PTCGPersonalResults.compareRecent(a,b);
    return Date.parse(b.playedAt)-Date.parse(a.playedAt)||Date.parse(b.createdAt)-Date.parse(a.createdAt);
  }
  function gameStats(rows){
    const out={wins:0,losses:0,draws:0,total:0,winRate:0};
    for(const match of rows){
      const games=Array.isArray(match.games)&&match.games.length?match.games:[{result:match.result}];
      for(const game of games){
        if(game.result==='win')out.wins++;
        else if(game.result==='loss')out.losses++;
        else if(game.result==='draw')out.draws++;
        else continue;
        out.total++;
      }
    }
    out.winRate=out.total?out.wins/out.total:0;
    return out;
  }
  function gameBadges(match){
    const games=Array.isArray(match.games)&&match.games.length?match.games:[{result:match.result}];
    return games.map(game=>{
      const letter=game.result==='win'?'W':game.result==='loss'?'L':game.result==='draw'?'D':'?';
      return `<span class="training-game-badge ${esc(game.result||'unknown')}">${letter}</span>`;
    }).join('');
  }

  function refKey(ref){return `${ref.deckId}::${ref.deckVersionId||'working'}::${ref.listHash||'unhashed'}`}

  async function loadDeckRefs(){
    const decks=await window.PTCGDeckStore.all();
    deckRefs=[];
    deckArchetypes=new Map(decks.map(deck=>[deck.id,deck.archetype||deck.name||'']));
    for(const deck of decks){
      for(const version of deck.versions||[]){
        deckRefs.push({
          key:`${deck.id}::${version.id}::${version.listHash||'unhashed'}`,
          deckId:deck.id,deckVersionId:version.id,listHash:version.listHash||null,
          deckName:deck.name,versionLabel:version.label,rawText:version.rawText||''
        });
      }
      const matching=(deck.versions||[]).find(version=>version.listHash&&version.listHash===deck.listHash);
      if((deck.rawText||'').trim()&&!matching){
        const ref={deckId:deck.id,deckVersionId:null,listHash:deck.listHash||null,deckName:deck.name,versionLabel:'Working list',rawText:deck.rawText||''};
        ref.key=refKey(ref);deckRefs.push(ref);
      }
    }
    window.PTCGArchetypes?.mergeSaved?.(decks.map(deck=>deck.archetype));
    renderDeckOptions(decks);
  }

  function renderDeckOptions(decks){
    const current=$('matchDeckRef').value;
    $('matchDeckRef').innerHTML='<option value="">No saved deck</option>'+deckRefs.map(ref=>`<option value="${esc(ref.key)}">${esc(ref.deckName)} · ${esc(ref.versionLabel)}</option>`).join('');
    if(deckRefs.some(ref=>ref.key===current))$('matchDeckRef').value=current;
    const filter=$('trainingDeckFilter').value;
    $('trainingDeckFilter').innerHTML='<option value="all">All decks</option>'+decks.map(deck=>`<option value="${esc(deck.id)}">${esc(deck.name)}</option>`).join('');
    if(decks.some(deck=>deck.id===filter))$('trainingDeckFilter').value=filter;
  }

  function selectedRef(){return deckRefs.find(ref=>ref.key===$('matchDeckRef').value)||null}
  function bestDeckRef(player){
    if(!player)return null;
    return deckRefs.map(ref=>({ref,...window.PTCGPTCGLLogParser.scoreDeck(ref.rawText,player.cards)}))
      .sort((a,b)=>b.score-a.score)[0]||null;
  }

  function inferredUserPlayer(parsed){
    if(parsed.ownerPlayer)return parsed.ownerPlayer;
    const ranked=parsed.players.map(player=>({player,best:bestDeckRef(player)?.score||0})).sort((a,b)=>b.best-a.best);
    return ranked[0].best>ranked[1].best&&ranked[0].best>0?ranked[0].player.name:parsed.players[0].name;
  }

  function applyPerspective(playerName,preferDeck=true){
    if(!parsedImport)return;
    const view=window.PTCGPTCGLLogParser.perspective(parsedImport,playerName);
    $('matchResult').value=view.result;
    $('matchTurnOrder').value=view.wentFirst===true?'first':view.wentFirst===false?'second':'unknown';
    $('importDetection').textContent=`${view.player.name} · ${resultLabel(view.result)} · ${view.wentFirst===true?'went first':view.wentFirst===false?'went second':'turn order unknown'}`;
    if(preferDeck){
      const best=bestDeckRef(view.player);
      $('matchDeckRef').value=best&&best.score>0?best.ref.key:'';
      $('matchDeckHint').textContent=best&&best.score>0?`Matched ${best.matched} revealed cards to ${best.ref.deckName} · ${best.ref.versionLabel}`:'Choose the exact list you used.';
    }
  }

  function render(){
    const source=$('trainingSourceFilter').value,deckId=$('trainingDeckFilter').value;
    const rows=window.PTCGMatchStore.all()
      .filter(match=>!match.participationId&&(source==='all'||match.source===source)&&(deckId==='all'||match.deckId===deckId))
      .sort(compareRecent);
    const totals=gameStats(rows);
    $('trainingMetrics').innerHTML=[
      ['Game record',`${totals.wins}–${totals.losses}–${totals.draws}`],
      ['Game win rate',totals.total?`${Math.round(totals.winRate*100)}%`:'—'],
      ['Games',totals.total],
      ['Entries',rows.length]
    ].map(([label,value])=>`<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('');
    $('trainingCount').textContent=`${totals.total} ${totals.total===1?'game':'games'}`;
    $('trainingList').innerHTML=rows.map(match=>{
      const deck=match.deckNameSnapshot||'Unlinked deck';
      const ownArchetype=deckArchetypes.get(match.deckId)||deck;
      const opponent=match.opponentArchetype||'Unknown deck';
      const games=Array.isArray(match.games)&&match.games.length?match.games:[{result:match.result}];
      const meta=[sourceLabel(match.source),shortDate(match.playedAt)];
      if(games.length>1)meta.push(`${games.length} games`);
      if(match.wentFirst===true)meta.push('first');else if(match.wentFirst===false)meta.push('second');
      if(match.deckVersionLabelSnapshot)meta.push(match.deckVersionLabelSnapshot);
      return `<button type="button" class="training-row" data-match-id="${esc(match.id)}">
        <span class="training-game-results" aria-label="Game results">${gameBadges(match)}</span>
        <span class="training-row-main">
          <span class="training-matchup">
            <span class="training-matchup-side"><span class="training-matchup-art">${historySprite(ownArchetype)}</span><span class="training-matchup-copy"><small>You</small><b>${esc(deck)}</b></span></span>
            <span class="training-vs">vs</span>
            <span class="training-matchup-side opponent"><span class="training-matchup-art">${historySprite(opponent)}</span><span class="training-matchup-copy"><small>Opponent</small><b>${esc(opponent)}</b></span></span>
          </span>
          <small class="training-meta">${esc(meta.join(' · '))}</small>
        </span>
        <span class="training-chevron">›</span>
      </button>`;
    }).join('');
    $('trainingEmpty').hidden=rows.length>0;
  }

  function showTraining(){
    $('libraryScreen').hidden=true;$('deckScreen').hidden=true;$('trainingScreen').hidden=false;$('workspaceNav').hidden=false;$('newDeckTop').hidden=true;
    document.querySelectorAll('[data-workspace]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.workspace==='training')));
    loadDeckRefs().then(render).catch(error=>{console.error(error);toast('Training Log failed to load')});
  }

  function setImportState(state,message){
    $('importStage').classList.toggle('is-parsed',state==='parsed');
    if($('importStatus'))$('importStatus').textContent=message||'';
  }

  function openSheet(mode,match=null){
    formMode=mode;editingMatch=match;parsedImport=null;
    clearTimeout(importParseTimer);importParseTimer=null;
    $('matchSheet').hidden=false;
    $('matchDelete').hidden=!match;
    $('importStage').hidden=mode!=='import';
    $('matchFields').hidden=mode==='import';
    $('matchPlayerRow').hidden=true;
    $('matchSheetTitle').textContent=match?'Edit training entry':mode==='import'?'Import PTCGL log':'Record in-person games';
    $('matchSourceText').textContent=match?sourceLabel(match.source):mode==='import'?'PTCGL battle log':'In person';
    $('importLog').value='';$('importDetection').textContent='';$('matchDeckHint').textContent='';
    $('matchDeckRef').value='';$('matchOpponent').value='';$('matchOpponentSuggestions').innerHTML='';$('matchResult').value='win';$('matchDate').value=today();$('matchFormat').value='TEF-PBL';$('matchTurnOrder').value='unknown';
    $('matchEvent').value='';$('matchRound').value='';$('matchNotes').value='';$('gameWins').value='1';$('gameLosses').value='0';$('gameDraws').value='0';
    setImportState('empty','Paste a complete English PTCG Live battle log. The form will fill automatically.');
    if(match)fillMatch(match);
  }

  function closeSheet(){
    clearTimeout(importParseTimer);importParseTimer=null;
    $('matchSheet').hidden=true;parsedImport=null;editingMatch=null;$('matchOpponentSuggestions').innerHTML='';
  }

  function fillMatch(match){
    $('matchFields').hidden=false;
    $('matchOpponent').value=match.opponentArchetype||'';$('matchResult').value=match.result;$('matchDate').value=dateValue(match.playedAt);$('matchFormat').value=match.format||'';
    $('matchTurnOrder').value=match.wentFirst===true?'first':match.wentFirst===false?'second':'unknown';$('matchEvent').value=match.eventName||'';$('matchRound').value=match.roundLabel||'';$('matchNotes').value=match.notes||'';
    const score=window.PTCGMatchStore.score(match);$('gameWins').value=String(score.wins);$('gameLosses').value=String(score.losses);$('gameDraws').value=String(score.draws);
    const ref=deckRefs.find(candidate=>candidate.deckId===match.deckId&&candidate.listHash===match.listHash&&(candidate.deckVersionId||null)===(match.deckVersionId||null));
    $('matchDeckRef').value=ref?.key||'';
    $('matchDeckHint').textContent=ref?'':match.deckNameSnapshot?`Previously linked to ${match.deckNameSnapshot}${match.deckVersionLabelSnapshot?` · ${match.deckVersionLabelSnapshot}`:''}. Choose a current list to relink.`:'';
  }

  function parseImport({quiet=false}={}){
    const raw=$('importLog').value||'';
    if(!raw.trim()){
      parsedImport=null;$('matchFields').hidden=true;$('matchPlayerRow').hidden=true;
      setImportState('empty','Paste a complete English PTCG Live battle log. The form will fill automatically.');
      return false;
    }
    try{
      parsedImport=window.PTCGPTCGLLogParser.parse(raw);
      $('matchFields').hidden=false;$('matchPlayerRow').hidden=false;
      $('matchPlayer').innerHTML=parsedImport.players.map(player=>`<option value="${esc(player.name)}">${esc(player.name)}</option>`).join('');
      const user=inferredUserPlayer(parsedImport);$('matchPlayer').value=user;
      $('matchDate').value=today();$('matchFormat').value='TEF-PBL';$('gameWins').value='1';$('gameLosses').value='0';$('gameDraws').value='0';
      applyPerspective(user,true);
      setImportState('parsed','Log detected. Check the deck and opponent archetype, then save.');
      return true;
    }catch(error){
      parsedImport=null;$('matchFields').hidden=true;$('matchPlayerRow').hidden=true;
      setImportState('invalid','Paste the complete PTCGL battle log to continue.');
      if(!quiet)toast(error.message||String(error)||'Could not parse battle log');
      return false;
    }
  }

  function scheduleImportParse(){
    clearTimeout(importParseTimer);
    if(!$('importLog').value.trim()){parseImport({quiet:true});return}
    importParseTimer=setTimeout(()=>parseImport({quiet:true}),160);
  }

  async function openImportFromClipboard(){
    openSheet('import');
    const input=$('importLog');
    input.focus();
    if(!navigator.clipboard?.readText)return;
    try{
      const text=await navigator.clipboard.readText();
      if(!String(text||'').trim())return;
      input.value=text;
      if(!parseImport({quiet:true})){
        setImportState('invalid','Clipboard content was not recognised. Paste the complete PTCGL battle log below.');
        input.focus();input.select();
      }
    }catch(_){
      input.focus();
    }
  }

  async function saveForm(event){
    event.preventDefault();
    try{
      const wasEditing=!!editingMatch;
      const ref=selectedRef(),turn=$('matchTurnOrder').value;
      const wentFirst=turn==='first'?true:turn==='second'?false:null;
      const source=editingMatch?.source||(formMode==='import'?'ptcgl':'irl');
      let result=$('matchResult').value;
      let imported=editingMatch?.import||null,games;
      if(source==='ptcgl'&&!editingMatch){
        if(!parsedImport&&!parseImport({quiet:true}))throw new Error('Paste a valid PTCGL battle log first');
        imported={kind:'ptcgl-battle-log',hash:await window.PTCGPTCGLLogParser.hash(parsedImport.rawLog),parserVersion:parsedImport.parserVersion,rawLog:parsedImport.rawLog,importedAt:new Date().toISOString()};
        games=[{result,wentFirst}];
      }else{
        games=window.PTCGMatchStore.gamesFromScore($('gameWins').value,$('gameLosses').value,$('gameDraws').value,wentFirst);
        if(!games.length)games=[{result,wentFirst}];
        if(games.length)result=resultFromScore();
      }
      const record={
        ...(editingMatch||{}),source,result,playedAt:dateIso($('matchDate').value),wentFirst,
        deckId:ref?.deckId||null,deckVersionId:ref?.deckVersionId||null,listHash:ref?.listHash||null,
        deckNameSnapshot:ref?.deckName||editingMatch?.deckNameSnapshot||null,deckVersionLabelSnapshot:ref?.versionLabel||editingMatch?.deckVersionLabelSnapshot||null,
        opponentArchetype:$('matchOpponent').value,format:$('matchFormat').value,eventName:$('matchEvent').value,roundLabel:$('matchRound').value,notes:$('matchNotes').value,
        games,import:imported
      };
      const saved=window.PTCGMatchStore.put(record);
      closeSheet();render();
      toast(saved.duplicate?'This battle log is already saved':wasEditing?'Training entry updated':source==='ptcgl'?'Battle log imported':'In-person games saved');
    }catch(error){toast(error.message||'Training entry could not be saved')}
  }

  function openMatch(id){const match=window.PTCGMatchStore.get(id);if(match)openSheet('edit',match)}
  function deleteMatch(){
    if(!editingMatch||!confirm('Delete this training entry?'))return;
    window.PTCGMatchStore.remove(editingMatch.id);closeSheet();render();toast('Training entry deleted');
  }

  function events(){
    document.querySelector('[data-workspace="training"]').addEventListener('click',showTraining);
    document.querySelector('[data-workspace="decks"]').addEventListener('click',()=>window.PTCGDecksApp.showLibrary());
    $('importMatch').addEventListener('click',()=>openImportFromClipboard());
    $('manualMatch').addEventListener('click',()=>openSheet('manual'));
    $('importLog').addEventListener('input',scheduleImportParse);
    $('matchPlayer').addEventListener('change',()=>applyPerspective($('matchPlayer').value,true));
    ['gameWins','gameLosses','gameDraws'].forEach(id=>$(id).addEventListener('input',syncManualResult));
    $('matchForm').addEventListener('submit',saveForm);
    $('matchDelete').addEventListener('click',deleteMatch);
    $('trainingList').addEventListener('click',event=>{const row=event.target.closest('[data-match-id]');if(row)openMatch(row.dataset.matchId)});
    $('trainingSourceFilter').addEventListener('change',render);$('trainingDeckFilter').addEventListener('change',render);
    document.querySelectorAll('[data-close-match-sheet]').forEach(element=>element.addEventListener('click',closeSheet));
  }

  function configureCopy(){
    const source=$('trainingSourceFilter');
    if(source?.options?.[0])source.options[0].textContent='All games';
    const empty=$('trainingEmpty');
    if(empty){
      const strong=empty.querySelector('strong'),copy=empty.querySelector('p');
      if(strong)strong.textContent='No training games yet';
      if(copy)copy.textContent='Paste a PTCGL log or record in-person games.';
    }
  }

  async function init(){
    await window.PTCGDeckStore.open();
    try{await window.PTCGArchetypes?.load?.()}catch(_){}
    await loadDeckRefs();
    window.PTCGArchetypes?.bindSearch?.($('matchOpponent'),$('matchOpponentSuggestions'));
    configureCopy();events();render();
    unsubscribe=window.PTCGMatchStore.subscribe(()=>{loadDeckRefs().then(render).catch(console.error)});
  }

  window.addEventListener('pagehide',()=>{if(unsubscribe)unsubscribe()});
  init().catch(error=>{console.error(error);toast('Training Log failed to start')});
})();