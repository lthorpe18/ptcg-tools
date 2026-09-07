(function(global){
  'use strict';
  if(global.PTCGFormatRegistry)return;

  const core=global.PTCGFormatRegistryCore;
  if(!core){
    console.error('PTCG format registry core is unavailable');
    return;
  }

  function parentOwner(){
    try{
      if(global.top&&global.top!==global&&global.top.location.origin===global.location.origin){
        const candidate=global.top.PTCGFormatRegistry;
        if(candidate&&candidate.isOwner===true)return candidate;
      }
    }catch{}
    return null;
  }

  const owner=parentOwner();
  if(owner){
    const cleanups=new Set();
    const facade={
      isOwner:false,
      getState:()=>owner.getState(),
      resolveFormat:options=>owner.resolveFormat(options),
      refresh:options=>owner.refresh(options),
      subscribe(listener){const unsubscribe=owner.subscribe(listener);cleanups.add(unsubscribe);return ()=>{cleanups.delete(unsubscribe);unsubscribe()}},
    };
    global.addEventListener('pagehide',()=>{for(const unsubscribe of cleanups)unsubscribe();cleanups.clear()},{once:true});
    global.PTCGFormatRegistry=Object.freeze(facade);
    return;
  }

  const SUPABASE_URL='https://naylqcyrnhjvqodjpjsg.supabase.co';
  const SUPABASE_KEY='sb_publishable_Nr1MmUClNYQcD1vxkoJZog_VfOtBzFQ';
  const ENDPOINT=`${SUPABASE_URL}/rest/v1/rpc/get_ptcg_format_registry`;
  const CACHE_KEY='ptcg-tools.format-registry-lkg.v1';
  const options=global.__PTCG_FORMAT_RUNTIME_OPTIONS__||{};
  const timeoutMs=Number.isFinite(options.timeoutMs)?Math.max(1,options.timeoutMs):4000;
  const refreshAfterMs=Number.isFinite(options.refreshAfterMs)?Math.max(0,options.refreshAfterMs):300000;
  const listeners=new Set();
  let inFlight=null,lastAttemptAt=0;

  function nowIso(){return new Date().toISOString()}
  function snapshot(value){return Object.freeze({...value,registry:value.registry})}
  function initial(){
    const prepared=core.preparedConfig();
    let config=prepared,source='prepared';
    try{
      const cached=JSON.parse(global.localStorage.getItem(CACHE_KEY)||'null');
      const candidate=core.normalizeConfig(cached&&cached.config);
      if(cached.fingerprint!==core.fingerprint(candidate))throw new Error('cache-fingerprint');
      if(candidate.registry.versionNumber>prepared.registry.versionNumber){config=candidate;source='cache'}
    }catch{}
    return snapshot({phase:source==='cache'?'cached':'prepared',source,registryVersion:config.registry.versionNumber,registry:config.registry,checkedAt:null,lastLiveAt:null,errorCode:null,fingerprint:core.fingerprint(config)});
  }

  let state=initial();

  function emit(next){
    state=snapshot(next);
    for(const listener of [...listeners]){try{listener(state)}catch(error){setTimeout(()=>{throw error},0)}}
    try{global.dispatchEvent(new CustomEvent('ptcg:format-state-changed',{detail:state}))}catch{}
  }

  function getState(){return state}
  function resolveFormat(request){return core.resolveFormat({schemaVersion:core.SCHEMA_VERSION,registry:state.registry},request)}
  function subscribe(listener){
    if(typeof listener!=='function')throw new TypeError('listener must be a function');
    listeners.add(listener);
    return ()=>listeners.delete(listener);
  }

  function errorCode(error,timedOut){
    if(timedOut||error&&error.name==='AbortError')return 'timeout';
    if(error&&error.message==='remote-integrity-conflict')return 'integrity-conflict';
    if(error&&error.message==='remote-stale')return 'stale-version';
    if(error&&/^http-/.test(error.message||''))return error.message;
    if(error instanceof TypeError&&/^invalid-|^duplicate-/.test(error.message||''))return 'invalid-response';
    return 'network-error';
  }

  function refresh(request={}){
    if(inFlight)return inFlight;
    lastAttemptAt=Date.now();
    const controller=new AbortController();
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
    inFlight=(async()=>{
      try{
        const response=await global.fetch(ENDPOINT,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error(`http-${response.status}`);
        const config=core.normalizeConfig(await response.json());
        const nextFingerprint=core.fingerprint(config);
        if(config.registry.versionNumber<state.registryVersion)throw new Error('remote-stale');
        if(config.registry.versionNumber===state.registryVersion&&nextFingerprint!==state.fingerprint)throw new Error('remote-integrity-conflict');
        const checkedAt=nowIso();
        try{global.localStorage.setItem(CACHE_KEY,JSON.stringify({config,fingerprint:nextFingerprint,confirmedAt:checkedAt}))}catch{}
        emit({phase:'live',source:'live',registryVersion:config.registry.versionNumber,registry:config.registry,checkedAt,lastLiveAt:checkedAt,errorCode:null,fingerprint:nextFingerprint});
      }catch(error){
        emit({...state,phase:'degraded',checkedAt:nowIso(),errorCode:errorCode(error,timedOut)});
      }finally{
        clearTimeout(timer);
        inFlight=null;
      }
      return state;
    })();
    return inFlight;
  }

  const api=Object.freeze({isOwner:true,getState,resolveFormat,subscribe,refresh});
  global.PTCGFormatRegistry=api;

  function refreshIfStale(reason){if(!inFlight&&Date.now()-lastAttemptAt>=refreshAfterMs)refresh({reason})}
  global.addEventListener('online',()=>refreshIfStale('online'));
  global.addEventListener('pageshow',event=>{if(event.persisted)refreshIfStale('pageshow')});
  if(options.autoRefresh!==false)setTimeout(()=>refresh({reason:'startup'}),0);
})(window);
