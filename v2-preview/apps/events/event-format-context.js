(() => {
  'use strict';
  const participationId=new URLSearchParams(location.search).get('participation');
  async function render(){
    await Promise.all([window.MetaRelease?.ready?.(),window.PTCGFormatRuntime?.ready?.()]);
    const row=window.PTCGStorage?.getParticipation?.(participationId),event=row?.eventSnapshot||{},format=window.PTCGFormatRuntime?.formatForEvent?.(event.startDate);
    if(!format)return;
    document.body.dataset.eventFormat=format.id;
    const target=document.getElementById('eventMeta');if(!target)return;
    const base=target.textContent.replace(/\s·\sFormat\s[^·]+$/,'');
    target.textContent=[base,`Format ${format.label}`].filter(Boolean).join(' · ');
  }
  window.addEventListener('ptcg:format-config',render);render();
})();
