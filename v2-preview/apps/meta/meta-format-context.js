(() => {
  'use strict';
  const runtime=window.PTCGFormatRuntime,meta=window.MetaData;
  if(!runtime||!meta)return;

  const baseCurrent=meta.currentFormat?.bind(meta);
  const baseBlend=meta.blendEvidence?.bind(meta);
  let lastOnline=null;

  function currentDate(){return runtime.today?.()||new Date().toISOString().slice(0,10)}
  function runtimeFormats(){return runtime.currentFormats?.(currentDate())||{online:null,irl:null}}
  function currentFormat(environment){return runtime.currentFormat?.(currentDate(),environment)||baseCurrent?.(environment)||null}
  function blendEvidence(){
    const base=baseBlend?.()||{},formats=runtimeFormats();
    return {...base,currentFormats:{online:formats.online||base.currentFormats?.online||null,irl:formats.irl||base.currentFormats?.irl||null},calendarRevision:runtime.revision?.()||base.calendarRevision||null};
  }
  function notify(){
    const online=currentFormat('online')?.label||null;
    if(lastOnline&&online&&lastOnline!==online&&window.MetaBlendedField?.select)window.MetaBlendedField.select(online);
    lastOnline=online;
    window.dispatchEvent(new CustomEvent('meta:data-changed',{detail:{reason:'format-calendar',calendarRevision:runtime.revision?.()||null}}));
  }

  meta.currentFormat=currentFormat;
  meta.blendEvidence=blendEvidence;
  window.addEventListener(runtime.EVENT_NAME,notify);
  runtime.ready().then(()=>{if(!lastOnline)notify()}).catch(()=>{});
})();
