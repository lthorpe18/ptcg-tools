(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PTCGPersonalResults=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCORED_RESULTS=new Set(['win','loss','draw']);

  function timeValue(row){
    const played=Date.parse(row?.playedAt||'');
    if(Number.isFinite(played))return played;
    const created=Date.parse(row?.createdAt||'');
    return Number.isFinite(created)?created:0;
  }

  function sortRecent(rows){
    return [...(rows||[])].sort((a,b)=>timeValue(b)-timeValue(a));
  }

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
    if(!count)return 'No linked results';
    if(count<5)return 'Very small sample';
    if(count<10)return 'Small sample';
    if(count<20)return 'Developing sample';
    return `${count} matches`;
  }

  function sourceKind(match){
    if(match?.participationId)return 'tournament';
    if(match?.source==='ptcgl')return 'ptcgl';
    return 'training-irl';
  }

  function resolveVersion(deck,match){
    const versions=Array.isArray(deck?.versions)?deck.versions:[];
    let version=null;
    if(match?.deckVersionId)version=versions.find(row=>row?.id===match.deckVersionId)||null;
    if(!version&&match?.listHash)version=versions.find(row=>row?.listHash&&row.listHash===match.listHash)||null;
    if(version){
      return {
        key:version.id||version.listHash||match.deckVersionLabelSnapshot||'version',
        label:version.label||`V${version.ordinal||1}`,
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

  function grouped(rows,keyOf,labelOf){
    const map=new Map();
    for(const row of rows){
      const key=keyOf(row);
      if(!map.has(key))map.set(key,{key,label:labelOf(row),matches:[],lastPlayedAt:row?.playedAt||row?.createdAt||null});
      const bucket=map.get(key);
      bucket.matches.push(row);
      if(timeValue(row)>Date.parse(bucket.lastPlayedAt||''))bucket.lastPlayedAt=row?.playedAt||row?.createdAt||bucket.lastPlayedAt;
    }
    return [...map.values()].map(bucket=>({...bucket,stats:stats(bucket.matches)}));
  }

  function aggregateDeck(deck,matches=[]){
    const deckId=deck?.id||null;
    const linked=sortRecent((matches||[]).filter(match=>deckId&&match?.deckId===deckId));
    const scored=linked.filter(match=>SCORED_RESULTS.has(match.result));
    const tournament=scored.filter(match=>sourceKind(match)==='tournament');
    const training=scored.filter(match=>sourceKind(match)!=='tournament');
    const ptcgl=training.filter(match=>sourceKind(match)==='ptcgl');
    const inPersonTraining=training.filter(match=>sourceKind(match)==='training-irl');

    const opponents=grouped(
      scored,
      match=>String(match?.opponentArchetype||'Unknown').trim()||'Unknown',
      match=>String(match?.opponentArchetype||'Unknown').trim()||'Unknown'
    ).sort((a,b)=>b.stats.total-a.stats.total||timeValue(b.matches[0])-timeValue(a.matches[0])||a.label.localeCompare(b.label));

    const versionMap=new Map();
    for(const match of scored){
      const version=resolveVersion(deck,match);
      if(!versionMap.has(version.key))versionMap.set(version.key,{...version,matches:[],lastPlayedAt:match.playedAt||match.createdAt||null});
      const bucket=versionMap.get(version.key);
      bucket.matches.push(match);
      if(timeValue(match)>Date.parse(bucket.lastPlayedAt||''))bucket.lastPlayedAt=match.playedAt||match.createdAt||bucket.lastPlayedAt;
    }
    const versions=[...versionMap.values()]
      .map(bucket=>({...bucket,stats:stats(bucket.matches)}))
      .sort((a,b)=>timeValue(b.matches[0])-timeValue(a.matches[0])||b.stats.total-a.stats.total);

    return {
      deckId,
      matches:linked,
      scoredMatches:scored,
      unscoredCount:linked.length-scored.length,
      overall:stats(scored),
      tournament:stats(tournament),
      training:stats(training),
      ptcgl:stats(ptcgl),
      inPersonTraining:stats(inPersonTraining),
      opponents,
      versions,
      recent:scored.slice(0,8),
      recentForm:scored.slice(0,5).map(match=>match.result),
      sampleLabel:sampleLabel(scored.length)
    };
  }

  function aggregateAll(decks=[],matches=[]){
    const result=new Map();
    for(const deck of decks||[])result.set(deck.id,aggregateDeck(deck,matches));
    return result;
  }

  return {SCORED_RESULTS,stats,recordText,sampleLabel,sourceKind,resolveVersion,aggregateDeck,aggregateAll,sortRecent};
});
