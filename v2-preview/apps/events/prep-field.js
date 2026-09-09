/* Event Prep consumes the shared calendar and predictions; it never forecasts a future weight. */
(() => {
  'use strict';
  const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const standardTypes=new Set(['League Cup','League Challenge','Regional','Special Championship','International','World Championships']);
  function eventContext(event,resolver) {
    const date=event?.startDate || event?.date || null;
    const base={date,environment:'irl',format:null,status:'unknown'};
    if(event?.environment==='online' || event?.scope==='online')return {...base,reason:'Online discovery does not use Event Prep.'};
    const declared=String(event?.format || '').trim(),explicitPool=/^[A-Z0-9]+-[A-Z0-9+]+$/.test(declared);
    if(declared && !/^standard(?:\s|$)/i.test(declared) && !explicitPool)return {...base,reason:'No Standard prediction is available for this event format.'};
    if(!declared && !standardTypes.has(event?.type))return {...base,reason:'This event’s Standard format is not established.'};
    if(!resolver)return {...base,reason:'Event format calendar is unavailable.'};
    const resolved=resolver.resolveEvent({date,environment:'irl'}),context=resolved.formatContext;
    if(!resolved.date || context?.status!=='known')return {...base,reason:resolved.reason || 'The legal format for this event date is unknown.'};
    if(explicitPool && declared!==context.label)return {...base,reason:'The recorded event format conflicts with its date. Review the event details.'};
    return {...base,status:'known',format:context.label,registryRevision:resolved.registryRevision,formatContext:copy(context),basis:'Maintained IRL schedule'};
  }
  function automatic(context,predictions) {
    const prediction=context.status==='known'?predictions.find(row=>row.format===context.format):null;
    const available=!!prediction?.available;
    return {name:'Suggested Blended',format:context.format,field:available?window.PTCGMetaField.selectCoverage(prediction.rows,.9).rows:[],
      baselineField:[],available,reason:context.status!=='known'?context.reason:prediction?.reason || (!prediction?'Prediction evidence for the event format is unavailable.':''),
      provenance:{...copy(prediction || {}),rows:undefined,targetFormat:context.format,source:'blend',coverage:.9,eventContext:copy(context)},selection:'automatic'};
  }
  function compatibility(record,context) {
    const format=record?.provenance?.targetFormat || record?.format || null;
    const mismatch=!format || !context.format || context.status!=='known' || format!==context.format;
    return {mismatch,fieldFormat:format,eventFormat:context.format,eventDate:context.date,
      reason:!format?'The selected field has no recorded format.':!context.format?'The event’s legal format is unknown.':mismatch?`Field ${format} differs from event ${context.format}.`:''};
  }
  function overrideValid(record,context) {
    const check=compatibility(record,context),override=record?.override;
    return !check.mismatch || !!(override?.confirmedAt && override.fieldFormat===check.fieldFormat && override.eventFormat===check.eventFormat && override.eventDate===check.eventDate);
  }
  function snapshot(record,rows,baseline,context,{override,note='',edited=false}={}) {
    const field=window.SavedMetas.cleanField(rows);
    if(!field.length)throw new Error('Choose an available field first.');
    const check=compatibility(record,context);
    if(check.mismatch && !(override ?? overrideValid(record,context)))throw new Error('Confirm the field-format override first.');
    const capturedAt=new Date().toISOString();
    const retainedOverride=check.mismatch?{...check,confirmedAt:overrideValid(record,context)?record?.override?.confirmedAt || capturedAt:capturedAt}:null;
    return {schemaVersion:2,name:record.name,expectedFieldId:record.id || record.expectedFieldId || null,
      field,baselineField:window.SavedMetas.cleanField(baseline),format:check.fieldFormat,provenance:{...copy(record.provenance),eventContext:copy(context),override:retainedOverride,edited:edited || !!record.provenance?.edited},
      selection:record.selection || 'saved',note:note || null,capturedAt,eventContext:copy(context),override:retainedOverride};
  }
  function lock(participation,selected,deck,version,context) {
    if(participation.prep?.lockedSnapshot)return copy(participation.prep.lockedSnapshot);
    const ref=participation.plannedDeckRef;
    if(!deck || !version || !ref || ref.deckId!==deck.id || ref.deckVersionId!==version.id || !version.listHash || ref.listHash!==version.listHash)throw new Error('Plan an exact saved DeckVersion before locking.');
    if(!selected?.field?.length || !overrideValid(selected,context))throw new Error('Set a field and confirm any format override before locking.');
    return copy({schemaVersion:1,lockedAt:new Date().toISOString(),eventContext:context,fieldSnapshot:selected,plannedDeckRef:ref,
      deckSnapshot:{id:deck.id,name:deck.name,archetype:deck.archetype,version}});
  }
  async function loadResolver() {
    const key='ptcg:event-prep:calendar';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try {
      const response=await fetch('../../../data/formats/maintained-calendar.json',{cache:'no-cache',signal:controller.signal});
      if(!response.ok)throw new Error('Calendar unavailable');
      const registry=await response.json(),resolver=window.PTCGFormat.create(registry);
      try{localStorage.setItem(key,JSON.stringify(registry))}catch{}
      return resolver;
    } catch {
      try{return window.PTCGFormat.create(JSON.parse(localStorage.getItem(key)))}catch{return null}
    } finally{clearTimeout(timer)}
  }
  window.EventPrepField={eventContext,automatic,compatibility,overrideValid,snapshot,lock,loadResolver};
})();
