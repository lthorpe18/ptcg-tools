(function(global){
  'use strict';
  const SUPABASE_URL='https://naylqcyrnhjvqodjpjsg.supabase.co';
  const SUPABASE_KEY='sb_publishable_Nr1MmUClNYQcD1vxkoJZog_VfOtBzFQ';
  const META_KEY='ptcg-tools.meta-lab.saved-metas.v1';
  const DIRTY_KEY='ptcg-tools.cloud-dirty-at.v1';
  const LAST_SYNC_KEY='ptcg-tools.cloud-last-sync-at.v1';
  const PROVIDERS=['google'];
  let clientPromise=null,syncTimer=null,syncing=false,restoring=false;
  function loadScript(){if(global.supabase&&global.supabase.createClient)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Supabase client'));document.head.appendChild(s)})}
  async function client(){if(!clientPromise)clientPromise=loadScript().then(()=>global.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));return clientPromise}
  function readMeta(){try{const v=JSON.parse(localStorage.getItem(META_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
  function writeMeta(rows){localStorage.setItem(META_KEY,JSON.stringify(Array.isArray(rows)?rows:[]));window.dispatchEvent(new CustomEvent('savedmetas:updated'))}
  function toMs(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(v);return Number.isFinite(n)?n:0}
  function dirtyAt(){return Number(localStorage.getItem(DIRTY_KEY)||0)||0}
  function lastSyncAt(){return Number(localStorage.getItem(LAST_SYNC_KEY)||0)||0}
  function emitSync(detail){window.dispatchEvent(new CustomEvent('ptcg:cloud-sync',{detail}))}
  async function localSnapshot(){
    const root=global.PTCGStorage?global.PTCGStorage.load():null;
    let decks=[];
    if(global.PTCGDeckStore){await global.PTCGDeckStore.open();decks=await global.PTCGDeckStore.all()}
    return {schemaVersion:2,capturedAt:new Date().toISOString(),modifiedAt:dirtyAt()?new Date(dirtyAt()).toISOString():null,rootState:root,decks,savedMetas:readMeta()};
  }
  async function restoreLocal(payload){
    if(!payload||typeof payload!=='object')throw new Error('Invalid cloud snapshot');
    restoring=true;
    try{
      if(payload.rootState&&global.PTCGStorage)global.PTCGStorage.save(payload.rootState);
      if(Array.isArray(payload.savedMetas))writeMeta(payload.savedMetas);
      if(Array.isArray(payload.decks)&&global.PTCGDeckStore){await global.PTCGDeckStore.open();if(global.PTCGDeckStore.replaceAll)await global.PTCGDeckStore.replaceAll(payload.decks);else{for(const d of payload.decks)await global.PTCGDeckStore.put(d)}}
      return payload;
    }finally{restoring=false}
  }
  async function getUser(){const c=await client();const {data,error}=await c.auth.getUser();if(error)return null;return data.user||null}
  async function getSession(){const c=await client();const {data}=await c.auth.getSession();return data.session||null}
  async function providerStatus(){try{const r=await fetch(`${SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:SUPABASE_KEY},cache:'no-store'});if(!r.ok)throw new Error('Auth settings unavailable');const data=await r.json();return {google:!!data?.external?.google}}catch{return {google:false}}}
  function appRootRedirect(){const declared=global.document?.body?.dataset?.appRoot||'.';return new URL(declared.endsWith('/')?declared:`${declared}/`,document.baseURI).href}
  async function signInWithProvider(provider,redirectTo){
    if(provider!=='google')throw new Error('Unsupported sign-in provider');
    const enabled=await providerStatus();if(!enabled.google)throw new Error('Google sign-in is not configured yet.');
    const c=await client();
    const {data,error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectTo||appRootRedirect(),skipBrowserRedirect:true}});
    if(error)throw error;if(!data?.url)throw new Error('Google sign-in could not be started.');
    const target=(global.top&&global.top!==global)?global.top:global;
    target.location.assign(data.url);
    return data;
  }
  async function signOut(){const c=await client();const {error}=await c.auth.signOut();if(error)throw error}
  async function onAuthStateChange(callback){const c=await client();return c.auth.onAuthStateChange((event,session)=>callback(event,session))}
  function userLabel(user){if(!user)return 'Guest';const meta=user.user_metadata||{};return meta.full_name||meta.name||user.email?.split('@')[0]||'Signed in'}
  function providerLabel(user){return user?'Google':''}
  async function push(){
    const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');
    const beforeDirty=dirtyAt(),payload=await localSnapshot(),now=new Date().toISOString();
    const {error}=await c.from('user_snapshots').upsert({user_id:user.id,payload,updated_at:now},{onConflict:'user_id'});if(error)throw error;
    const ms=toMs(now);localStorage.setItem(LAST_SYNC_KEY,String(ms));if(dirtyAt()===beforeDirty)localStorage.removeItem(DIRTY_KEY);
    emitSync({direction:'up',updatedAt:now});return {payload,updatedAt:now};
  }
  async function pull(){
    const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');
    const {data,error}=await c.from('user_snapshots').select('payload,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data)return null;
    await restoreLocal(data.payload);localStorage.removeItem(DIRTY_KEY);localStorage.setItem(LAST_SYNC_KEY,String(toMs(data.updated_at)));emitSync({direction:'down',updatedAt:data.updated_at});return data;
  }
  async function reconcile(){
    if(syncing)return null;syncing=true;
    try{
      const c=await client(),user=await getUser();if(!user)return null;
      const {data,error}=await c.from('user_snapshots').select('payload,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;
      if(!data)return await push();
      const remoteMs=toMs(data.updated_at),dirty=dirtyAt();
      if(dirty&&dirty>remoteMs)return await push();
      if(remoteMs>lastSyncAt()||!lastSyncAt()){await restoreLocal(data.payload);localStorage.removeItem(DIRTY_KEY);localStorage.setItem(LAST_SYNC_KEY,String(remoteMs));emitSync({direction:'down',updatedAt:data.updated_at});return {direction:'down',updatedAt:data.updated_at}}
      return {direction:'none',updatedAt:data.updated_at};
    }finally{syncing=false}
  }
  async function sync(){return reconcile()}
  function markDirty(){if(restoring)return;localStorage.setItem(DIRTY_KEY,String(Date.now()));schedulePush()}
  function schedulePush(){clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{if(syncing||restoring||!navigator.onLine)return;syncing=true;try{if(await getUser())await push()}catch(error){console.warn('PTCG cloud sync deferred',error)}finally{syncing=false}},700)}
  function installAutoSync(){
    if(global.top!==global)return;
    window.addEventListener('ptcg:local-change',markDirty);
    window.addEventListener('storage',event=>{
      if(restoring)return;
      if(event.key===META_KEY||event.key===(global.PTCGStorage&&global.PTCGStorage.ROOT_KEY))markDirty();
      if(event.key&&event.key.startsWith('sb-')&&event.key.includes('-auth-token'))setTimeout(()=>reconcile().catch(()=>{}),100);
    });
    try{const channel=new BroadcastChannel('ptcg-tools-local-change');channel.onmessage=()=>markDirty();global.__ptcgCloudChannel=channel}catch{}
    window.addEventListener('online',()=>reconcile().catch(()=>{}));
    window.addEventListener('focus',()=>reconcile().catch(()=>{}));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconcile().catch(()=>{})});
    onAuthStateChange((event)=>{if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')reconcile().catch(()=>{})}).catch(()=>{});
    reconcile().catch(()=>{});
  }
  global.PTCGCloud={client,getUser,getSession,providerStatus,signInWithProvider,signOut,onAuthStateChange,userLabel,providerLabel,push,pull,sync:reconcile,reconcile,localSnapshot,restoreLocal,providers:PROVIDERS.slice()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installAutoSync,{once:true});else installAutoSync();
})(window);
