(function(global){
  'use strict';
  const SUPABASE_URL='https://fwdmkoxtkxoyfbitydsd.supabase.co';
  const SUPABASE_KEY='sb_publishable_prvZjVQ_Jx_2YDS7FTzACg_Qe60Iaix';
  const META_KEY='ptcg-tools.meta-lab.saved-metas.v1';
  let clientPromise=null;

  function loadScript(){
    if(global.supabase&&global.supabase.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Supabase client'));
      document.head.appendChild(s);
    });
  }
  async function client(){
    if(!clientPromise)clientPromise=loadScript().then(()=>global.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    return clientPromise;
  }
  function readMeta(){try{const v=JSON.parse(localStorage.getItem(META_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
  function writeMeta(rows){localStorage.setItem(META_KEY,JSON.stringify(Array.isArray(rows)?rows:[]));window.dispatchEvent(new CustomEvent('savedmetas:updated'))}
  async function localSnapshot(){
    const root=global.PTCGStorage?global.PTCGStorage.load():null;
    let decks=[];
    if(global.PTCGDeckStore){await global.PTCGDeckStore.open();decks=await global.PTCGDeckStore.all()}
    return {schemaVersion:1,capturedAt:new Date().toISOString(),rootState:root,decks,savedMetas:readMeta()};
  }
  async function restoreLocal(payload){
    if(!payload||typeof payload!=='object')throw new Error('Invalid cloud snapshot');
    if(payload.rootState&&global.PTCGStorage)global.PTCGStorage.save(payload.rootState);
    if(Array.isArray(payload.savedMetas))writeMeta(payload.savedMetas);
    if(Array.isArray(payload.decks)&&global.PTCGDeckStore){await global.PTCGDeckStore.open();for(const d of payload.decks)await global.PTCGDeckStore.put(d)}
    return payload;
  }
  async function getUser(){const c=await client();const {data,error}=await c.auth.getUser();if(error)return null;return data.user||null}
  async function signUp(email,password){
    const c=await client();
    const {data,error}=await c.auth.signUp({email,password,options:{emailRedirectTo:'https://lthorpe18.github.io/ptcg-tools/v2-preview/apps/account/'}});
    if(error)throw error;return data;
  }
  async function signIn(email,password){const c=await client();const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;return data}
  async function signOut(){const c=await client();const {error}=await c.auth.signOut();if(error)throw error}
  async function push(){
    const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');
    const payload=await localSnapshot();
    const {error}=await c.from('user_snapshots').upsert({user_id:user.id,payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error)throw error;return payload;
  }
  async function pull(){
    const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');
    const {data,error}=await c.from('user_snapshots').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
    if(error)throw error;if(!data)return null;await restoreLocal(data.payload);return data;
  }
  async function sync(){
    const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');
    const local=await localSnapshot();
    const {data,error}=await c.from('user_snapshots').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!data){await push();return {direction:'up',updatedAt:new Date().toISOString()}}
    const remoteTime=Date.parse(data.updated_at||data.payload?.capturedAt||0)||0;
    const localTime=Date.parse(local.capturedAt)||0;
    if(remoteTime>localTime){await restoreLocal(data.payload);return {direction:'down',updatedAt:data.updated_at}}
    await push();return {direction:'up',updatedAt:new Date().toISOString()};
  }
  global.PTCGCloud={client,getUser,signUp,signIn,signOut,push,pull,sync,localSnapshot,restoreLocal};
})(window);
