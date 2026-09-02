(function(global){
  'use strict';

  const WORKSPACE_ID='default';
  const ROOT_KEY='ptcg-tools-v2';
  const META_KEY='ptcg-tools.meta-lab.saved-metas.v1';
  const LOCAL_MODIFIED_KEY='ptcg-tools-cloud-local-modified-at';
  const LAST_SYNC_KEY='ptcg-tools-cloud-last-sync-at';
  const DB_NAME='ptcg-tools-db';
  const DB_VERSION=2;
  const DECK_STORE='decks';

  let deckDbPromise=null;
  let restoring=false;
  let pushTimer=null;
  let syncPromise=null;

  function safeParse(raw,fallback){try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function toMs(value){if(!value)return 0;if(typeof value==='number')return value;const n=Date.parse(value);return Number.isFinite(n)?n:0}
  function nowIso(){return new Date().toISOString()}

  function getClient(){
    if(!global.PTCGCloud||typeof global.PTCGCloud.client!=='function')throw new Error('Cloud client unavailable');
    return global.PTCGCloud.client();
  }

  function openDeckDb(){
    if(deckDbPromise)return deckDbPromise;
    deckDbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(DECK_STORE)){
          const store=db.createObjectStore(DECK_STORE,{keyPath:'id'});
          store.createIndex('updatedAt','updatedAt',{unique:false});
          store.createIndex('name','name',{unique:false});
        }
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    return deckDbPromise;
  }

  async function readDecks(){
    try{
      const db=await openDeckDb();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(DECK_STORE,'readonly');
        const req=tx.objectStore(DECK_STORE).getAll();
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error);
      });
    }catch{return []}
  }

  async function replaceDecks(decks){
    const db=await openDeckDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DECK_STORE,'readwrite');
      const store=tx.objectStore(DECK_STORE);
      store.clear();
      for(const deck of Array.isArray(decks)?decks:[])store.put(deck);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('Deck restore aborted'));
    });
  }

  function readRoot(){return safeParse(localStorage.getItem(ROOT_KEY),null)}
  function readMetas(){const rows=safeParse(localStorage.getItem(META_KEY),[]);return Array.isArray(rows)?rows:[]}

  function deriveLocalModified(root,decks,metas){
    let latest=toMs(localStorage.getItem(LOCAL_MODIFIED_KEY));
    const visit=(value)=>{
      if(!value||typeof value!=='object')return;
      latest=Math.max(latest,toMs(value.updatedAt),toMs(value.createdAt));
    };
    for(const row of (root&&Array.isArray(root.eventParticipations)?root.eventParticipations:[]))visit(row);
    for(const row of (root&&Array.isArray(root.plannedEvents)?root.plannedEvents:[]))visit(row);
    for(const row of (root&&Array.isArray(root.preps)?root.preps:[]))visit(row);
    for(const row of decks)visit(row);
    for(const row of metas)visit(row);
    return latest;
  }

  async function localSnapshot(){
    const rootState=readRoot();
    const decks=await readDecks();
    const savedMetas=readMetas();
    const modified=deriveLocalModified(rootState,decks,savedMetas);
    return {workspaceInitialized:true,schemaVersion:3,capturedAt:nowIso(),modifiedAt:modified?new Date(modified).toISOString():null,rootState,decks,savedMetas};
  }

  function hasMeaningfulData(snapshot){
    if(!snapshot||typeof snapshot!=='object')return false;
    if(Array.isArray(snapshot.decks)&&snapshot.decks.length)return true;
    if(Array.isArray(snapshot.savedMetas)&&snapshot.savedMetas.length)return true;
    const root=snapshot.rootState;
    if(!root||typeof root!=='object')return false;
    return Boolean(
      (Array.isArray(root.eventParticipations)&&root.eventParticipations.length)||
      (Array.isArray(root.plannedEvents)&&root.plannedEvents.length)||
      (Array.isArray(root.preps)&&root.preps.length)||
      (Array.isArray(root.favouriteVenues)&&root.favouriteVenues.length)||
      (root.preferences&&Object.keys(root.preferences).length)||
      (root.recent&&Object.keys(root.recent).length)
    );
  }

  async function restoreLocal(payload){
    if(!payload||typeof payload!=='object')throw new Error('Invalid shared workspace data');
    restoring=true;
    try{
      if(payload.rootState)localStorage.setItem(ROOT_KEY,JSON.stringify(payload.rootState));
      else localStorage.removeItem(ROOT_KEY);
      localStorage.setItem(META_KEY,JSON.stringify(Array.isArray(payload.savedMetas)?payload.savedMetas:[]));
      await replaceDecks(Array.isArray(payload.decks)?payload.decks:[]);
      window.dispatchEvent(new CustomEvent('savedmetas:updated'));
      window.dispatchEvent(new CustomEvent('ptcg:cloud-restored'));
    }finally{restoring=false}
  }

  async function readRemote(){
    const c=await getClient();
    const {data,error}=await c.from('shared_workspace').select('payload,updated_at').eq('id',WORKSPACE_ID).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function push(){
    const c=await getClient();
    const payload=await localSnapshot();
    const {data,error}=await c.from('shared_workspace').upsert({id:WORKSPACE_ID,payload,updated_at:nowIso()},{onConflict:'id'}).select('updated_at').single();
    if(error)throw error;
    const stamp=data&&data.updated_at?data.updated_at:nowIso();
    localStorage.setItem(LOCAL_MODIFIED_KEY,stamp);
    localStorage.setItem(LAST_SYNC_KEY,stamp);
    window.dispatchEvent(new CustomEvent('ptcg:cloud-synced',{detail:{direction:'up',updatedAt:stamp}}));
    return {direction:'up',updatedAt:stamp};
  }

  async function pull(remote){
    const row=remote||await readRemote();
    if(!row||!row.payload)return {direction:'none',updatedAt:null};
    await restoreLocal(row.payload);
    const stamp=row.updated_at||nowIso();
    localStorage.setItem(LOCAL_MODIFIED_KEY,stamp);
    localStorage.setItem(LAST_SYNC_KEY,stamp);
    window.dispatchEvent(new CustomEvent('ptcg:cloud-synced',{detail:{direction:'down',updatedAt:stamp}}));
    return {direction:'down',updatedAt:stamp};
  }

  async function doSync(){
    const local=await localSnapshot();
    const remote=await readRemote();
    const remoteInitialized=Boolean(remote&&remote.payload&&remote.payload.workspaceInitialized===true);
    const localHasData=hasMeaningfulData(local);

    if(!remoteInitialized){
      if(localHasData)return push();
      return {direction:'none',updatedAt:remote&&remote.updated_at||null};
    }

    const remoteTime=toMs(remote.updated_at);
    const localTime=toMs(local.modifiedAt);
    if(remoteTime>localTime+1000)return pull(remote);
    if(localTime>remoteTime+1000)return push();

    localStorage.setItem(LAST_SYNC_KEY,remote.updated_at||nowIso());
    return {direction:'none',updatedAt:remote.updated_at||null};
  }

  function sync(){
    if(syncPromise)return syncPromise;
    syncPromise=doSync().catch(error=>{console.warn('PTCG cloud sync unavailable; continuing locally.',error);return {direction:'error',error}}).finally(()=>{syncPromise=null});
    return syncPromise;
  }

  function markLocalChange(){
    if(restoring)return;
    localStorage.setItem(LOCAL_MODIFIED_KEY,nowIso());
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{push().catch(error=>console.warn('PTCG cloud save unavailable; change remains local.',error))},800);
  }

  function autoStart(){
    window.addEventListener('ptcg:local-change',markLocalChange);
    window.addEventListener('savedmetas:updated',markLocalChange);
    window.addEventListener('online',()=>sync());
    setTimeout(async()=>{
      const result=await sync();
      if(result&&result.direction==='down'){
        const reloadKey='ptcg-cloud-restored-reload';
        if(sessionStorage.getItem(reloadKey)!=='1'){
          sessionStorage.setItem(reloadKey,'1');
          location.reload();
          return;
        }
      }
      sessionStorage.removeItem('ptcg-cloud-restored-reload');
    },50);
  }

  global.PTCGSharedSync={sync,push,pull,localSnapshot,restoreLocal,hasMeaningfulData};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoStart,{once:true});else autoStart();
})(window);
