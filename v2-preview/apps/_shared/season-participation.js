(function(global){
  'use strict';

  const ALLOWED_CORRECTIONS=new Set(['eventType','placement','playerCount','seasonId']);

  function text(value){const out=String(value==null?'':value).trim();return out||null}
  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:null}
  function now(){return new Date().toISOString()}

  function requireStorage(){
    if(!global.PTCGStorage?.updateParticipation)throw new Error('PTCGStorage.updateParticipation is required');
    return global.PTCGStorage;
  }

  function setSeasonIdentity(participationId,identity){
    const input=object(identity)||{};
    const seasonId=text(input.seasonId);
    const rulesetId=text(input.rulesetId);
    const rulesetVersion=text(input.rulesetVersion);
    if(!seasonId)throw new Error('seasonId is required');
    if(!rulesetId||!rulesetVersion)throw new Error('rulesetId and rulesetVersion are required');
    return requireStorage().updateParticipation(participationId,row=>{
      row.seasonId=seasonId;
      row.seasonRulesetRef={
        id:rulesetId,
        version:rulesetVersion,
        assignedAt:text(input.assignedAt)||now(),
        source:text(input.source)||'season-engine'
      };
      return row;
    });
  }

  function setCorrections(participationId,fields,meta={}){
    const input=object(fields)||{};
    const next={};
    for(const [key,value] of Object.entries(input)){
      if(!ALLOWED_CORRECTIONS.has(key))continue;
      if(value===undefined||value===null||value==='')continue;
      next[key]=value;
    }
    return requireStorage().updateParticipation(participationId,row=>{
      const existing=object(row.seasonCorrection)||{};
      const existingFields=object(existing.fields)||{};
      row.seasonCorrection={
        ...existing,
        fields:{...existingFields,...next},
        source:text(meta.source)||'user',
        correctedAt:now(),
        note:text(meta.note)||text(existing.note)
      };
      return row;
    });
  }

  function clearCorrection(participationId,field){
    if(!ALLOWED_CORRECTIONS.has(field))throw new Error('unsupported correction field');
    return requireStorage().updateParticipation(participationId,row=>{
      const existing=object(row.seasonCorrection);
      if(!existing)return row;
      const fields={...(object(existing.fields)||{})};
      delete fields[field];
      row.seasonCorrection=Object.keys(fields).length?{...existing,fields,correctedAt:now()}:null;
      return row;
    });
  }

  function clearAllCorrections(participationId){
    return requireStorage().updateParticipation(participationId,row=>{row.seasonCorrection=null;return row});
  }

  global.PTCGSeasonParticipation={
    setSeasonIdentity,
    setCorrections,
    clearCorrection,
    clearAllCorrections
  };
})(window);
