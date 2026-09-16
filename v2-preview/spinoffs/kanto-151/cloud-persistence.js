(function(global){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';
  const UPDATED_KEY='ptcg-kanto-151-updated-at-v1';
  const TABLE='kanto_151_collections';
  const SUPABASE_URL='https://naylqcyrnhjvqodjpjsg.supabase.co';
  const SUPABASE_KEY='sb_publishable_Nr1MmUClNYQcD1vxkoJZog_VfOtBzFQ';
  const SUPABASE_JS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js';
  const originalSetItem=Storage.prototype.setItem;
  let clientPromise=null;
  let pushTimer=null;
  let syncing=false;
  let suppressLocalChange=false;

  const status=document.getElementById('cloud-status');
  const signInButton=document.getElementById('cloud-sign-in');

  function setStatus(text,mode=''){
    if(status){status.textContent=text;status.dataset.mode=mode;}
  }

  function readState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch{return {};}
  }

  function stateHasCards(value=readState()){
    return Object.values(value).some(slot=>slot&&typeof slot==='object'&&slot.card&&slot.card.id);
  }

  function updatedAt(){return Number(localStorage.getItem(UPDATED_KEY)||0)||0;}
  function sameState(a,b){
    try{return JSON.stringify(a||{})===JSON.stringify(b||{});}catch{return false;}
  }

  function loadScript(){
    if(global.supabase?.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=SUPABASE_JS;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Could not load cloud save client'));
      document.head.appendChild(script);
    });
  }

  async function client(){
    if(!clientPromise){
      clientPromise=loadScript().then(()=>global.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      }));
    }
    return clientPromise;
  }

  async function getUser(){
    const c=await client();
    const {data,error}=await c.auth.getUser();
    if(error)return null;
    return data.user||null;
  }

  function writeLocal(payload,remoteMs){
    suppressLocalChange=true;
    try{
      originalSetItem.call(localStorage,STORAGE_KEY,JSON.stringify(payload||{}));
      originalSetItem.call(localStorage,UPDATED_KEY,String(remoteMs||Date.now()));
    }finally{suppressLocalChange=false;}
  }

  async function push(user){
    if(!user)return null;
    const c=await client();
    const payload=readState();
    const now=new Date().toISOString();
    const {error}=await c.from(TABLE).upsert({user_id:user.id,payload,updated_at:now},{onConflict:'user_id'});
    if(error)throw error;
    suppressLocalChange=true;
    try{originalSetItem.call(localStorage,UPDATED_KEY,String(Date.parse(now)));}
    finally{suppressLocalChange=false;}
    setStatus('Cloud saved','saved');
    return {payload,updatedAt:now};
  }

  async function reconcile(){
    if(syncing)return;
    syncing=true;
    try{
      setStatus('Checking save…','syncing');
      const c=await client();
      const user=await getUser();
      if(!user){
        setStatus('Local only','local');
        if(signInButton)signInButton.hidden=false;
        return;
      }
      if(signInButton)signInButton.hidden=true;
      const {data,error}=await c.from(TABLE).select('payload,updated_at').eq('user_id',user.id).maybeSingle();
      if(error)throw error;

      const local=readState();
      const localMs=updatedAt();
      if(!data){
        if(stateHasCards(local))await push(user);
        else setStatus('Cloud ready','saved');
        return;
      }

      const remote=data.payload&&typeof data.payload==='object'&&!Array.isArray(data.payload)?data.payload:{};
      const remoteMs=Date.parse(data.updated_at)||0;
      if(localMs>remoteMs&&stateHasCards(local)){
        await push(user);
        return;
      }

      if(!sameState(local,remote)){
        writeLocal(remote,remoteMs);
        setStatus('Restoring…','syncing');
        global.location.reload();
        return;
      }

      if(remoteMs&&!localMs){
        suppressLocalChange=true;
        try{originalSetItem.call(localStorage,UPDATED_KEY,String(remoteMs));}
        finally{suppressLocalChange=false;}
      }
      setStatus('Cloud saved','saved');
    }catch(error){
      console.warn('Kanto cloud save unavailable',error);
      setStatus('Save offline','error');
    }finally{syncing=false;}
  }

  function schedulePush(){
    clearTimeout(pushTimer);
    setStatus('Saving…','syncing');
    pushTimer=setTimeout(async()=>{
      if(!navigator.onLine)return setStatus('Save offline','error');
      try{
        const user=await getUser();
        if(user)await push(user);
        else{
          setStatus('Local only','local');
          if(signInButton)signInButton.hidden=false;
        }
      }catch(error){
        console.warn('Kanto cloud save deferred',error);
        setStatus('Save offline','error');
      }
    },700);
  }

  Storage.prototype.setItem=function(key,value){
    originalSetItem.call(this,key,value);
    if(this!==localStorage||key!==STORAGE_KEY||suppressLocalChange)return;
    originalSetItem.call(localStorage,UPDATED_KEY,String(Date.now()));
    schedulePush();
  };

  signInButton?.addEventListener('click',async()=>{
    try{
      setStatus('Signing in…','syncing');
      const c=await client();
      const redirectTo=`${location.origin}${location.pathname}`;
      const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
      if(error)throw error;
    }catch(error){
      console.warn('Kanto sign-in failed',error);
      setStatus('Sign-in failed','error');
    }
  });

  window.addEventListener('online',()=>reconcile());
  window.addEventListener('focus',()=>reconcile());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconcile();});

  client().then(c=>{
    c.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')setTimeout(()=>reconcile(),0);
      if(event==='SIGNED_OUT'){
        setStatus('Local only','local');
        if(signInButton)signInButton.hidden=false;
      }
    });
    return reconcile();
  }).catch(error=>{
    console.warn('Kanto cloud save unavailable',error);
    setStatus('Local only','local');
    if(signInButton)signInButton.hidden=false;
  });

  global.PTCGKantoCloud={reconcile,push,getUser};
})(window);
