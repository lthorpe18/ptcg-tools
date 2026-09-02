(function(global){
  'use strict';
  const ROOT_KEY='ptcg-tools-v2';
  const SCHEMA_VERSION=3;
  const PARTICIPATION_MODEL_VERSION=1;
  const EVENT_STATUSES=new Set(['interested','attending','attended','skipped']);

  function emptyState(){return {schemaVersion:SCHEMA_VERSION,eventParticipations:[],favouriteVenues:[],matches:[],recent:{},preferences:{}}}
  function safeParse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
  function uid(prefix){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:null}
  function nullable(value){const out=String(value==null?'':value).trim();return out||null}
  function eventIdentity(event){
    if(!event||typeof event!=='object')return null;
    return event.id||event.officialEventId||(event.source&&event.sourceId?`${event.source}:${event.sourceId}`:null);
  }
  function eventSnapshot(event){
    const sourceId=event.sourceId||event.officialEventId||null;
    return {
      id:event.id||event.officialEventId||null,
      officialEventId:event.officialEventId||null,
      source:event.source||null,
      sourceId,
      scope:event.scope||null,
      type:event.type||null,
      name:event.name||null,
      venue:event.venue||null,
      startDate:event.startDate||event.date||null,
      startTime:event.startTime||null,
      endDate:event.endDate||null,
      endTime:event.endTime||null,
      address:event.address||null,
      city:event.city||null,
      region:event.region||null,
      postcode:event.postcode||null,
      country:event.country||null,
      latitude:event.latitude??null,
      longitude:event.longitude??null,
      distanceFromSeedMiles:event.distanceFromSeedMiles??null,
      cost:event.cost||null,
      officialUrl:event.officialUrl||null,
      registrationUrl:event.registrationUrl||null,
      secondarySourceUrl:event.secondarySourceUrl||null,
      season:event.season||null
    };
  }
  function mergeSnapshot(existing,incoming){
    const out={...(object(existing)||{})};
    for(const [key,value] of Object.entries(object(incoming)||{}))if(value!==null&&value!==undefined&&value!=='')out[key]=value;
    return out;
  }
  function phaseFor(status,participation={}){
    if(participation.completion)return 'completed';
    if(participation.tournamentDay)return 'in-progress';
    if(status==='skipped')return 'closed';
    if(status==='attended')return 'needs-completion';
    if(status==='attending')return 'preparation';
    if(status==='interested')return 'interested';
    return participation.archivedAt?'archived':'inactive';
  }
  function normalisePrep(value,participationId,fallbackId){
    const source=object(value);if(!source)return null;
    const now=new Date().toISOString();
    const out={...source,id:nullable(source.id)||nullable(fallbackId)||uid('prep'),participationId,createdAt:source.createdAt||now,updatedAt:source.updatedAt||source.createdAt||now};
    delete out.plannedEventId;
    return out;
  }
  function normaliseParticipation(input,legacyPrep){
    const source=object(input)||{};
    const snapshot=object(source.eventSnapshot)||{};
    const status=EVENT_STATUSES.has(source.attendanceStatus)?source.attendanceStatus:(EVENT_STATUSES.has(source.status)?source.status:null);
    const id=nullable(source.id)||uid('participation');
    const eventId=nullable(source.eventId)||eventIdentity(snapshot);
    const prep=normalisePrep(source.prep||legacyPrep,id,source.prepId);
    const out={
      ...source,
      modelVersion:PARTICIPATION_MODEL_VERSION,
      id,
      eventId,
      source:nullable(source.source)||nullable(snapshot.source),
      sourceId:nullable(source.sourceId)||nullable(snapshot.sourceId),
      attendanceStatus:status,
      phase:source.phase||phaseFor(status,{...source,prep}),
      eventSnapshot:{...snapshot},
      prep,
      plannedDeckRef:object(source.plannedDeckRef),
      usedDeckRef:object(source.usedDeckRef),
      tournamentDay:object(source.tournamentDay),
      completion:object(source.completion),
      seasonId:nullable(source.seasonId),
      archivedAt:nullable(source.archivedAt),
      createdAt:source.createdAt||source.updatedAt||new Date().toISOString(),
      updatedAt:source.updatedAt||source.createdAt||new Date().toISOString()
    };
    out.phase=phaseFor(status,out);
    delete out.status;
    delete out.prepId;
    return out;
  }
  function participationKey(row){return row.id||row.eventId||(row.source&&row.sourceId?`${row.source}:${row.sourceId}`:null)}
  function sameParticipation(a,b){
    if(a.id&&b.id&&a.id===b.id)return true;
    if(a.eventId&&b.eventId&&a.eventId===b.eventId)return true;
    return !!(a.source&&a.sourceId&&a.source===b.source&&a.sourceId===b.sourceId);
  }
  function mergeParticipation(existing,incoming){
    const incomingIsNewer=Date.parse(incoming.updatedAt||'')>Date.parse(existing.updatedAt||'');
    const older=incomingIsNewer?existing:incoming,newer=incomingIsNewer?incoming:existing;
    const out={...older,...newer};
    out.id=existing.id||incoming.id;
    out.eventSnapshot=mergeSnapshot(older.eventSnapshot,newer.eventSnapshot);
    out.prep=existing.prep||incoming.prep||null;
    out.plannedDeckRef=existing.plannedDeckRef||incoming.plannedDeckRef||null;
    out.usedDeckRef=existing.usedDeckRef||incoming.usedDeckRef||null;
    out.tournamentDay=existing.tournamentDay||incoming.tournamentDay||null;
    out.completion=existing.completion||incoming.completion||null;
    out.phase=phaseFor(out.attendanceStatus,out);
    return out;
  }
  function migrateParticipations(value){
    const legacyPreps=new Map((Array.isArray(value.preps)?value.preps:[]).map(prep=>[prep&&prep.id,prep]));
    const canonical=Array.isArray(value.eventParticipations)?value.eventParticipations:[];
    const legacy=Array.isArray(value.plannedEvents)?value.plannedEvents:[];
    const rows=[];
    for(const input of [...canonical,...legacy]){
      if(!input||typeof input!=='object')continue;
      const row=normaliseParticipation(input,legacyPreps.get(input.prepId)||null);
      const index=rows.findIndex(existing=>sameParticipation(existing,row));
      if(index>=0)rows[index]=mergeParticipation(rows[index],row);else if(participationKey(row))rows.push(row);
    }
    return rows;
  }
  function normalise(value){
    const base=emptyState();
    if(!value||typeof value!=='object')return base;
    const out={...base,...value,schemaVersion:SCHEMA_VERSION,eventParticipations:migrateParticipations(value),favouriteVenues:Array.isArray(value.favouriteVenues)?value.favouriteVenues:[],matches:Array.isArray(value.matches)?value.matches:[],recent:object(value.recent)||{},preferences:object(value.preferences)||{}};
    delete out.plannedEvents;
    delete out.preps;
    return out;
  }
  function notify(){global.dispatchEvent(new CustomEvent('ptcg:local-change',{detail:{source:'root-state'}}))}
  function load(){
    const parsed=safeParse(localStorage.getItem(ROOT_KEY));
    const out=normalise(parsed);
    if(parsed&&(parsed.schemaVersion!==SCHEMA_VERSION||Array.isArray(parsed.plannedEvents)||Array.isArray(parsed.preps)))localStorage.setItem(ROOT_KEY,JSON.stringify(out));
    return out;
  }
  function save(state){const out=normalise(state);localStorage.setItem(ROOT_KEY,JSON.stringify(out));notify();return out}
  function update(mutator){const state=load();const next=mutator(state)||state;return save(next)}
  function findParticipation(state,eventOrId){
    const rows=state.eventParticipations||[];
    if(typeof eventOrId==='string')return rows.find(row=>row.id===eventOrId||row.eventId===eventOrId)||null;
    const input=object(eventOrId);if(!input)return null;
    const participationId=nullable(input.participationId);
    const identity=eventIdentity(input);
    const source=input.source||null,sourceId=input.sourceId||null;
    return rows.find(row=>(participationId&&row.id===participationId)||(identity&&row.eventId===identity)||(source&&sourceId&&row.source===source&&row.sourceId===sourceId))||null;
  }
  function allParticipations(){return load().eventParticipations.slice()}
  function getParticipation(eventOrId){return findParticipation(load(),eventOrId)}
  function setEventStatus(event,status){
    const identity=eventIdentity(event);
    if(!identity)throw new Error('event identity required');
    if(!EVENT_STATUSES.has(status))throw new Error('unsupported event status');
    let saved=null;
    update(state=>{
      const now=new Date().toISOString();
      let row=findParticipation(state,event);
      if(!row){
        row=normaliseParticipation({id:uid('participation'),eventId:identity,source:event.source||null,sourceId:event.sourceId||null,attendanceStatus:status,eventSnapshot:eventSnapshot(event),createdAt:now,updatedAt:now});
        state.eventParticipations.push(row);
      }else{
        row.eventId=identity;
        row.source=event.source||row.source||null;
        row.sourceId=event.sourceId||row.sourceId||null;
        row.attendanceStatus=status;
        row.archivedAt=null;
        row.eventSnapshot=mergeSnapshot(row.eventSnapshot,eventSnapshot(event));
        row.updatedAt=now;
        row.phase=phaseFor(status,row);
      }
      saved=row;
      return state;
    });
    return saved;
  }
  function hasDependentData(state,row){
    if(row.prep||row.plannedDeckRef||row.usedDeckRef||row.tournamentDay||row.completion)return true;
    return (state.matches||[]).some(match=>match&&(match.participationId===row.id||(match.eventId&&row.eventId&&match.eventId===row.eventId)));
  }
  function clearEventStatus(eventOrId){
    let result={removed:false,archived:false,participation:null};
    update(state=>{
      const row=findParticipation(state,eventOrId);if(!row)return state;
      if(hasDependentData(state,row)){
        row.attendanceStatus=null;
        row.archivedAt=new Date().toISOString();
        row.updatedAt=row.archivedAt;
        row.phase=phaseFor(null,row);
        result={removed:false,archived:true,participation:row};
      }else{
        state.eventParticipations=state.eventParticipations.filter(item=>item.id!==row.id);
        result={removed:true,archived:false,participation:row};
      }
      return state;
    });
    return result;
  }
  function updateParticipation(id,mutator){
    let saved=null;
    update(state=>{
      const row=findParticipation(state,id);if(!row)return state;
      const changed=mutator(row,state)||row;
      changed.updatedAt=new Date().toISOString();
      changed.phase=phaseFor(changed.attendanceStatus,changed);
      const index=state.eventParticipations.findIndex(item=>item.id===row.id);
      state.eventParticipations[index]=normaliseParticipation(changed);
      saved=state.eventParticipations[index];
      return state;
    });
    return saved;
  }
  function getEventStatus(eventOrId){return getParticipation(eventOrId)?.attendanceStatus||null}
  function setPlannedEvent(event,status='attending'){return setEventStatus(event,status)}
  function removePlannedEvent(eventId){return clearEventStatus(eventId)}
  function venueKey(value){
    if(typeof value==='string')return value;
    if(!value||typeof value!=='object')return null;
    if(value.venueKey)return String(value.venueKey);
    const name=String(value.venue||value.name||'').trim().toLowerCase().replace(/\s+/g,' ');
    if(!name)return null;
    const lat=Number(value.latitude);const lon=Number(value.longitude);
    const locator=Number.isFinite(lat)&&Number.isFinite(lon)?`${lat.toFixed(4)},${lon.toFixed(4)}`:String(value.address||value.city||'').trim().toLowerCase().replace(/\s+/g,' ');
    return `venue:${name}|${locator}`;
  }
  function venueSnapshot(value){
    const key=venueKey(value);if(!key)return null;
    if(typeof value==='string')return {venueKey:key,name:value,venue:value,address:null,city:null,region:null,postcode:null,country:null,latitude:null,longitude:null,savedAt:new Date().toISOString()};
    return {venueKey:key,name:value.venue||value.name||null,venue:value.venue||value.name||null,address:value.address||null,city:value.city||null,region:value.region||null,postcode:value.postcode||null,country:value.country||null,latitude:value.latitude??null,longitude:value.longitude??null,savedAt:new Date().toISOString()};
  }
  function favouriteVenueKeys(state=load()){
    return new Set((state.favouriteVenues||[]).map(row=>venueKey(row)).filter(Boolean));
  }
  function isFavouriteVenue(value){const key=venueKey(value);return !!key&&favouriteVenueKeys().has(key)}
  function toggleFavouriteVenue(value){
    const key=venueKey(value);if(!key)throw new Error('venue identity required');
    return update(state=>{
      const existing=(state.favouriteVenues||[]).findIndex(row=>venueKey(row)===key);
      if(existing>=0)state.favouriteVenues.splice(existing,1);
      else{const snapshot=venueSnapshot(value);if(snapshot)state.favouriteVenues.push(snapshot)}
      return state;
    });
  }
  global.PTCGStorage={ROOT_KEY,SCHEMA_VERSION,PARTICIPATION_MODEL_VERSION,load,save,update,eventIdentity,eventSnapshot,allParticipations,getParticipation,findParticipation,setEventStatus,clearEventStatus,getEventStatus,updateParticipation,setPlannedEvent,removePlannedEvent,venueKey,isFavouriteVenue,toggleFavouriteVenue};
})(window);
