(function(global){
  'use strict';
  const SUPABASE_URL='https://fwdmkoxtkxoyfbitydsd.supabase.co';
  const SUPABASE_KEY='sb_publishable_prvZjVQ_Jx_2YDS7FTzACg_Qe60Iaix';
  const META_KEY='ptcg-tools.meta-lab.saved-metas.v1';
  const PROVIDERS=['apple','google','discord'];
  let clientPromise=null;

  function loadScript(){
    if(global.supabase&&global.supabase.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Could not load Supabase client'));
      document.head.appendChild(s);
    });
  }

  async function client(){
    if(!clientPromise)clientPromise=loadScript().then(()=>global.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    return clientPromise;
  }

  function readMeta(){try{const v=JSON.parse(localStorage.getItem(META_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
  function writeMeta(rows){localStorage.setItem(META_KEY,JSON.stringify(Array.isArray(rows)?rows:[]));window.dispatchEvent(new CustomEvent('savedmetas:updated'))}
  function toMs(v){if(!v)return 0;if(typeof v==='number')return v;const n=Date.parse(v);return Number.isFinite(n)?n:0}
  function latestRootMs(root){if(!root)return 0;const rows=[...(root.plannedEvents||[]),...(root.preps||[])];return rows.reduce((m,x)=>Math.max(m,toMs(x.updatedAt||x.createdAt)),0)}
  async function localSnapshot(){const root=global.PTCGStorage?global.PTCGStorage.load():null;let decks=[];if(global.PTCGDeckStore){await global.PTCGDeckStore.open();decks=await global.PTCGDeckStore.all()}const savedMetas=readMeta();const modifiedAt=Math.max(latestRootMs(root),decks.reduce((m,d)=>Math.max(m,toMs(d.updatedAt||d.createdAt)),0),savedMetas.reduce((m,x)=>Math.max(m,toMs(x.updatedAt||x.createdAt)),0));return {schemaVersion:1,capturedAt:new Date().toISOString(),modifiedAt:modifiedAt?new Date(modifiedAt).toISOString():null,rootState:root,decks,savedMetas}}
  async function restoreLocal(payload){if(!payload||typeof payload!=='object')throw new Error('Invalid cloud snapshot');if(payload.rootState&&global.PTCGStorage)global.PTCGStorage.save(payload.rootState);if(Array.isArray(payload.savedMetas))writeMeta(payload.savedMetas);if(Array.isArray(payload.decks)&&global.PTCGDeckStore){await global.PTCGDeckStore.open();for(const d of payload.decks)await global.PTCGDeckStore.put(d)}return payload}

  async function getUser(){const c=await client();const {data,error}=await c.auth.getUser();if(error)return null;return data.user||null}
  async function getSession(){const c=await client();const {data}=await c.auth.getSession();return data.session||null}
  function defaultRedirect(){return new URL('../settings/',document.baseURI).href}
  async function signInWithProvider(provider,redirectTo){
    if(!PROVIDERS.includes(provider))throw new Error('Unsupported sign-in provider');
    const c=await client();
    const {data,error}=await c.auth.signInWithOAuth({provider,options:{redirectTo:redirectTo||defaultRedirect()}});
    if(error)throw error;
    return data;
  }
  async function signOut(){const c=await client();const {error}=await c.auth.signOut();if(error)throw error}
  async function onAuthStateChange(callback){const c=await client();return c.auth.onAuthStateChange((event,session)=>callback(event,session))}
  function userLabel(user){
    if(!user)return 'Guest';
    const meta=user.user_metadata||{};
    return meta.full_name||meta.name||meta.preferred_username||meta.user_name||meta.custom_claims?.global_name||user.email?.split('@')[0]||'Signed in';
  }
  function providerLabel(user){
    const provider=user?.app_metadata?.provider||user?.identities?.[0]?.provider||'';
    return provider?provider.charAt(0).toUpperCase()+provider.slice(1):'';
  }

  async function push(){const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');const payload=await localSnapshot(),now=new Date().toISOString();const {error}=await c.from('user_snapshots').upsert({user_id:user.id,payload,updated_at:now},{onConflict:'user_id'});if(error)throw error;return {payload,updatedAt:now}}
  async function pull(){const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');const {data,error}=await c.from('user_snapshots').select('payload,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data)return null;await restoreLocal(data.payload);return data}
  async function sync(){const c=await client(),user=await getUser();if(!user)throw new Error('Sign in first');const local=await localSnapshot();const {data,error}=await c.from('user_snapshots').select('payload,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data){const pushed=await push();return {direction:'up',updatedAt:pushed.updatedAt}}const remoteTime=toMs(data.updated_at),localTime=toMs(local.modifiedAt);if(remoteTime>localTime){await restoreLocal(data.payload);return {direction:'down',updatedAt:data.updated_at}}const pushed=await push();return {direction:'up',updatedAt:pushed.updatedAt}}

  global.PTCGCloud={client,getUser,getSession,signInWithProvider,signOut,onAuthStateChange,userLabel,providerLabel,push,pull,sync,localSnapshot,restoreLocal,providers:PROVIDERS.slice()};
})(window);
