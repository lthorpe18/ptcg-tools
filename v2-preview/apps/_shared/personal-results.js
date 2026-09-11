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

  function sortRecent(rows){return [...(rows||[])].sort((a,b)=>timeValue(b)-timeValue(a))}

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

  function grouped(rows,keyOf,labelOf){
    const map=new Map();
    for(const row of rows){
      const key=keyOf(row);
      if(!map.has(key))map.set(key,{key,label:labelOf(row),matches:[],lastPlayedAt:row?.playedAt||row?.createdAt||null});
      const bucket=map.get(key);
      bucket.matches.push(row);
      if(timeValue(row)>timeValue({playedAt:bucket.lastPlayedAt}))bucket.lastPlayedAt=row?.playedAt||row?.createdAt||bucket.lastPlayedAt;
    }
    return [...map.values()].map(bucket=>({...bucket,stats:stats(bucket.matches)}));
  }

  function summarise(linkedRows=[],deck=null){
    const linked=sortRecent(linkedRows);
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

    let versions=[];
    if(deck){
      const versionMap=new Map();
      for(const match of scored){
        const version=resolveVersion(deck,match);
        if(!versionMap.has(version.key))versionMap.set(version.key,{...version,matches:[],lastPlayedAt:match.playedAt||match.createdAt||null});
        versionMap.get(version.key).matches.push(match);
      }
      versions=[...versionMap.values()]
        .map(bucket=>({...bucket,stats:stats(bucket.matches)}))
        .sort((a,b)=>timeValue(b.matches[0])-timeValue(a.matches[0])||b.stats.total-a.stats.total);
    }

    return {
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
      summary.scoredMatches,
      match=>match?.deckId||'unknown',
      match=>deckById.get(match?.deckId)?.name||match?.deckNameSnapshot||'Unknown deck'
    ).sort((a,b)=>b.stats.total-a.stats.total||timeValue(b.matches[0])-timeValue(a.matches[0])||a.label.localeCompare(b.label));
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

  return {SCORED_RESULTS,stats,recordText,sampleLabel,sourceKind,normaliseArchetype,versionLabel,resolveVersion,matchesVersion,aggregateDeck,aggregateVersion,aggregateArchetype,aggregateAll,sortRecent};
});