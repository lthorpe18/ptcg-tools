(function(){
  'use strict';

  function navigate(href){
    if(!href)return;
    const anchor=document.createElement('a');
    anchor.href=href;
    anchor.hidden=true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function bindCard(card){
    if(!card||card.dataset.homeNavigationBound==='1')return;
    card.dataset.homeNavigationBound='1';
    const go=()=>navigate(card.dataset.homeHref);
    card.addEventListener('click',event=>{
      if(event.target.closest('a,button,input,select,textarea,label,fieldset'))return;
      go();
    });
    card.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      if(event.target.closest('a,button,input,select,textarea,label,fieldset'))return;
      event.preventDefault();
      go();
    });
  }

  function safeDate(snapshot){
    const date=snapshot?.startDate||snapshot?.date;
    if(!date)return null;
    const time=snapshot?.startTime&&/^\d{2}:\d{2}/.test(snapshot.startTime)?snapshot.startTime.slice(0,8):'12:00:00';
    const parsed=new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime())?null:parsed;
  }

  function nextParticipation(){
    const state=window.PTCGStorage?.load?.()||{};
    const now=Date.now(),day=86400000;
    return (state.eventParticipations||[])
      .filter(row=>row&&row.attendanceStatus==='attending'&&!row.completion)
      .map(row=>({row,date:safeDate(row.eventSnapshot)}))
      .filter(item=>item.date&&item.date.getTime()>=now-day)
      .sort((a,b)=>a.date-b.date)[0]?.row||null;
  }

  function updateEventPreviewRoute(){
    const preview=document.getElementById('competePreview');
    if(!preview)return;
    const participation=nextParticipation();
    const href=participation?.id
      ?`./apps/events/tournament-day.html?participation=${encodeURIComponent(participation.id)}`
      :'./apps/events/?view=tournaments';
    if(preview.getAttribute('href')!==href)preview.setAttribute('href',href);
  }

  document.querySelectorAll('[data-home-href]').forEach(bindCard);
  updateEventPreviewRoute();
  window.addEventListener('storage',updateEventPreviewRoute);
  window.addEventListener('ptcg:local-change',updateEventPreviewRoute);

  const preview=document.getElementById('competePreview');
  if(preview)new MutationObserver(updateEventPreviewRoute).observe(preview,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
})();
