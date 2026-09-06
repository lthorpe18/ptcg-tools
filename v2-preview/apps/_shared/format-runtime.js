(function(global){
  'use strict';

  const SUPABASE_URL='https://naylqcyrnhjvqodjpjsg.supabase.co';
  const SUPABASE_KEY='sb_publishable_Nr1MmUClNYQcD1vxkoJZog_VfOtBzFQ';
  const fallbackFormula={versionKey:'blended-v2',versionNumber:2,irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25,transitionPolicy:'format-aware-v2'};
  const asDate=value=>{if(!value)return null;const raw=/^\d{4}-\d{2}-\d{2}$/.test(String(value))?`${value}T00:00:00Z`:value;const d=new Date(raw);return Number.isFinite(d.getTime())?d:null};
  const ordered=sets=>[...(sets||[])].sort((a,b)=>Number(a.releaseOrder||0)-Number(b.releaseOrder||0));

  function embeddedConfig(){
    const config=global.MetaRelease?.core?.()?.config||null;
    if(!config)return null;
    return {...config,sets:ordered(config.sets||[]),formula:config.formula||fallbackFormula};
  }

  function resolveFormatAt(sets,channel='online',at=new Date()){
    const when=at instanceof Date?at:new Date(at);if(!Number.isFinite(when.getTime()))return null;
    const field=channel==='irl'?'irlLegalDate':'onlineLegalDate',rows=ordered(sets);
    const eligible=rows.filter(set=>{const d=asDate(set[field]);return d&&d.getTime()<=when.getTime()});
    if(!eligible.length)return null;
    const upper=eligible.at(-1),rotations=eligible.filter(set=>set.isRotationSet&&set.rotationLowerSetCode),rotation=rotations.at(-1)||null;
    const lowerCode=rotation?.rotationLowerSetCode||rows[0]?.setCode||upper.setCode,lower=rows.find(set=>set.setCode===lowerCode)||upper;
    return {id:`${lowerCode}-${upper.setCode}`,label:`${lowerCode}–${upper.setCode}`,lowerSetCode:lowerCode,upperSetCode:upper.setCode,upperSetTitle:upper.setTitle||upper.setCode,startDate:String(upper[field]||'').slice(0,10)||null,channel,isRotationStart:!!upper.isRotationSet,rotationSetCode:rotation?.setCode||null,rotationLowerSetCode:rotation?.rotationLowerSetCode||null,lowerReleaseOrder:Number(lower.releaseOrder||0),upperReleaseOrder:Number(upper.releaseOrder||0)};
  }

  function formatForEvent(eventDate){
    const config=current();
    if(!config?.sets?.length||!eventDate)return null;
    return resolveFormatAt(config.sets,'irl',new Date(`${String(eventDate).slice(0,10)}T23:59:59Z`));
  }

  let publicState=null;let readyResolve;const readyPromise=new Promise(resolve=>{readyResolve=resolve});
  function fromEmbedded(){const config=embeddedConfig();if(!config)return null;return {sets:config.sets||[],online:config.onlineFormat||resolveFormatAt(config.sets,'online'),irl:config.irlFormat||resolveFormatAt(config.sets,'irl'),formula:config.formula||fallbackFormula,registryVersion:Number(config.registryVersion||0),source:config.source||'release'};}
  function current(){return publicState||fromEmbedded()}
  function publicHeaders(){return {apikey:SUPABASE_KEY,Accept:'application/json'}}
  async function publicJson(path){const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:publicHeaders(),cache:'no-store'});if(!response.ok)throw new Error(`Shared config ${response.status}`);return response.json()}
  async function refreshPublic(){
    try{
      const [registries,formulas,pointers]=await Promise.all([
        publicJson('ptcg_format_registry_versions?status=eq.published&select=version_number,sets&order=version_number.desc&limit=1'),
        publicJson('ptcg_blended_formula_versions?status=eq.published&select=*&order=version_number.desc'),
        publicJson('ptcg_blended_live_formula?singleton=eq.true&select=formula_id&limit=1'),
      ]);
      const registry=registries?.[0],pointer=pointers?.[0],row=(formulas||[]).find(item=>item.id===pointer?.formula_id)||(formulas||[])[0];
      if(registry?.sets?.length){const sets=ordered(registry.sets);publicState={sets,online:resolveFormatAt(sets,'online'),irl:resolveFormatAt(sets,'irl'),formula:row?normaliseFormula(row):(fromEmbedded()?.formula||fallbackFormula),registryVersion:Number(registry.version_number||0),source:'supabase'};global.dispatchEvent(new CustomEvent('ptcg:format-config',{detail:publicState}));}
    }catch(error){console.warn('Live format config unavailable; using prepared release config.',error);publicState=fromEmbedded();}
    readyResolve(publicState);return publicState;
  }

  function cloud(){
    if(global.PTCGCloud)return global.PTCGCloud;
    try{if(global.top&&global.top!==global&&global.top.PTCGCloud)return global.top.PTCGCloud}catch{}
    return null;
  }
  async function client(){const c=cloud();if(!c?.client)throw new Error('Account services are unavailable on this screen.');return c.client()}
  async function user(){const c=cloud();if(!c?.getUser)return null;return c.getUser()}
  async function isAdmin(){
    const [c,u]=await Promise.all([client(),user()]);if(!u)return false;
    const {data,error}=await c.from('ptcg_admins').select('user_id').eq('user_id',u.id).maybeSingle();if(error)throw error;return !!data;
  }

  async function adminState(){
    const c=await client();
    const [registries,formulas,pointer]=await Promise.all([
      c.from('ptcg_format_registry_versions').select('*').order('version_number',{ascending:false}),
      c.from('ptcg_blended_formula_versions').select('*').order('version_number',{ascending:false}),
      c.from('ptcg_blended_live_formula').select('*').eq('singleton',true).maybeSingle(),
    ]);
    if(registries.error)throw registries.error;if(formulas.error)throw formulas.error;if(pointer.error)throw pointer.error;
    return {registries:registries.data||[],formulas:formulas.data||[],live:pointer.data||null};
  }

  async function createRegistryDraft(){
    const [c,u,state]=await Promise.all([client(),user(),adminState()]);if(!u)throw new Error('Sign in first.');
    const base=state.registries.find(row=>row.status==='published')||state.registries[0];if(!base)throw new Error('No registry exists to draft from.');
    const version=Math.max(0,...state.registries.map(row=>Number(row.version_number||0)))+1;
    const {data,error}=await c.from('ptcg_format_registry_versions').insert({version_number:version,status:'draft',sets:base.sets||[],notes:'',created_by:u.id}).select('*').single();if(error)throw error;return data;
  }
  async function saveRegistryDraft(id,sets,notes=''){
    const c=await client();const {data,error}=await c.from('ptcg_format_registry_versions').update({sets:ordered(sets),notes}).eq('id',id).eq('status','draft').select('*').single();if(error)throw error;return data;
  }
  async function publishRegistry(id){
    const c=await client(),now=new Date().toISOString();const {data,error}=await c.from('ptcg_format_registry_versions').update({status:'published',published_at:now}).eq('id',id).eq('status','draft').select('*').single();if(error)throw error;return data;
  }

  function normaliseFormula(row={}){return {id:row.id||null,versionKey:row.version_key||row.versionKey||'blended-v2',versionNumber:Number(row.version_number??row.versionNumber??2),status:row.status||'draft',irlStartWeight:Number(row.irl_start_weight??row.irlStartWeight??.70),irlDecayPerDay:Number(row.irl_decay_per_day??row.irlDecayPerDay??.02),irlFloor:Number(row.irl_floor??row.irlFloor??.30),previousFormatCap:Number(row.previous_format_cap??row.previousFormatCap??.25),transitionPolicy:row.transition_policy||row.transitionPolicy||'format-aware-v2',notes:row.notes||''};}
  function validFormula(input){const start=Math.max(0,Math.min(1,Number(input.irlStartWeight))),floor=Math.max(0,Math.min(start,Number(input.irlFloor))),decay=Math.max(0,Math.min(1,Number(input.irlDecayPerDay)));if(![start,floor,decay].every(Number.isFinite))throw new Error('Formula values must be numbers.');return {...input,irlStartWeight:start,irlFloor:floor,irlDecayPerDay:decay,previousFormatCap:.25,transitionPolicy:'format-aware-v2'};}
  async function createFormulaDraft(values={}){
    const [c,u,state]=await Promise.all([client(),user(),adminState()]);if(!u)throw new Error('Sign in first.');
    const version=Math.max(0,...state.formulas.map(row=>Number(row.version_number||0)))+1;
    const base=normaliseFormula(state.formulas.find(row=>row.id===state.live?.formula_id)||state.formulas.find(row=>row.status==='published')||{});
    const f=validFormula({...base,...values});
    const {data,error}=await c.from('ptcg_blended_formula_versions').insert({version_number:version,version_key:`blended-v${version}`,status:'draft',irl_start_weight:f.irlStartWeight,irl_decay_per_day:f.irlDecayPerDay,irl_floor:f.irlFloor,previous_format_cap:.25,transition_policy:'format-aware-v2',notes:f.notes||'',created_by:u.id}).select('*').single();if(error)throw error;return data;
  }
  async function saveFormulaDraft(id,values){
    const c=await client(),f=validFormula(values);const {data,error}=await c.from('ptcg_blended_formula_versions').update({irl_start_weight:f.irlStartWeight,irl_decay_per_day:f.irlDecayPerDay,irl_floor:f.irlFloor,previous_format_cap:.25,transition_policy:'format-aware-v2',notes:f.notes||''}).eq('id',id).eq('status','draft').select('*').single();if(error)throw error;return data;
  }
  async function activateFormula(formulaId){
    const [c,u]=await Promise.all([client(),user()]);if(!u)throw new Error('Sign in first.');const now=new Date().toISOString();
    const update=await c.from('ptcg_blended_live_formula').update({formula_id:formulaId,activated_at:now,activated_by:u.id}).eq('singleton',true);if(update.error)throw update.error;
    const log=await c.from('ptcg_blended_formula_activations').insert({formula_id:formulaId,activated_at:now,activated_by:u.id});if(log.error)throw log.error;return {formulaId,activatedAt:now};
  }
  async function publishFormula(id){
    const c=await client(),now=new Date().toISOString();const {data,error}=await c.from('ptcg_blended_formula_versions').update({status:'published',published_at:now}).eq('id',id).eq('status','draft').select('*').single();if(error)throw error;await activateFormula(id);return data;
  }
  async function reactivateFormula(id){return activateFormula(id)}

  async function reviewState(){
    const [c,u]=await Promise.all([client(),user()]);if(!u)return null;const {data,error}=await c.from('ptcg_blended_review_state').select('*').eq('user_id',u.id).maybeSingle();if(error)throw error;return data||null;
  }
  async function markReviewSeen(key){
    if(!key)return null;const [c,u]=await Promise.all([client(),user()]);if(!u)return null;const now=new Date().toISOString();const {data,error}=await c.from('ptcg_blended_review_state').upsert({user_id:u.id,last_seen_evaluation_key:key,updated_at:now},{onConflict:'user_id'}).select('*').single();if(error)throw error;return data;
  }

  global.PTCGFormatRuntime={embeddedConfig,current,ready:()=>readyPromise,refreshPublic,resolveFormatAt,formatForEvent,isAdmin,adminState,createRegistryDraft,saveRegistryDraft,publishRegistry,normaliseFormula,createFormulaDraft,saveFormulaDraft,publishFormula,reactivateFormula,reviewState,markReviewSeen};
  refreshPublic();
})(window);
