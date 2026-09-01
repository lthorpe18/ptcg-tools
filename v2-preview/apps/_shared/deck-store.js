(function(global){
  'use strict';
  const DB_NAME='ptcg-tools-db',DB_VERSION=2,STORE='decks',MODEL_VERSION=2;
  let db=null,openPromise=null,migrated=false;

  function uid(prefix='deck'){
    return global.crypto&&global.crypto.randomUUID
      ? global.crypto.randomUUID()
      : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  }
  function parser(){
    if(!global.PTCGDeckParser||typeof global.PTCGDeckParser.hashDecklist!=='function')throw new Error('Deck identity parser unavailable');
    return global.PTCGDeckParser;
  }
  function notify(){
    global.dispatchEvent(new CustomEvent('ptcg:local-change',{detail:{source:'decks'}}));
    try{const channel=new BroadcastChannel('ptcg-tools-local-change');channel.postMessage({source:'decks',at:Date.now()});channel.close()}catch{}
  }
  function subscribe(callback){
    if(typeof callback!=='function')return ()=>{};
    try{
      const channel=new BroadcastChannel('ptcg-tools-local-change');
      channel.onmessage=event=>{if(event.data&&event.data.source==='decks')callback(event.data)};
      return ()=>channel.close();
    }catch{return ()=>{}}
  }
  function open(){
    if(db&&migrated)return Promise.resolve(db);
    if(openPromise)return openPromise;
    openPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const database=req.result;
        if(!database.objectStoreNames.contains(STORE)){
          const target=database.createObjectStore(STORE,{keyPath:'id'});
          target.createIndex('updatedAt','updatedAt',{unique:false});
          target.createIndex('name','name',{unique:false});
        }
      };
      req.onsuccess=()=>{db=req.result;resolve(db)};
      req.onerror=()=>reject(req.error);
    }).then(async database=>{await migrateAll();migrated=true;return database}).finally(()=>{openPromise=null});
    return openPromise;
  }
  function objectStore(mode='readonly'){return db.transaction([STORE],mode).objectStore(STORE)}
  function readAllRaw(){return new Promise((resolve,reject)=>{const req=objectStore().getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
  function writeRows(rows){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE],'readwrite'),target=tx.objectStore(STORE);
      for(const row of rows)target.put(row);
      tx.oncomplete=()=>resolve(rows);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('Could not save deck migration'));
    });
  }
  function normalise(input){
    const source=input&&typeof input==='object'?input:{};
    const d={...source};
    const now=Date.now();
    const isLegacy=!Number.isFinite(Number(d.modelVersion))||Number(d.modelVersion)<MODEL_VERSION;
    if(!d.id)d.id=uid();
    if(!d.name)d.name='Untitled deck';
    if(typeof d.rawText!=='string')d.rawText='';
    if(!d.createdAt)d.createdAt=d.updatedAt||now;
    if(!d.updatedAt)d.updatedAt=d.createdAt||now;
    if(!Array.isArray(d.pinnedCards))d.pinnedCards=[];
    if(!Array.isArray(d.sprites))d.sprites=[null,null];
    d.sprites=[d.sprites[0]||null,d.sprites[1]||null];
    d.versions=Array.isArray(d.versions)?d.versions.map((version,index)=>({
      id:version&&version.id||uid('version'),
      label:version&&version.label||`v${index+1}`,
      rawText:version&&typeof version.rawText==='string'?version.rawText:'',
      listHash:version&&typeof version.listHash==='string'?version.listHash:null,
      createdAt:version&&version.createdAt||d.updatedAt||now
    })):[];
    if(isLegacy&&!d.versions.length&&d.rawText.trim()){
      d.versions=[{id:uid('version'),label:'Imported list',rawText:d.rawText,listHash:null,createdAt:d.updatedAt||now}];
    }
    if(!d.versions.some(version=>version.id===d.currentVersionId))d.currentVersionId=d.versions[d.versions.length-1]?.id||null;
    d.listHash=typeof d.listHash==='string'?d.listHash:null;
    d.modelVersion=MODEL_VERSION;
    return d;
  }
  async function prepare(input){
    const d=normalise(input);
    d.listHash=await parser().hashDecklist(d.rawText);
    for(const version of d.versions)version.listHash=await parser().hashDecklist(version.rawText);
    return d;
  }
  async function migrateAll(){
    const before=await readAllRaw();
    if(!before.length)return;
    const after=await Promise.all(before.map(prepare));
    const changed=after.filter((row,index)=>JSON.stringify(row)!==JSON.stringify(before[index]));
    if(changed.length){await writeRows(changed);notify()}
  }
  async function all(){await open();return Promise.all((await readAllRaw()).map(prepare))}
  async function get(id){
    await open();
    const raw=await new Promise((resolve,reject)=>{const req=objectStore().get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});
    return raw?prepare(raw):null;
  }
  async function put(deck,options={}){
    await open();
    const d=await prepare(deck);
    if(options.touch!==false)d.updatedAt=Date.now();
    await new Promise((resolve,reject)=>{const req=objectStore('readwrite').put(d);req.onsuccess=resolve;req.onerror=()=>reject(req.error)});
    notify();
    return d;
  }
  async function remove(id){
    await open();
    await new Promise((resolve,reject)=>{const req=objectStore('readwrite').delete(id);req.onsuccess=resolve;req.onerror=()=>reject(req.error)});
    notify();
  }
  async function replaceAll(decks){
    await open();
    const rows=await Promise.all((Array.isArray(decks)?decks:[]).map(prepare));
    await new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE],'readwrite'),target=tx.objectStore(STORE);
      target.clear();
      for(const row of rows)target.put(row);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('Could not restore decks'));
    });
    notify();
    return rows;
  }
  function newDeck(){
    const now=Date.now();
    return {modelVersion:MODEL_VERSION,id:uid(),name:'New deck',rawText:'',listHash:null,createdAt:now,updatedAt:now,pinnedCards:[],sprites:[null,null],versions:[],currentVersionId:null};
  }
  function currentVersion(deck){return (deck&&Array.isArray(deck.versions)?deck.versions:[]).find(version=>version.id===deck.currentVersionId)||null}
  function getVersion(deck,versionId){return (deck&&Array.isArray(deck.versions)?deck.versions:[]).find(version=>version.id===versionId)||null}
  function workingMatchesVersion(deck,versionId){
    const version=getVersion(deck,versionId);
    if(!version)return false;
    if(deck.listHash&&version.listHash)return deck.listHash===version.listHash;
    return parser().canonicalDecklist(deck.rawText)===parser().canonicalDecklist(version.rawText);
  }
  async function checkpoint(deck,label){
    const d=await prepare(deck);
    const existing=d.versions.find(version=>version.listHash===d.listHash);
    if(existing){d.currentVersionId=existing.id;return {deck:d,version:existing,created:false}}
    const version={
      id:uid('version'),
      label:String(label||`v${d.versions.length+1}`).trim()||`v${d.versions.length+1}`,
      rawText:d.rawText,
      listHash:d.listHash,
      createdAt:Date.now()
    };
    d.versions.push(version);
    d.currentVersionId=version.id;
    return {deck:d,version,created:true};
  }
  async function cloneWithNewIds(deck,name){
    const source=await prepare(deck),now=Date.now(),versionIds=new Map();
    const copy={...source,id:uid(),name:name||`${source.name} copy`,createdAt:now,updatedAt:now};
    copy.versions=source.versions.map(version=>{
      const id=uid('version');versionIds.set(version.id,id);return {...version,id};
    });
    copy.currentVersionId=versionIds.get(source.currentVersionId)||copy.versions[copy.versions.length-1]?.id||null;
    return copy;
  }

  global.PTCGDeckStore={DB_NAME,DB_VERSION,STORE,MODEL_VERSION,open,all,get,put,remove,replaceAll,newDeck,normalise,prepare,currentVersion,getVersion,workingMatchesVersion,checkpoint,cloneWithNewIds,subscribe};
})(window);

