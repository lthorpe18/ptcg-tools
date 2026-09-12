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
    if(window.DeckSprites?.html)return window.DeckSprites.html(name,{size:38,className:'training-history-sprite'});
    const initial=String(name||'?').trim().charAt(0).toUpperCase()||'?';
    return `<span class="training-history-fallback" aria-hidden="true">${esc(initial)}</span>`;
  }
  function sourceFilterOptions(){return '<option value="all">All games</option><option value="training">Training</option><optgroup label="Tournaments"><option value="tournament:all">Tournaments — all</option><option value="tournament:online">Online</option><option value="tournament:local">Local / League</option><option value="tournament:challenge">Challenge</option><option value="tournament:cup">Cup</option><option value="tournament:majors">Majors — all</option><option value="tournament:regional">↳ Regional</option><option value="tournament:special">↳ Special Event</option><option value="tournament:international">↳ International</option><option value="tournament:worlds">↳ Worlds</option></optgroup>'}
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
  function gamesFor(match){return Array.isArray(match?.games)&&match.games.length?match.games:[{result:match?.result,wentFirst:match?.wentFirst}]}
  function gameStats(rows){
    const out={wins:0,losses:0,draws:0,total:0,winRate:0};
    for(const match of rows){
      for(const game of gamesFor(match)){
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
  function gameLetter(result){return result==='win'?'W':result==='loss'?'L':result==='draw'?'D':'?'}
  function participationMap(){
    const rows=window.PTCGStorage?.allParticipations?.()||[];
    return new Map(rows.map(row=>[String(row?.id||''),row]));
  }
  function tournamentCategory(match,participations){
    if(!match?.participationId)return {kind:'training',key:'training',major:false};
    const participation=participations.get(String(match.participationId))||null;
    const snapshot=participation?.eventSnapshot||{};
    const type=String(snapshot.type||'').trim();
    const scope=String(snapshot.scope||'').trim().toLowerCase();
    const environment=String(snapshot.environment||'').trim().toLowerCase();
    const venue=String(snapshot.venue||'').trim().toLowerCase();
    const platform=String(snapshot.platform||'').trim().toUpperCase();
    const online=scope==='online'||environment==='online'||type==='Online Tournament'||venue==='online'||platform.includes('PTCGL');
    if(online)return {kind:'tournament',key:'online',major:false};
    if(type==='League Challenge')return {kind:'tournament',key:'challenge',major:false};
    if(type==='League Cup')return {kind:'tournament',key:'cup',major:false};
    if(type==='Regional')return {kind:'tournament',key:'regional',major:true};
    if(type==='Special Championship'||type==='Special Event')return {kind:'tournament',key:'special',major:true};
    if(type==='International')return {kind:'tournament',key:'international',major:true};
    if(type==='World Championships'||type==='Worlds')return {kind:'tournament',key:'worlds',major:true};
    if(type==='League / Local'||(scope==='local'&&type!=='Prerelease'))return {kind:'tournament',key:'local',major:false};
    return {kind:'tournament',key:'unclassified',major:false};
  }
  function matchesSourceFilter(match,filter,participations){
    const category=tournamentCategory(match,participations);
    if(filter==='all')return true;
    if(filter==='training')return category.kind==='training';
    if(filter==='tournament'||filter==='tournament:all')return category.kind==='tournament';
    if(filter==='tournament:majors')return category.major;
    if(filter.startsWith('tournament:'))return category.kind==='tournament'&&category.key===filter.slice('tournament:'.length);
    return true;
  }
  function gameLogContext(match,participations){
    if(!match?.participationId)return {kind:'training',label:'Training',medium:sourceLabel(match?.source),eventName:''};
    const participation=participations.get(String(match.participationId))||null;
    const snapshot=participation?.eventSnapshot||{};
    const platform=String(snapshot.platform||'').trim();
    const online=snapshot.scope==='online'||snapshot.environment==='online'||String(snapshot.venue||'').trim().toLowerCase()==='online'||platform.toUpperCase().includes('PTCGL');
    return {
      kind:'tournament',
      label:'Tournament',
      medium:online?(platform||'Online'):'In person',
      eventName:String(match.eventName||snapshot.name||snapshot.title||'').trim()
    };
  }
  function tournamentHref(match){return `../events/tournament-day.html?participation=${encodeURIComponent(match.participationId)}`}
  function historyRows(matches){
    const out=[];
    for(const match of matches){
      gamesFor(match).forEach((game,index)=>out.push({match,game,index}));
    }
    return out;
  }
  function historyGroupHtml(rows){
    const groups=[];
    for(const row of rows){
      const key=dateValue(row.match.playedAt),last=groups[groups.length-1];
      if(!last||last.key!==key)groups.push({key,label:shortDate(row.match.playedAt),rows:[row]});
      else last.rows.push(row);
    }
    return groups.map(group=>`<section class="training-day-group"><h3 class="training-day-heading">${esc(group.label)}</h3><div class="training-day-games">${group.rows.map(gameRowHtml).join('')}</div></section>`).join('');
  }
  function gameRowHtml(row){
    const {match,game,index}=row;
    const deck=match.deckNameSnapshot||'Unlinked deck';
    const ownArchetype=deckArchetypes.get(match.deckId)||deck;
    const opponent=match.opponentArchetype||'Unknown deck';
    const result=game?.result||'unknown',label=resultLabel(result);
    const tournament=!!match.participationId;
    const aria=`${label}: ${deck} versus ${opponent}`;
    const open=tournament?`<a class="training-row ${esc(result)}" data-match-id="${esc(match.id)}" data-game-index="${index}" data-tournament="true" href="${esc(tournamentHref(match))}" aria-label="${esc(aria)}">`:`<button type="button" class="training-row ${esc(result)}" data-match-id="${esc(match.id)}" data-game-index="${index}" aria-label="${esc(aria)}">`;
    const close=tournament?'</a>':'</button>';
    return `${open}<span class="training-result">${gameLetter(result)}</span><span class="training-sprite-matchup"><span class="training-matchup-art">${historySprite(ownArchetype)}</span><span class="training-vs">vs</span><span class="training-matchup-art">${historySprite(opponent)}</span></span><span class="training-chevron">›</span>${close}`;
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
    const filter=$('trainingSourceFilter').value,deckId=$('trainingDeckFilter').value;
    const participations=participationMap();
    const rows=window.PTCGMatchStore.all()
      .filter(match=>matchesSourceFilter(match,filter,participations)&&(deckId==='all'||match.deckId===deckId))
      .sort(compareRecent);
    const totals=gameStats(rows),games=historyRows(rows);
    $('trainingMetrics').innerHTML=`<strong>${totals.total} ${totals.total===1?'game':'games'}</strong><span>${totals.wins}–${totals.losses}–${totals.draws}</span><span>${totals.total?`${Math.round(totals.winRate*100)}% win`:'— win'}</span>`;
    if($('trainingCount'))$('trainingCount').textContent=`${totals.total} ${totals.total===1?'game':'games'}`;
    $('trainingList').innerHTML=historyGroupHtml(games);
    $('trainingEmpty').hidden=games.length>0;
  }

  function showTraining(){
    $('libraryScreen').hidden=true;$('deckScreen').hidden=true;$('trainingScreen').hidden=false;$('workspaceNav').hidden=false;$('newDeckTop').hidden=true;
    document.querySelectorAll('[data-workspace]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.workspace==='training')));
    loadDeckRefs().then(render).catch(error=>{console.error(error);toast('Game Log failed to load')});
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

  function openMatch(id){
    const match=window.PTCGMatchStore.get(id);
    if(!match)return;
    if(match.participationId){location.href=tournamentHref(match);return}
    openSheet('edit',match);
  }
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
    $('trainingList').addEventListener('click',event=>{const row=event.target.closest('[data-match-id]');if(row&&!row.dataset.tournament)openMatch(row.dataset.matchId)});
    $('trainingSourceFilter').addEventListener('change',render);$('trainingDeckFilter').addEventListener('change',render);
    document.querySelectorAll('[data-close-match-sheet]').forEach(element=>element.addEventListener('click',closeSheet));
  }

  function configureCopy(){
    const workspace=document.querySelector('[data-workspace="training"]');
    if(workspace)workspace.textContent='Game Log';
    const head=$('trainingScreen')?.querySelector('.training-head');
    if(head){
      const eyebrow=head.querySelector('.app-eyebrow'),title=head.querySelector('h1'),copy=head.querySelector('p');
      if(eyebrow)eyebrow.textContent='GAMES';
      if(title)title.textContent='Game Log';
      if(copy)copy.textContent='Training and tournament games.';
    }
    const source=$('trainingSourceFilter');
    if(source){source.setAttribute('aria-label','Game type');source.innerHTML=sourceFilterOptions()}
    const empty=$('trainingEmpty');
    if(empty){
      const strong=empty.querySelector('strong'),copy=empty.querySelector('p');
      if(strong)strong.textContent='No games yet';
      if(copy)copy.textContent='Paste a PTCGL log, record in-person games or record a tournament round.';
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
  init().catch(error=>{console.error(error);toast('Game Log failed to start')});
})();