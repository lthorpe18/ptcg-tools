(function(global){
  'use strict';
  const ROOT_KEY='ptcg-tools-v2';
  const SCHEMA_VERSION=1;
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
  function removePlannedEvent(eventId){return update(state=>{const row=state.plannedEvents.find(x=>x.eventId===eventId);state.plannedEvents=state.plannedEvents.filter(x=>x.eventId!==eventId);if(row)state.preps=state.preps.filter(x=>x.id!==row.prepId);return state})}
  function toggleFavouriteVenue(venueKey){return update(state=>{const set=new Set(state.favouriteVenues);set.has(venueKey)?set.delete(venueKey):set.add(venueKey);state.favouriteVenues=[...set];return state})}
  global.PTCGStorage={ROOT_KEY,SCHEMA_VERSION,load,save,update,setPlannedEvent,removePlannedEvent,toggleFavouriteVenue};
})(window);
