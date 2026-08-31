(function(global){
  'use strict';
  const ROOT_KEY='ptcg-tools-v2';
  const SCHEMA_VERSION=1;
  const EVENT_STATUSES=new Set(['interested','attending','attended','skipped']);
  function emptyState(){return {schemaVersion:SCHEMA_VERSION,plannedEvents:[],favouriteVenues:[],preps:[],recent:{},preferences:{}}}
  function safeParse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
  function normalise(value){
    const base=emptyState();
    if(!value||typeof value!=='object')return base;
    return {...base,...value,schemaVersion:SCHEMA_VERSION,plannedEvents:Array.isArray(value.plannedEvents)?value.plannedEvents:[],favouriteVenues:Array.isArray(value.favouriteVenues)?value.favouriteVenues:[],preps:Array.isArray(value.preps)?value.preps:[],recent:value.recent&&typeof value.recent==='object'?value.recent:{},preferences:value.preferences&&typeof value.preferences==='object'?value.preferences:{}};
  }
  function notify(){window.dispatchEvent(new CustomEvent('ptcg:local-change',{detail:{source:'root-state'}}))}
  function load(){return normalise(safeParse(localStorage.getItem(ROOT_KEY)))}
  function save(state){const out=normalise(state);localStorage.setItem(ROOT_KEY,JSON.stringify(out));notify();return out}
  function update(mutator){const state=load();const next=mutator(state)||state;return save(next)}
  function uid(prefix){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
  function eventIdentity(event){
    if(!event||typeof event!=='object')return null;
    return event.id||event.officialEventId||(event.source&&event.sourceId?`${event.source}:${event.sourceId}`:null);
  }
  function eventSnapshot(event){
    const sourceId=event.sourceId||event.officialEventId||null;
    return {
      id:event.id||event.officialEventId||null,
      officialEventId:event.officialEventId||event.id||null,
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
  function findPlannedEvent(state,eventOrId){
    const identity=typeof eventOrId==='string'?eventOrId:eventIdentity(eventOrId);
    const source=typeof eventOrId==='object'&&eventOrId?eventOrId.source:null;
    const sourceId=typeof eventOrId==='object'&&eventOrId?eventOrId.sourceId:null;
    return state.plannedEvents.find(row=>row.eventId===identity||(source&&sourceId&&row.source===source&&row.sourceId===sourceId))||null;
  }
  function setEventStatus(event,status){
    const identity=eventIdentity(event);
    if(!identity)throw new Error('event identity required');
    if(!EVENT_STATUSES.has(status))throw new Error('unsupported event status');
    return update(state=>{
      const now=new Date().toISOString();
      let row=findPlannedEvent(state,event);
      if(!row){
        row={id:uid('planned'),eventId:identity,source:event.source||null,sourceId:event.sourceId||null,status,prepId:null,eventSnapshot:eventSnapshot(event),createdAt:now,updatedAt:now};
        state.plannedEvents.push(row);
      }else{
        row.eventId=identity;
        row.source=event.source||row.source||null;
        row.sourceId=event.sourceId||row.sourceId||null;
        row.status=status;
        row.eventSnapshot={...row.eventSnapshot,...eventSnapshot(event)};
        row.updatedAt=now;
      }
      return state;
    });
  }
  function clearEventStatus(eventOrId){
    return update(state=>{
      const row=findPlannedEvent(state,eventOrId);
      if(!row)return state;
      state.plannedEvents=state.plannedEvents.filter(x=>x.id!==row.id);
      return state;
    });
  }
  function getEventStatus(eventOrId){const row=findPlannedEvent(load(),eventOrId);return row?row.status:null}
  function setPlannedEvent(event,status='attending'){
    if(!event||!event.officialEventId)throw new Error('officialEventId required');
    return update(state=>{
      const now=new Date().toISOString();
      let row=state.plannedEvents.find(x=>x.eventId===event.officialEventId);
      if(!row){row={id:uid('planned'),eventId:event.officialEventId,status,prepId:uid('prep'),eventSnapshot:{...event},createdAt:now,updatedAt:now};state.plannedEvents.push(row);state.preps.push({id:row.prepId,plannedEventId:row.id,chosenDeckVersionId:null,expectedMetaSnapshot:null,testingGoals:[],matchupNotes:[],checklist:[],finalDeckVersionId:null,notes:'',createdAt:now,updatedAt:now});}
      else{row.status=status;row.eventSnapshot={...row.eventSnapshot,...event};row.updatedAt=now}
      return state;
    });
  }
  function removePlannedEvent(eventId){return update(state=>{const row=state.plannedEvents.find(x=>x.eventId===eventId);state.plannedEvents=state.plannedEvents.filter(x=>x.eventId!==eventId);if(row&&row.prepId)state.preps=state.preps.filter(x=>x.id!==row.prepId);return state})}
  function toggleFavouriteVenue(venueKey){return update(state=>{const set=new Set(state.favouriteVenues);set.has(venueKey)?set.delete(venueKey):set.add(venueKey);state.favouriteVenues=[...set];return state})}
  global.PTCGStorage={ROOT_KEY,SCHEMA_VERSION,load,save,update,setEventStatus,clearEventStatus,getEventStatus,setPlannedEvent,removePlannedEvent,toggleFavouriteVenue};
})(window);
