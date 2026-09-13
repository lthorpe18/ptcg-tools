(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(null);
  else root.PTCGFormatCalendar=factory(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const TABLE='ptcg_maintained_calendar_versions';
  const ADMIN_TABLE='ptcg_admins';
  const PUBLISH_RPC='ptcg_publish_maintained_calendar';
  const LKG_KEY='ptcg-tools.format-calendar.lkg.v1';
  const EVENT_NAME='ptcg:format-calendar-updated';

  const clone=value=>JSON.parse(JSON.stringify(value));
  const safeParse=value=>{try{return value?JSON.parse(value):null}catch{return null}};

  function formatApi(explicit){return explicit||(root&&root.PTCGFormat)||null}
  function storageApi(explicit){return explicit||(root&&root.localStorage)||null}
  function fetchApi(explicit){return explicit||(root&&root.fetch)||null}

  function validateRegistry(registry,explicitFormat){
    const api=formatApi(explicitFormat);
    if(!api||typeof api.validate!=='function'||typeof api.create!=='function')throw new Error('Shared format resolver is unavailable');
    if(!registry||typeof registry!=='object'||Array.isArray(registry))throw new TypeError('Maintained calendar must be an object');
    const errors=api.validate(registry);
    if(errors.length)throw new TypeError(errors.join('\n'));
    // create() is the runtime contract too; validation and construction must agree.
    api.create(registry);
    return clone(registry);
  }

  function fallbackUrl(explicit){
    if(explicit)return explicit;
    const current=root&&root.document&&root.document.currentScript&&root.document.currentScript.src;
    if(current)return new URL('../../../data/formats/maintained-calendar.json',current).href;
    return '../../../data/formats/maintained-calendar.json';
  }

  async function clientApi(explicit){
    if(explicit)return explicit;
    if(root&&root.PTCGCloud&&typeof root.PTCGCloud.client==='function')return root.PTCGCloud.client();
    return null;
  }

  function readLkg(storage,explicitFormat){
    if(!storage)return null;
    const row=safeParse(storage.getItem(LKG_KEY));
    if(!row||!row.registry)return null;
    try{return {...row,registry:validateRegistry(row.registry,explicitFormat)}}catch{return null}
  }

  function writeLkg(storage,row,explicitFormat){
    if(!storage||!row||!row.registry)return;
    const registry=validateRegistry(row.registry,explicitFormat);
    storage.setItem(LKG_KEY,JSON.stringify({
      id:row.id||null,
      versionNumber:Number(row.version_number||row.versionNumber||0)||null,
      publishedAt:row.published_at||row.publishedAt||null,
      cachedAt:new Date().toISOString(),
      registry
    }));
  }

  async function readPublished(client,explicitFormat){
    if(!client)return null;
    const {data,error}=await client.from(TABLE)
      .select('id,version_number,status,registry,notes,created_at,published_at')
      .eq('status','published')
      .order('version_number',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(error)throw error;
    if(!data)return null;
    return {...data,registry:validateRegistry(data.registry,explicitFormat)};
  }

  async function readFallback(options){
    const fetcher=fetchApi(options.fetch);
    if(!fetcher)throw new Error('No maintained calendar fallback loader is available');
    const response=await fetcher(fallbackUrl(options.fallbackUrl),{cache:'no-store'});
    if(!response||!response.ok)throw new Error(`Maintained calendar fallback failed${response?` (${response.status})`:''}`);
    const registry=validateRegistry(await response.json(),options.format);
    return {id:null,version_number:null,status:'fallback',registry,notes:'Checked-in bootstrap/fallback',created_at:null,published_at:null};
  }

  async function load(options={}){
    const storage=storageApi(options.storage);
    let remoteError=null;
    try{
      const client=await clientApi(options.client);
      const remote=await readPublished(client,options.format);
      if(remote){
        writeLkg(storage,remote,options.format);
        return {source:'shared',...remote};
      }
    }catch(error){remoteError=error}

    const lkg=readLkg(storage,options.format);
    if(lkg)return {source:'lkg',status:'published',version_number:lkg.versionNumber,published_at:lkg.publishedAt,registry:lkg.registry,remoteError};

    const fallback=await readFallback(options);
    writeLkg(storage,fallback,options.format);
    return {source:'fallback',...fallback,remoteError};
  }

  async function currentRegistry(options={}){return (await load(options)).registry}

  async function currentUser(client){
    if(!client||!client.auth||typeof client.auth.getUser!=='function')return null;
    const {data,error}=await client.auth.getUser();
    if(error)throw error;
    return data&&data.user||null;
  }

  async function isAdmin(options={}){
    const client=await clientApi(options.client);
    if(!client)return false;
    const user=await currentUser(client);
    if(!user)return false;
    const {data,error}=await client.from(ADMIN_TABLE).select('user_id').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    return !!data;
  }

  async function createDraft(registry,notes='',options={}){
    const clean=validateRegistry(registry,options.format);
    const client=await clientApi(options.client);
    if(!client)throw new Error('Shared calendar persistence is unavailable');
    const user=await currentUser(client);
    if(!user)throw new Error('Sign in with an authorised maintainer account first');
    const {data,error}=await client.from(TABLE)
      .insert({status:'draft',registry:clean,notes:String(notes||''),created_by:user.id})
      .select('id,version_number,status,registry,notes,created_at,published_at')
      .single();
    if(error)throw error;
    return {...data,registry:validateRegistry(data.registry,options.format)};
  }

  async function updateDraft(id,registry,notes='',options={}){
    if(!id)throw new TypeError('Draft id is required');
    const clean=validateRegistry(registry,options.format);
    const client=await clientApi(options.client);
    if(!client)throw new Error('Shared calendar persistence is unavailable');
    const {data,error}=await client.from(TABLE)
      .update({registry:clean,notes:String(notes||'')})
      .eq('id',id)
      .eq('status','draft')
      .select('id,version_number,status,registry,notes,created_at,published_at')
      .single();
    if(error)throw error;
    return {...data,registry:validateRegistry(data.registry,options.format)};
  }

  function emitUpdated(row){
    if(!root||typeof root.dispatchEvent!=='function')return;
    const detail={id:row.id||null,versionNumber:Number(row.version_number||0)||null,publishedAt:row.published_at||null};
    const EventCtor=root.CustomEvent;
    if(typeof EventCtor==='function')root.dispatchEvent(new EventCtor(EVENT_NAME,{detail}));
  }

  async function publish(id,options={}){
    if(!id)throw new TypeError('Draft id is required');
    const client=await clientApi(options.client);
    if(!client)throw new Error('Shared calendar persistence is unavailable');
    const {data,error}=await client.rpc(PUBLISH_RPC,{p_id:id});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(!row||!row.registry)throw new Error('Published calendar was not returned');
    row.registry=validateRegistry(row.registry,options.format);
    writeLkg(storageApi(options.storage),row,options.format);
    emitUpdated(row);
    return row;
  }

  function clearLocalCache(options={}){storageApi(options.storage)?.removeItem(LKG_KEY)}

  return Object.freeze({
    TABLE,ADMIN_TABLE,PUBLISH_RPC,LKG_KEY,EVENT_NAME,
    validateRegistry,load,currentRegistry,isAdmin,createDraft,updateDraft,publish,clearLocalCache,
    _readLkg:readLkg,_writeLkg:writeLkg,_readPublished:readPublished
  });
});
