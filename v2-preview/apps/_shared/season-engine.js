(function(global){
  'use strict';

  const ENGINE_VERSION=1;

  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:null}
  function text(value){const out=String(value==null?'':value).trim();return out||null}
  function number(value){const out=Number(value);return Number.isFinite(out)?out:null}
  function positiveInteger(value){const out=number(value);return out!=null&&out>0?Math.trunc(out):null}

  function canonicalEventType(value){
    const raw=String(value||'').trim().toLowerCase().replace(/[_–—]/g,'-').replace(/\s+/g,' ');
    if(!raw)return null;
    if(/league challenge|challenge/.test(raw))return 'league-challenge';
    if(/league cup|cup/.test(raw))return 'league-cup';
    if(/international/.test(raw))return 'international';
    if(/special/.test(raw))return 'special';
    if(/regional/.test(raw))return 'regional';
    return raw.replace(/\s+/g,'-');
  }

  function dateOnly(value){
    const raw=text(value);if(!raw)return null;
    const match=raw.match(/^(\d{4}-\d{2}-\d{2})/);return match?match[1]:null;
  }

  function inSeason(date,season){
    const day=dateOnly(date);if(!day||!season)return false;
    const start=dateOnly(season.startDate),end=dateOnly(season.endDate);
    if(start&&day<start)return false;
    if(end&&day>end)return false;
    return true;
  }

  function resolveSeason(date,seasons){
    return (Array.isArray(seasons)?seasons:[]).find(season=>inSeason(date,season))||null;
  }

  function completionRecord(participation){
    const completion=object(participation&&participation.completion)||{};
    const record=object(completion.finalRecord)||{};
    return {
      wins:positiveInteger(record.wins??record.w)??0,
      losses:positiveInteger(record.losses??record.l)??0,
      draws:positiveInteger(record.draws??record.d)??0
    };
  }

  function effectiveParticipationFacts(participation){
    const row=object(participation)||{};
    const completion=object(row.completion)||{};
    const event=object(row.eventSnapshot)||{};
    const correction=object(row.seasonCorrection)||{};
    const correctionFields=object(correction.fields)||correction;

    function corrected(name,sharedValue){
      const supplied=correctionFields[name];
      const hasCorrection=supplied!==undefined&&supplied!==null&&supplied!=='';
      return {
        value:hasCorrection?supplied:sharedValue,
        provenance:hasCorrection?'user-correction':'participation'
      };
    }

    const eventType=corrected('eventType',event.type||completion.eventType||null);
    const placement=corrected('placement',completion.finalPlacement??completion.placement??null);
    const playerCount=corrected('playerCount',completion.finalPlayerCount??completion.playerCount??null);
    const seasonId=corrected('seasonId',row.seasonId||event.seasonId||event.season||null);

    return {
      participationId:text(row.id),
      eventId:text(row.eventId)||text(event.id)||text(event.officialEventId),
      eventName:text(event.name)||text(completion.eventName),
      eventDate:dateOnly(event.startDate||event.date||completion.eventDate),
      eventType:canonicalEventType(eventType.value),
      placement:positiveInteger(placement.value),
      playerCount:positiveInteger(playerCount.value),
      seasonId:text(seasonId.value),
      completedAt:text(completion.completedAt||completion.finishedAt||completion.timestamp),
      record:completionRecord(row),
      usedDeckRef:object(row.usedDeckRef)||object(completion.usedDeckRef),
      notes:text(completion.notes),
      provenance:{
        eventType:eventType.provenance,
        placement:placement.provenance,
        playerCount:playerCount.provenance,
        seasonId:seasonId.provenance,
        correctionSource:text(correction.source)||null,
        correctedAt:text(correction.correctedAt)||null
      }
    };
  }

  function placementBandMatches(placement,band){
    if(!placement||!band)return false;
    const min=positiveInteger(band.minPlacement)||1;
    const max=positiveInteger(band.maxPlacement)||min;
    return placement>=min&&placement<=max;
  }

  function qualifierMatches(facts,award){
    const kicker=positiveInteger(award&&award.minPlayers)||0;
    if(kicker&&(!facts.playerCount||facts.playerCount<kicker))return false;
    if(award.ageDivisions&&award.ageDivisions.length&&facts.ageDivision&&!award.ageDivisions.includes(facts.ageDivision))return false;
    if(award.ratingZones&&award.ratingZones.length&&facts.ratingZone&&!award.ratingZones.includes(facts.ratingZone))return false;
    return true;
  }

  function eventRule(ruleset,eventType){
    const rules=Array.isArray(ruleset&&ruleset.eventRules)?ruleset.eventRules:[];
    return rules.find(rule=>canonicalEventType(rule.eventType)===canonicalEventType(eventType))||null;
  }

  function calculateEventCP(facts,ruleset){
    if(!facts||!ruleset)return {eligible:false,cp:0,reason:'missing-input'};
    if(!facts.placement)return {eligible:false,cp:0,reason:'missing-placement'};
    if(!facts.eventType)return {eligible:false,cp:0,reason:'missing-event-type'};
    const rule=eventRule(ruleset,facts.eventType);
    if(!rule)return {eligible:false,cp:0,reason:'unsupported-event-type'};
    const awards=Array.isArray(rule.awards)?rule.awards:[];
    const award=awards.find(item=>placementBandMatches(facts.placement,item)&&qualifierMatches(facts,item));
    if(!award)return {eligible:true,cp:0,reason:'no-award-band',eventRule:rule};
    return {
      eligible:true,
      cp:number(award.cp)??0,
      reason:'awarded',
      eventRule:rule,
      award
    };
  }

  function bflBucketFor(eventType,ruleset){
    const type=canonicalEventType(eventType);
    const buckets=Array.isArray(ruleset&&ruleset.bestFinishLimits)?ruleset.bestFinishLimits:[];
    return buckets.find(bucket=>(bucket.eventTypes||[]).map(canonicalEventType).includes(type))||null;
  }

  function applyBestFinishLimits(results,ruleset){
    const rows=(Array.isArray(results)?results:[]).map((result,index)=>({...result,_index:index,countingCP:0,isCounting:false,bflBucketId:null,displacedBy:null}));
    const buckets=Array.isArray(ruleset&&ruleset.bestFinishLimits)?ruleset.bestFinishLimits:[];
    const covered=new Set();

    for(const bucket of buckets){
      const eventTypes=(bucket.eventTypes||[]).map(canonicalEventType);
      const candidates=rows.filter(row=>eventTypes.includes(canonicalEventType(row.eventType))&&row.cp>0);
      candidates.forEach(row=>covered.add(row._index));
      candidates.sort((a,b)=>(b.cp-a.cp)||String(a.completedAt||a.eventDate||'').localeCompare(String(b.completedAt||b.eventDate||''))||a._index-b._index);
      const limit=Math.max(0,Math.trunc(number(bucket.limit)??0));
      const counting=candidates.slice(0,limit);
      const excluded=candidates.slice(limit);
      const floor=counting.length?counting[counting.length-1]:null;
      for(const row of counting){row.countingCP=row.cp;row.isCounting=true;row.bflBucketId=bucket.id||null}
      for(const row of excluded){row.bflBucketId=bucket.id||null;row.displacedBy=floor?floor.participationId:null}
    }

    for(const row of rows){
      if(covered.has(row._index)||row.cp<=0)continue;
      row.countingCP=row.cp;
      row.isCounting=true;
    }

    return rows.map(({_index,...row})=>row);
  }

  function buildSeasonSummary(participations,season,ruleset,context={}){
    const seasonId=text(season&&season.id);
    const rows=(Array.isArray(participations)?participations:[])
      .filter(row=>row&&row.completion)
      .map(effectiveParticipationFacts)
      .filter(facts=>{
        if(seasonId&&facts.seasonId)return facts.seasonId===seasonId;
        return inSeason(facts.eventDate,season);
      })
      .map(facts=>{
        const enriched={...facts,ageDivision:context.ageDivision||null,ratingZone:context.ratingZone||null};
        const award=calculateEventCP(enriched,ruleset);
        return {...enriched,cp:award.cp||0,cpStatus:award.reason,eligible:award.eligible,award};
      });

    const counted=applyBestFinishLimits(rows,ruleset);
    return {
      seasonId,
      rulesetId:text(ruleset&&ruleset.id),
      rulesetVersion:text(ruleset&&ruleset.version),
      completedEvents:counted.length,
      eligibleEvents:counted.filter(row=>row.eligible).length,
      rawCP:counted.reduce((sum,row)=>sum+(number(row.cp)||0),0),
      countingCP:counted.reduce((sum,row)=>sum+(number(row.countingCP)||0),0),
      excludedCP:counted.reduce((sum,row)=>sum+(row.isCounting?0:(number(row.cp)||0)),0),
      results:counted
    };
  }

  global.PTCGSeasonEngine={
    ENGINE_VERSION,
    canonicalEventType,
    inSeason,
    resolveSeason,
    effectiveParticipationFacts,
    calculateEventCP,
    applyBestFinishLimits,
    buildSeasonSummary
  };
})(window);
