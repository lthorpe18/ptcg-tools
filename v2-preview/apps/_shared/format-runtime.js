(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(null,require('./format-calendar-store.js'),require('./format-resolver.js'));
  else root.PTCGFormatRuntime=factory(root,root.PTCGFormatCalendar,root.PTCGFormat);
})(typeof globalThis!=='undefined'?globalThis:this,function(root,calendarDefault,formatDefault){
  'use strict';
  const EVENT_NAME='ptcg:format-runtime-updated';
  let active=null,pending=null,generation=0;

  const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const dateOnly=value=>{const text=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(Date.parse(text+'T00:00:00Z'))?text:null};
  function localToday(){const date=new Date(),pad=value=>String(value).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
  function dependencies(options={}){
    const calendar=options.calendar||calendarDefault||root?.PTCGFormatCalendar;
    const format=options.format||formatDefault||root?.PTCGFormat;
    if(!calendar?.load)throw new Error('Shared format calendar store is unavailable');
    if(!format?.create)throw new Error('Shared format resolver is unavailable');
    return {calendar,format};
  }
  function emit(state){
    if(!root?.dispatchEvent||typeof root.CustomEvent!=='function')return;
    root.dispatchEvent(new root.CustomEvent(EVENT_NAME,{detail:{source:state.source,status:state.status,versionNumber:state.versionNumber,publishedAt:state.publishedAt,registryRevision:state.registryRevision}}));
  }
  function effectiveDate(registry,context,date,environment){
    const day=dateOnly(date);if(!registry||!context||!day)return null;
    const ids=new Set(context.addedSetIds||[]),dates=[];
    for(const set of registry.sets||[]){
      const fact=set?.legality?.[environment],value=dateOnly(fact?.value);
      if(ids.has(set.id)&&fact?.status==='confirmed'&&value&&value<=day)dates.push(value);
    }
    const rotation=dateOnly(context.rotation?.effectiveDate);
    if(rotation&&rotation<=day)dates.push(rotation);
    return dates.sort().at(-1)||null;
  }
  function build(result,format){
    const resolver=format.create(result.registry);
    return {source:result.source,status:result.status||'loaded',versionNumber:result.versionNumber??result.version_number??null,publishedAt:result.publishedAt||result.published_at||null,
      registryRevision:result.registry?.revision||resolver.revision||null,registry:copy(result.registry),resolver,remoteError:result.remoteError||null};
  }
  async function refresh(options={}){
    if(pending&&!options.force)return pending;
    const run=++generation,{calendar,format}=dependencies(options);
    pending=(async()=>{
      const result=await calendar.load({
        ...(options.client!==undefined?{client:options.client}:{}),
        ...(options.storage!==undefined?{storage:options.storage}:{}),
        ...(options.fetch!==undefined?{fetch:options.fetch}:{}),
        ...(options.fallbackUrl!==undefined?{fallbackUrl:options.fallbackUrl}:{}),
        format
      });
      const state=build(result,format);
      if(run===generation){active=state;emit(state)}
      return state;
    })().finally(()=>{if(run===generation)pending=null});
    return pending;
  }
  function ready(options={}){return active&&!options.force?Promise.resolve(active):refresh(options)}
  function snapshot(){return active?{...active,registry:copy(active.registry)}:null}
  function resolver(){return active?.resolver||null}
  function currentFormat(date,environment){
    const day=dateOnly(date),env=environment==='irl'?'irl':environment==='online'?'online':null;
    if(!day||!env||!active?.resolver)return null;
    const result=active.resolver.resolve(day),context=result?.environments?.[env]?.formatContext;
    if(context?.status!=='known')return null;
    return {...copy(context),environment:env,effectiveDate:effectiveDate(active.registry,context,day,env),registryRevision:result.registryRevision||active.registryRevision};
  }
  function currentFormats(date){return {online:currentFormat(date,'online'),irl:currentFormat(date,'irl')}}
  function resolveEvent(event){return active?.resolver?.resolveEvent?.(event)||null}
  function resolveCardLegality(card,event){return active?.resolver?.resolveCardLegality?.(card,event)||null}
  function revision(){return active?.registryRevision||null}

  if(root?.addEventListener){
    const calendar=calendarDefault||root.PTCGFormatCalendar;
    if(calendar?.EVENT_NAME)root.addEventListener(calendar.EVENT_NAME,()=>refresh({force:true}).catch(()=>{}));
    root.addEventListener('storage',event=>{if(calendar?.LKG_KEY&&event.key===calendar.LKG_KEY)refresh({force:true}).catch(()=>{})});
  }

  return {EVENT_NAME,ready,refresh,snapshot,resolver,currentFormat,currentFormats,resolveEvent,resolveCardLegality,revision,today:localToday};
});