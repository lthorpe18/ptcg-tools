(function(global){
  'use strict';
  const DB_NAME='ptcg-tools-db',DB_VERSION=2,STORE='decks';
  let db=null;
  function uid(prefix='deck'){return (crypto&&crypto.randomUUID)?crypto.randomUUID():`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
  function notify(){window.dispatchEvent(new CustomEvent('ptcg:local-change',{detail:{source:'decks'}}))}
  function open(){if(db)return Promise.resolve(db);return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id'});s.createIndex('updatedAt','updatedAt',{unique:false});s.createIndex('name','name',{unique:false})}};req.onsuccess=()=>{db=req.result;resolve(db)};req.onerror=()=>reject(req.error)})}
  function store(mode='readonly'){return db.transaction([STORE],mode).objectStore(STORE)}
  function all(){return new Promise((resolve,reject)=>{const r=store().getAll();r.onsuccess=()=>resolve((r.result||[]).map(normalise));r.onerror=()=>reject(r.error)})}
  function get(id){return new Promise((resolve,reject)=>{const r=store().get(id);r.onsuccess=()=>resolve(r.result?normalise(r.result):null);r.onerror=()=>reject(r.error)})}
  function put(deck){const d=normalise(deck);d.updatedAt=Date.now();return new Promise((resolve,reject)=>{const r=store('readwrite').put(d);r.onsuccess=()=>{notify();resolve(d)};r.onerror=()=>reject(r.error)})}
  function remove(id){return new Promise((resolve,reject)=>{const r=store('readwrite').delete(id);r.onsuccess=()=>{notify();resolve()};r.onerror=()=>reject(r.error)})}
  function newDeck(){const now=Date.now(),id=uid();const version={id:uid('version'),label:'v1',rawText:'',createdAt:now};return {id,name:'New deck',rawText:'',createdAt:now,updatedAt:now,pinnedCards:[],sprites:[null,null],versions:[version],currentVersionId:version.id}}
  function normalise(input){
    const d={...(input||{})};const now=Date.now();
    if(!d.id)d.id=uid();if(!d.name)d.name='Untitled deck';if(typeof d.rawText!=='string')d.rawText='';if(!d.createdAt)d.createdAt=d.updatedAt||now;if(!d.updatedAt)d.updatedAt=d.createdAt||now;if(!Array.isArray(d.pinnedCards))d.pinnedCards=[];if(!Array.isArray(d.sprites))d.sprites=[null,null];d.sprites=[d.sprites[0]||null,d.sprites[1]||null];
    if(!Array.isArray(d.versions)||!d.versions.length){const v={id:uid('version'),label:'v1',rawText:d.rawText,createdAt:d.updatedAt||now};d.versions=[v];d.currentVersionId=v.id}else{d.versions=d.versions.map((v,i)=>({id:v.id||uid('version'),label:v.label||`v${i+1}`,rawText:typeof v.rawText==='string'?v.rawText:'',createdAt:v.createdAt||d.updatedAt||now}));if(!d.versions.some(v=>v.id===d.currentVersionId))d.currentVersionId=d.versions[d.versions.length-1].id}
    return d;
  }
  function snapshot(deck,label){const d=normalise(deck),v={id:uid('version'),label:(label||`v${d.versions.length+1}`).trim()||`v${d.versions.length+1}`,rawText:d.rawText,createdAt:Date.now()};d.versions.push(v);d.currentVersionId=v.id;return d}
  global.PTCGDeckStore={DB_NAME,DB_VERSION,STORE,open,all,get,put,remove,newDeck,normalise,snapshot};
})(window);
