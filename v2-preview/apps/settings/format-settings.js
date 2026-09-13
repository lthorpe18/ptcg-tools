(() => {
  'use strict';

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const DATE_CONVENTION='calendar-day-inclusive';
  let publishedRow=null;
  let workingRegistry=null;
  let isAdmin=false;
  let saving=false;

  function localDay(){
    const d=new Date();
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1,'0')}-${pad(d.getDate(),'0')}`;
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
    const cleanValue=value===''||value==null?null:value;
    if(!forceNew&&existing&&existing.status===status&&sameValue(existing.value,cleanValue))return clone(existing);
    const next={value:cleanValue,status,sources:status==='unknown'||status==='announced'?[]:[source]};
    if(isDate)next.convention=DATE_CONVENTION;
    return next;
  }

  function dateFact(existing,value,source,blankStatus='unknown',forceNew=false){
    const clean=String(value||'').trim();
    return fact(existing,clean?'confirmed':blankStatus,clean||null,source,true,forceNew);
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
    const version=publishedRow?.version_number?`Published v${publishedRow.version_number}`:'Published';
    const source=publishedRow?.source==='lkg'?'Last-known-good cache':publishedRow?.source==='fallback'?'Checked-in fallback':'Shared calendar';
    el.innerHTML=`<div class="format-summary-grid"><span><small>Status</small><b>${esc(version)}</b></span><span><small>Online</small><b>${esc(context.online)}</b></span><span><small>IRL</small><b>${esc(context.irl)}</b></span></div><details class="format-summary-meta"><summary>Calendar details</summary><p>${esc(source)} · revision ${esc(workingRegistry.revision||'—')}</p></details>`;
  }

  function setCard(set,index){
    const release=set.release||{};
    const online=set.legality?.online||{};
    const irl=set.legality?.irl||{};
    const rotation=set.rotation||null;
    const rotationMarks=Array.isArray(rotation?.regulationMarks)?rotation.regulationMarks.join(', '):'';
    const rotationLabel=rotationMarks?`Rotation · ${rotationMarks}`:'Rotation';
    return `<article class="format-set-card app-card" data-format-set data-set-index="${index}">
      <div class="format-set-toolbar"><span class="settings-kicker">Set ${index+1}</span><button type="button" class="format-remove" data-remove-set>Remove</button></div>
      <div class="format-set-identity">
        <label class="format-set-code"><span>Code</span><input data-set-id value="${esc(set.id||'')}" placeholder="30C" autocapitalize="characters"></label>
        <label><span>Name</span><input data-set-name value="${esc(set.name||'')}" placeholder="Set name"></label>
      </div>
      <div class="format-date-fields">
        <label class="format-date-control"><span>Release</span><input data-release-date type="date" value="${esc(release.value||'')}" aria-label="Release date" title="Tap to edit release date"></label>
        <label class="format-date-control"><span>Online</span><input data-online-date type="date" value="${esc(online.value||'')}" aria-label="Online legality date" title="Tap to edit Online legality date"></label>
        <label class="format-date-control"><span>IRL</span><input data-irl-date type="date" value="${esc(irl.value||'')}" aria-label="IRL legality date" title="Tap to edit IRL legality date"></label>
      </div>
      <details class="format-rotation">
        <summary>${esc(rotationLabel)}</summary>
        <p class="format-rotation-note">Card-level rotation: each printing is checked against these legal regulation marks.</p>
        <label class="format-check"><input type="checkbox" data-rotation-enabled${rotation?' checked':''}><span>This set's legality date changes the legal regulation marks</span></label>
        <div class="format-fields two">
          <label><span>Legal marks after rotation</span><input data-rotation-marks value="${esc(rotationMarks)}" placeholder="e.g. I, J, K"></label>
          <label><span>Earliest set label</span><input data-rotation-earliest value="${esc(rotation?.earliestSet||'')}" autocapitalize="characters" placeholder="Optional"></label>
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
      renderSets();renderSummary();renderActions();
    }));
    list.querySelectorAll('input').forEach(input=>{input.disabled=!isAdmin||saving;});
    list.querySelectorAll('[data-remove-set]').forEach(button=>{button.hidden=!isAdmin;button.disabled=saving;});
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
      const releaseDate=row.querySelector('[data-release-date]')?.value||'';
      const onlineDate=row.querySelector('[data-online-date]')?.value||'';
      const irlDate=row.querySelector('[data-irl-date]')?.value||'';
      const enabled=!!row.querySelector('[data-rotation-enabled]')?.checked;
      let rotation=null;
      if(enabled){
        const legal=splitMarks(row.querySelector('[data-rotation-marks]')?.value);
        const earliest=String(row.querySelector('[data-rotation-earliest]')?.value||'').trim().toUpperCase();
        if(!legal.length)throw new Error(`${id}: legal regulation marks are required for a rotation.`);
        if(!legal.every(mark=>/^[A-Z]$/.test(mark)))throw new Error(`${id}: regulation marks must be single letters.`);
        rotation={lowestMark:legal[0],regulationMarks:legal};
        if(earliest)rotation.earliestSet=earliest;
      }
      return {
        id,name,
        release:dateFact(original?.release,releaseDate,source,'announced',forceNew),
        marks:{value:null,status:'unknown',sources:[]},
        legality:{
          online:dateFact(original?.legality?.online,onlineDate,source,'unknown',forceNew),
          irl:dateFact(original?.legality?.irl,irlDate,source,'unknown',forceNew)
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
    if(!next.sets.some(set=>set.rotation))unknowns.push('Next rotation date and legal regulation marks');
    const last=next.sets[next.sets.length-1];
    if(last)unknowns.push(`Set releases after ${last.id}`);
    next.unknowns=[...new Set(unknowns)];
    window.PTCGFormatCalendar.validateRegistry(next,window.PTCGFormat);
    return {registry:next,note};
  }

  function renderActions(){
    const admin=$('formatAdminControls');
    const access=$('formatAccessMessage');
    const save=$('saveFormatCalendar');
    const add=$('addFormatSet');
    if(admin)admin.hidden=!isAdmin;
    if(access){
      access.textContent=isAdmin?'Maintainer access · shared data':'Shared data · read only';
      access.classList.toggle('is-admin',isAdmin);
    }
    if(save){save.disabled=!isAdmin||saving;save.textContent=saving?'Saving…':'Save changes';}
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
      renderSummary();renderSets();renderActions();
      setMessage('');
    }catch(error){
      setMessage(error?.message||'Could not load the shared format calendar.',true);
      renderActions();
    }
  }

  async function saveChanges(){
    if(!isAdmin||saving)return;
    saving=true;renderActions();setMessage('Saving…');
    try{
      const {registry,note}=collectRegistry();
      const draft=await window.PTCGFormatCalendar.createDraft(registry,note);
      const row=await window.PTCGFormatCalendar.publish(draft.id);
      publishedRow={source:'shared',...row};
      workingRegistry=clone(row.registry);
      renderSummary();renderSets();
      setMessage('Saved.');
    }catch(error){setMessage(error?.message||'Could not save the shared format calendar.',true);}
    finally{saving=false;renderActions();}
  }

  $('addFormatSet')?.addEventListener('click',()=>{
    if(!isAdmin||saving||!workingRegistry)return;
    workingRegistry.sets=Array.isArray(workingRegistry.sets)?workingRegistry.sets:[];
    workingRegistry.sets.push(blankSet());
    renderSets();renderSummary();renderActions();
    document.querySelector('[data-format-set]:last-child [data-set-id]')?.focus();
  });
  $('saveFormatCalendar')?.addEventListener('click',saveChanges);
  window.addEventListener('ptcg:auth-change',load);
  window.addEventListener('ptcg:format-calendar-updated',()=>{if(!saving)load();});
  load();
})();