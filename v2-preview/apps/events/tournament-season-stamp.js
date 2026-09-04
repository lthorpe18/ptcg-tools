(function(){
'use strict';
const participationId=new URLSearchParams(location.search).get('participation');
let stamping=false;
function supported(row){
  const engine=window.PTCGSeasonEngine;
  const season=window.PTCGCompetitiveSeasons?.pokemon2027;
  const rules=window.PTCGSeasonRules?.pokemon2027;
  if(!row?.completion||!engine||!season||!rules)return null;
  const facts=engine.effectiveParticipationFacts(row);
  if(facts.seasonId&&facts.seasonId!==season.id)return null;
  if(!facts.seasonId&&!engine.inSeason(facts.eventDate,season))return null;
  const eventRule=rules.eventRules.find(rule=>engine.canonicalEventType(rule.eventType)===facts.eventType);
  return eventRule?{season,rules}:null;
}
function stamp(){
  if(stamping||!participationId||!window.PTCGStorage)return;
  const row=window.PTCGStorage.getParticipation?.(participationId);
  const config=supported(row);
  if(!config)return;
  const {season,rules}=config;
  const ref=row.seasonRulesetRef||{};
  if(row.seasonId===season.id&&ref.id===rules.id&&String(ref.version)===String(rules.version))return;
  stamping=true;
  const assignedAt=row.completion?.completedAt||new Date().toISOString();
  window.PTCGStorage.updateParticipation(participationId,current=>{
    current.seasonId=season.id;
    current.seasonRulesetRef={id:rules.id,version:rules.version,assignedAt,source:'tournament-completion'};
    return current;
  });
  stamping=false;
}
window.addEventListener('ptcg:local-change',()=>setTimeout(stamp,0));
window.addEventListener('pageshow',stamp);
setTimeout(stamp,0);
})();
