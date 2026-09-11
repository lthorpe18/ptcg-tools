(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PTCGPersonalResults=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCORED_RESULTS=new Set(['win','loss','draw']);

  function parsedTime(value){
    const parsed=Date.parse(value||'');
    return Number.isFinite(parsed)?parsed:0;
  }

  function compareRecent(a,b){
    const playedDiff=parsedTime(b?.playedAt)-parsedTime(a?.playedAt);
    if(playedDiff)return playedDiff;
    const createdDiff=parsedTime(b?.createdAt)-parsedTime(a?.createdAt);
    if(createdDiff)return createdDiff;
    if(a?.parentMatchId&&a.parentMatchId===b?.parentMatchId){
      const gameDiff=(Number(b?.gameNumber)||0)-(Number(a?.gameNumber)||0);
      if(gameDiff)return gameDiff;
    }
    return String(b?.id||'').localeCompare(String(a?.id||''));
  }

  function sortRecent(rows){return [...(rows||[])].sort(compareRecent)}

  function stats(rows=[]){
    const out={wins:0,losses:0,draws:0,total:0,winRate:null};
    for(const row of rows){
      if(row?.result==='win')out.wins++;
      else if(row?.result==='loss')out.losses++;
      else if(row?.result==='draw')out.draws++;
      else continue;
      out.total++;
    }
    out.winRate=out.total?out.wins/out.total:null;
    return out;
  }

  function recordText(value){
    const row=value||{wins:0,losses:0,draws:0};
    return `${row.wins||0}–${row.losses||0}–${row.draws||0}`;
  }

  function sampleLabel(total){
    const count=Number(total)||0;
    if(!count)return 'No linked games';
    if(count<5)return 'Very small sample';
    if(count<10)return 'Small sample';
    if(count<20)return 'Developing sample';
    return `${count} games`;
  }

  function sourceKind(match){
    if(match?.participationId)return 'tournament';
    if(match?.source==='ptcgl')return 'ptcgl';
    return 'training-irl';
  }

  function normaliseArchetype(value){return String(value||'').trim().toLocaleLowerCase('en')}

  function versionLabel(version){
    const sequence=version?.label||`V${version?.ordinal||1}`;
    const name=String(version?.name||'').trim();
    return name?`${sequence} · ${name}`:sequence;
  }

  function resolveVersion(deck,match){
    const versions=Array.isArray(deck?.versions)?deck.versions:[];
    let version=null;
    if(match?.deckVersionId)version=versions.find(row=>row?.id===match.deckVersionId)||null;
    if(!version&&match?.listHash)version=versions.find(row=>row?.listHash&&row.listHash===match.listHash)||null;
    if(version){
      return {
        key:version.id||version.listHash||match.deckVersionLabelSnapshot||'version',
        label:versionLabel(version),
        deckVersionId:version.id||null,
        listHash:version.listHash||match?.listHash||null
      };
    }
    if(match?.deckVersionLabelSnapshot){
      return {
        key:match.deckVersionId||match.listHash||`snapshot:${match.deckVersionLabelSnapshot}`,
        label:match.deckVersionLabelSnapshot,
        deckVersionId:match.deckVersionId||null,
        listHash:match.listHash||null
      };
    }
    return {key:'unversioned',label:'Working / unversioned',deckVersionId:null,listHash:match?.listHash||null};
  }

  function matchesVersion(match,version){
    if(!match||!version)return false;
    if(version.id&&match.deckVersionId===version.id)return true;
    return !!(version.listHash&&match.listHash&&version.listHash===match.listHash);
  }

  function gamesForMatch(match){
    const source=Array.isArray(match?.games)&&match.games.length?match.games:[{result:match?.result,wentFirst:match?.wentFirst}];
    return source.map((game,index)=>({
      ...match,
      id:game?.id||`${match?.id||'match'}:game:${index+1}`,
      parentMatchId:match?.id||null,
      gameNumber:Number(game?.number)||index+1,
      result:game?.result||'unknown',
      wentFirst:typeof game?.wentFirst==='boolean'?game.wentFirst:match?.wentFirst,
      gameNotes:game?.notes||''
    }));
  }

  function gameRows(matches=[]){
    return sortRecent((matches||[]).flatMap(gamesForMatch));
  }

  function grouped(rows,keyOf,labelOf){
    const map=new Map();
    for(const row of sortRecent(rows)){
      const key=keyOf(row);
      if(!map.has(key))map.set(key,{key,label:labelOf(row),matches:[],lastPlayedAt:row?.playedAt||row?.createdAt||null});
      map.get(key).matches.push(row);
    }
    return [...map.values()].map(bucket=>({...bucket,stats:stats(bucket.matches)}));
  }

  function summarise(linkedRows=[],deck=null){
    const linked=sortRecent(linkedRows);
    const scoredMatches=linked.filter(match=>SCORED_RESULTS.has(match.result));
    const games=gameRows(linked);
    const scoredGames=games.filter(game=>SCORED_RESULTS.has(game.result));
    const tournamentMatches=scoredMatches.filter(match=>sourceKind(match)==='tournament');
    const tournamentGames=scoredGames.filter(game=>sourceKind(game)==='tournament');
    const trainingGames=scoredGames.filter(game=>sourceKind(game)!=='tournament');
    const ptcglGames=trainingGames.filter(game=>sourceKind(game)==='ptcgl');
    const inPersonTrainingGames=trainingGames.filter(game=>sourceKind(game)==='training-irl');
    const opponents=grouped(
      scoredGames,
      game=>String(game?.opponentArchetype||'Unknown').trim()||'Unknown',
      game=>String(game?.opponentArchetype||'Unknown').trim()||'Unknown'
    ).sort((a,b)=>b.stats.total-a.stats.total||compareRecent(a.matches[0],b.matches[0])||a.label.localeCompare(b.label));

    let versions=[];
    if(deck){
      const versionMap=new Map();
      for(const game of scoredGames){
        const version=resolveVersion(deck,game);
        if(!versionMap.has(version.key))versionMap.set(version.key,{...version,matches:[]});
        versionMap.get(version.key).matches.push(game);
      }
      versions=[...versionMap.values()]
        .map(bucket=>({...bucket,matches:sortRecent(bucket.matches),stats:stats(bucket.matches)}))
        .sort((a,b)=>compareRecent(a.matches[0],b.matches[0])||b.stats.total-a.stats.total);
    }

    return {
      matches:linked,
      scoredMatches,
      games,
      scoredGames,
      unscoredCount:games.length-scoredGames.length,
      unscoredMatchCount:linked.length-scoredMatches.length,
      overall:stats(scoredGames),
      tournament:stats(tournamentMatches),
      tournamentGames:stats(tournamentGames),
      training:stats(trainingGames),
      ptcgl:stats(ptcglGames),
      inPersonTraining:stats(inPersonTrainingGames),
      opponents,
      versions,
      recent:scoredMatches.slice(0,8),
      recentGames:scoredGames.slice(0,12),
      recentForm:scoredGames.slice(0,5).map(game=>game.result),
      sampleLabel:sampleLabel(scoredGames.length)
    };
  }

  function aggregateDeck(deck,matches=[]){
    const deckId=deck?.id||null;
    return {
      ...summarise((matches||[]).filter(match=>deckId&&match?.deckId===deckId),deck),
      scope:'deck',deckId
    };
  }

  function aggregateVersion(deck,version,matches=[]){
    const deckId=deck?.id||null;
    const linked=(matches||[]).filter(match=>deckId&&match?.deckId===deckId&&matchesVersion(match,version));
    return {
      ...summarise(linked,deck),
      scope:'version',deckId,version:version||null
    };
  }

  function aggregateArchetype(archetype,decks=[],matches=[]){
    const key=normaliseArchetype(archetype);
    const members=key?(decks||[]).filter(deck=>normaliseArchetype(deck?.archetype)===key):[];
    const deckById=new Map(members.map(deck=>[deck.id,deck]));
    const ids=new Set(deckById.keys());
    const linked=(matches||[]).filter(match=>ids.has(match?.deckId));
    const summary=summarise(linked,null);
    const deckRows=grouped(
      summary.scoredGames,
      game=>game?.deckId||'unknown',
      game=>deckById.get(game?.deckId)?.name||game?.deckNameSnapshot||'Unknown deck'
    ).sort((a,b)=>b.stats.total-a.stats.total||compareRecent(a.matches[0],b.matches[0])||a.label.localeCompare(b.label));
    return {
      ...summary,
      scope:'archetype',
      archetype:String(archetype||'').trim(),
      deckIds:[...ids],
      decks:deckRows
    };
  }

  function aggregateAll(decks=[],matches=[]){
    const result=new Map();
    for(const deck of decks||[])result.set(deck.id,aggregateDeck(deck,matches));
    return result;
  }

  return {SCORED_RESULTS,stats,recordText,sampleLabel,sourceKind,normaliseArchetype,versionLabel,resolveVersion,matchesVersion,gamesForMatch,gameRows,aggregateDeck,aggregateVersion,aggregateArchetype,aggregateAll,sortRecent,compareRecent};
});