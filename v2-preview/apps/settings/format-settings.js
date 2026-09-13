(() => {
  'use strict';

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const DATE_CONVENTION='calendar-day-inclusive';
  let publishedRow=null;
  let workingRegistry=null;
  let draftRow=null;
  let isAdmin=false;
  let saving=false;

  function localDay(){
    const d=new Date();
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function revisionStamp(){
    return `settings-calendar-${new Date().toISOString().replace(/[-:.]/g,'').replace(/\.\d{3}Z$/,'Z')}`;
  }

  function sourceKey(){
    return `settings-${new Date().toISOString().replace(/[-:.]/g,'').replace(/\.\d{3}Z$/,'Z')}`;
  }

  function sameValue(a,b){return JSON.stringify(a??null)===JSON.stringify(b??null)}

  function splitMarks(value){
    return [...new Set(String(value||'').toUpperCase().split(/[\s,;/]+/).map(v=>v.trim()).filter(Boolean))].sort();
  }

  function fact(existing,status,value,source,isDate=false,forceNew=false){
    const cleanStatus=status||'unknown';
    const cleanValue=value===''||value==null?null:value;
    if(!forceNew&&existing&&existing.status===cleanStatus&&sameValue(existing.value,cleanValue))return clone(existing);
    const next={value:cleanValue,status:cleanStatus,sources:cleanStatus==='unknown'?[]:[source]};
    if(isDate)next.convention=DATE_CONVENTION;
    return next;
  }

  function blankSet(){
    return {
      id:'',name:'',
      release:{value:null,status:'announced',sources:[],convention:DATE_CONVENTION},
      marks:{value:null,status:'unknown',sources:[]},
      legality:{
        online:{value:null,status:'unknown',sources:[],convention:DATE_CONVENTION},
        irl:{value:null,status:'unknown',sources:[],convention:DATE_CONVENTION}
      },
      rotation:null
    };
  }

  function statusOptions(value,allowAnnounced=true){
    const values=allowAnnounced?['unknown','announced','confirmed']:['unknown','confirmed'];
    return values.map(v=>`<option value="${v}"${v===value?' selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('');
  }

  function factStatus(fallback,value){return value?.status||fallback}

  function currentContext(registry){
    try{
      const result=window.PTCGFormat.create(registry).resolve(localDay());
      const online=result?.environments?.online?.formatContext?.label||'Unknown';
      const irl=result?.environments?.irl?.formatContext?.label||'Unknown';
      return {online,irl};
    }catch{return {online:'Unknown',irl:'Unknown'}}
  }

  function renderSummary(){
    const el=$('formatCalendarSummary');
    if(!el)return;
    if(!workingRegistry){el.innerHTML='<div class="settings-empty">Loading shared format calendar…</div>';return;}
    const context=currentContext(workingRegistry);
    const version=draftRow?`Draft v${draftRow.version_number||'—'}`:publishedRow?.version_number?`Published v${publishedRow.version_number}`:'Published';
    const source=publishedRow?.source==='lkg'?'Last-known-good cache':publishedRow?.source==='fallback'?'Checked-in fallback':'Shared calendar';
    el.innerHTML=`<div class="format-summary-grid"><span><small>Status</small><b>${esc(version)}</b></span><span><small>Online now</small><b>${esc(context.online)}</b></span><span><small>IRL now</small><b>${esc(context.irl)}</b></span></div><p>${esc(source)} · revision ${esc(workingRegistry.revision||'—')}</p>`;
  }

  function setCard(set,index){
    const release=set.release||{};
    const online=set.legality?.online||{};
    const irl=set.legality?.irl||{};
    const marks=Array.isArray(set.marks?.value)?set.marks.value.join(', '):'';
    const rotation=set.rotation||null;
    return `<article class="format-set-card app-card" data-format-set data-set-index="${index}">
      <div class="format-set-head"><div><span class="settings-kicker">Set ${index+1}</span><strong>${esc(set.id||'New set')}</strong></div><button type="button" class="format-remove" data-remove-set>Remove</button></div>
      <div class="format-fields two">
        <label><span>Set code</span><input data-set-id value="${esc(set.id||'')}" placeholder="e.g. 30C" autocapitalize="characters"></label>
        <label><span>Set name</span><input data-set-name value="${esc(set.name||'')}" placeholder="Set name"></label>
      </div>
      <div class="format-fact-row">
        <label><span>Physical release</span><select data-release-status>${statusOptions(factStatus('announced',release),true)}</select></label>
        <label><span>Date</span><input data-release-date type="date" value="${esc(release.value||'')}"></label>
      </div>
      <div class="format-fact-row">
        <label><span>Online legality</span><select data-online-status>${statusOptions(factStatus('unknown',online),true)}</select></label>
        <label><span>Date</span><input data-online-date type="date" value="${esc(online.value||'')}"></label>
      </div>
      <div class="format-fact-row">
        <label><span>IRL legality</span><select data-irl-status>${statusOptions(factStatus('unknown',irl),true)}</select></label>
        <label><span>Date</span><input data-irl-date type="date" value="${esc(irl.value||'')}"></label>
      </div>
      <div class="format-fact-row">
        <label><span>Regulation marks</span><select data-marks-status>${statusOptions(factStatus('unknown',set.marks),false)}</select></label>
        <label><span>Marks</span><input data-marks value="${esc(marks)}" placeholder="e.g. J, K"></label>
      </div>
      <details class="format-rotation"${rotation?' open':''}>
        <summary>Rotation metadata${rotation?' · configured':''}</summary>
        <label class="format-check"><input type="checkbox" data-rotation-enabled${rotation?' checked':''}><span>This set changes the rotation boundary</span></label>
        <div class="format-fields three">
          <label><span>Lowest mark</span><input data-rotation-lowest value="${esc(rotation?.lowestMark||'')}" maxlength="1" autocapitalize="characters" placeholder="J"></label>
          <label><span>Legal marks</span><input data-rotation-marks value="${esc(Array.isArray(rotation?.regulationMarks)?rotation.regulationMarks.join(', '):'')}" placeholder="J, K"></label>
          <label><span>Earliest set</span><input data-rotation-earliest value="${esc(rotation?.earliestSet||'')}" autocapitalize="characters" placeholder="Optional"></label>
        </div>
      </details>
    </article>`;
  }

  function renderSets(){
    const list=$('formatSetList');
    if(!list)return;
    if(!workingRegistry){list.innerHTML='';return;}
    const sets=Array.isArray(workingRegistry.sets)?workingRegistry.sets:[];
    list.innerHTML=sets.length?sets.map(setCard).join(''):'<div class="settings-empty">No maintained additions yet.</div>';
    list.querySelectorAll('[data-remove-set]').forEach(button=>button.addEventListener('click',()=>{
      if(!isAdmin||saving)return;
      const card=button.closest('[data-format-set]');
      const index=Number(card?.dataset.setIndex);
      if(!Number.isInteger(index))return;
      workingRegistry.sets.splice(index,1);
      draftRow=null;
      renderSets();renderSummary();renderActions();
    }));
    list.querySelectorAll('input,select').forEach(input=>{input.disabled=!isAdmin||saving;});
    list.querySelectorAll('[data-remove-set]').forEach(button=>{button.hidden=!isAdmin;button.disabled=saving;});
  }

  function validateStatusDate(status,date,label){
    if(status==='confirmed'&&!date)throw new Error(`${label}: confirmed status needs a date.`);
    if(status!=='confirmed'&&date)throw new Error(`${label}: choose Confirmed to save a date.`);
  }

  function collectRegistry(){
    if(!workingRegistry)throw new Error('Format calendar is not loaded.');
    const next=clone(workingRegistry);
    const source=sourceKey();
    const note=$('formatPublishNotes')?.value.trim()||'Maintained through Settings → Formats & Sets.';
    next.sources=next.sources||{};
    next.sources[source]={title:`PTCG Tools Settings maintenance ${localDay()}`,authority:'user-maintained',note};
    const existingById=new Map((workingRegistry.sets||[]).map(set=>[set.id,set]));
    const rows=[...document.querySelectorAll('[data-format-set]')];
    const seen=new Set();
    next.sets=rows.map((row,index)=>{
      const id=String(row.querySelector('[data-set-id]')?.value||'').trim().toUpperCase();
      const name=String(row.querySelector('[data-set-name]')?.value||'').trim();
      if(!id)throw new Error(`Set ${index+1}: set code is required.`);
      if(seen.has(id))throw new Error(`Set code ${id} is duplicated.`);
      seen.add(id);
      if(!name)throw new Error(`${id}: set name is required.`);
      const original=existingById.get(id)||null;
      const forceNew=!original;
      const releaseStatus=row.querySelector('[data-release-status]')?.value||'unknown';
      const releaseDate=row.querySelector('[data-release-date]')?.value||'';
      const onlineStatus=row.querySelector('[data-online-status]')?.value||'unknown';
      const onlineDate=row.querySelector('[data-online-date]')?.value||'';
      const irlStatus=row.querySelector('[data-irl-status]')?.value||'unknown';
      const irlDate=row.querySelector('[data-irl-date]')?.value||'';
      const marksStatus=row.querySelector('[data-marks-status]')?.value||'unknown';
      const marks=splitMarks(row.querySelector('[data-marks]')?.value);
      validateStatusDate(releaseStatus,releaseDate,`${id} physical release`);
      validateStatusDate(onlineStatus,onlineDate,`${id} Online legality`);
      validateStatusDate(irlStatus,irlDate,`${id} IRL legality`);
      if(marksStatus==='confirmed'&&!marks.length)throw new Error(`${id}: confirmed regulation marks need at least one mark.`);
      if(marksStatus!=='confirmed'&&marks.length)throw new Error(`${id}: choose Confirmed to save regulation marks.`);
      const enabled=!!row.querySelector('[data-rotation-enabled]')?.checked;
      let rotation=null;
      if(enabled){
        const lowest=String(row.querySelector('[data-rotation-lowest]')?.value||'').trim().toUpperCase();
        const legal=splitMarks(row.querySelector('[data-rotation-marks]')?.value);
        const earliest=String(row.querySelector('[data-rotation-earliest]')?.value||'').trim().toUpperCase();
        if(!/^[A-Z]$/.test(lowest))throw new Error(`${id}: rotation lowest mark must be one letter.`);
        if(!legal.length)throw new Error(`${id}: rotation legal marks are required.`);
        if(!legal.includes(lowest))legal.push(lowest);
        legal.sort();
        rotation={lowestMark:lowest,regulationMarks:legal};
        if(earliest)rotation.earliestSet=earliest;
      }
      return {
        id,name,
        release:fact(original?.release,releaseStatus,releaseDate||null,source,true,forceNew),
        marks:fact(original?.marks,marksStatus,marksStatus==='confirmed'?marks:null,source,false,forceNew),
        legality:{
          online:fact(original?.legality?.online,onlineStatus,onlineDate||null,source,true,forceNew),
          irl:fact(original?.legality?.irl,irlStatus,irlDate||null,source,true,forceNew)
        },
        rotation
      };
    });
    next.revision=revisionStamp();
    const unknowns=[];
    for(const set of next.sets){
      if(set.release.status!=='confirmed')unknowns.push(`${set.id} release date`);
      if(set.legality.online.status!=='confirmed')unknowns.push(`${set.id} Online legality date`);
      if(set.legality.irl.status!=='confirmed')unknowns.push(`${set.id} IRL legality date`);
    }
    if(!next.sets.some(set=>set.rotation))unknowns.push('Next rotation date and lower boundary');
    const last=next.sets[next.sets.length-1];
    if(last)unknowns.push(`Set releases after ${last.id}`);
    next.unknowns=[...new Set(unknowns)];
    window.PTCGFormatCalendar.validateRegistry(next,window.PTCGFormat);
    return {registry:next,note};
  }

  function renderActions(){
    const admin=$('formatAdminControls');
    const access=$('formatAccessMessage');
    const save=$('saveFormatDraft');
    const publish=$('publishFormatDraft');
    const add=$('addFormatSet');
    if(admin)admin.hidden=!isAdmin;
    if(access){
      access.textContent=isAdmin?'Authorised maintainer · edits are shared application data.':'Published format data is shared across PTCG Tools. Only authorised maintainers can edit it.';
      access.classList.toggle('is-admin',isAdmin);
    }
    if(save){save.disabled=!isAdmin||saving;save.textContent=saving?'Saving…':draftRow?'Update draft':'Save draft';}
    if(publish)publish.disabled=!isAdmin||saving||!draftRow;
    if(add)add.disabled=!isAdmin||saving;
  }

  function setMessage(text,error=false){
    const el=$('formatCalendarMessage');
    if(!el)return;
    el.textContent=text||'';
    el.classList.toggle('is-error',!!error);
  }

  async function load(){
    const api=window.PTCGFormatCalendar;
    if(!api||!window.PTCGFormat){setMessage('Format maintenance is unavailable because the shared format engine did not load.',true);return;}
    setMessage('Loading shared format calendar…');
    try{
      publishedRow=await api.load();
      workingRegistry=clone(publishedRow.registry);
      isAdmin=await api.isAdmin().catch(()=>false);
      draftRow=null;
      renderSummary();renderSets();renderActions();
      setMessage(isAdmin?'Published calendar loaded. Make changes, save a draft, then publish when ready.':'Published calendar loaded.');
    }catch(error){
      setMessage(error?.message||'Could not load the shared format calendar.',true);
      renderActions();
    }
  }

  async function saveDraft(){
    if(!isAdmin||saving)return;
    saving=true;renderActions();setMessage('Validating and saving draft…');
    try{
      const {registry,note}=collectRegistry();
      draftRow=draftRow
        ?await window.PTCGFormatCalendar.updateDraft(draftRow.id,registry,note)
        :await window.PTCGFormatCalendar.createDraft(registry,note);
      workingRegistry=clone(draftRow.registry);
      renderSummary();renderSets();
      setMessage(`Draft v${draftRow.version_number||'—'} saved. Published data is unchanged until you publish.`);
    }catch(error){setMessage(error?.message||'Could not save the format calendar draft.',true);}
    finally{saving=false;renderActions();}
  }

  async function publishDraft(){
    if(!isAdmin||saving||!draftRow)return;
    saving=true;renderActions();setMessage('Publishing shared format calendar…');
    try{
      const row=await window.PTCGFormatCalendar.publish(draftRow.id);
      publishedRow={source:'shared',...row};
      workingRegistry=clone(row.registry);
      draftRow=null;
      renderSummary();renderSets();
      setMessage(`Published v${row.version_number||'—'}. New sessions can now load this shared calendar.`);
    }catch(error){setMessage(error?.message||'Could not publish the format calendar.',true);}
    finally{saving=false;renderActions();}
  }

  $('addFormatSet')?.addEventListener('click',()=>{
    if(!isAdmin||saving||!workingRegistry)return;
    workingRegistry.sets=Array.isArray(workingRegistry.sets)?workingRegistry.sets:[];
    workingRegistry.sets.push(blankSet());
    draftRow=null;
    renderSets();renderSummary();renderActions();
    document.querySelector('[data-format-set]:last-child [data-set-id]')?.focus();
  });
  $('saveFormatDraft')?.addEventListener('click',saveDraft);
  $('publishFormatDraft')?.addEventListener('click',publishDraft);
  window.addEventListener('ptcg:auth-change',load);
  window.addEventListener('ptcg:format-calendar-updated',()=>{if(!saving)load();});
  load();
})();