(() => {
  'use strict';
  const participationId=new URLSearchParams(location.search).get('participation');
  let mismatch=null;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function applyGuard(){
    if(!mismatch)return;
    document.body.dataset.eventFormatMismatch='1';
    for(const id of ['looksRight','toggleAdjust','saveEventField','savedFieldSelect']){
      const el=$(id);if(el)el.disabled=true;
    }
    $('adjustPanel')?.classList.add('hidden');
    if($('fieldStatus'))$('fieldStatus').textContent='Unavailable';
    if($('fieldEvidence'))$('fieldEvidence').textContent=`Current Meta evidence is ${mismatch.prepared}; this event uses ${mismatch.event}.`;
    if($('fieldSummary'))$('fieldSummary').innerHTML=`<div class="prep-empty">Suggested field unavailable — waiting for Meta evidence prepared for ${esc(mismatch.event)}.</div>`;
    if($('candidateEvidence'))$('candidateEvidence').textContent=`Recommendations unavailable until matchup evidence for ${mismatch.event} is prepared.`;
    if($('candidateRows'))$('candidateRows').innerHTML='<div class="prep-empty">No deck recommendation is being calculated from a different format.</div>';
  }

  async function check(){
    const runtime=window.PTCGFormatRuntime;
    const release=window.MetaRelease;
    if(!runtime||!release)return;
    await Promise.all([runtime.ready?.(),release.ready?.()]);
    const participation=window.PTCGStorage?.getParticipation?.(participationId);
    const eventDate=participation?.eventSnapshot?.startDate;
    const eventFormat=runtime.formatForEvent?.(eventDate);
    const core=release.core?.();
    const prepared=release.manifest?.()?.format||core?.format||core?.online?.format||null;
    if(!eventFormat?.id||!prepared||eventFormat.id===prepared){mismatch=null;delete document.body.dataset.eventFormatMismatch;return}
    mismatch={event:eventFormat.id,prepared};
    applyGuard();
    const workspace=$('workspace');
    if(workspace&&!workspace.dataset.formatGuardObserved){
      workspace.dataset.formatGuardObserved='1';
      const observer=new MutationObserver(()=>queueMicrotask(applyGuard));
      observer.observe(workspace,{childList:true,subtree:true,characterData:true});
    }
  }

  window.addEventListener('ptcg:format-config',check);
  window.addEventListener('savedmetas:updated',applyGuard);
  check();
  setTimeout(check,0);
})();
