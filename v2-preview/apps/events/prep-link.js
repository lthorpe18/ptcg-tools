(function(){
'use strict';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function enhance(){
  document.querySelectorAll('.event-card').forEach(card=>{
    if(card.querySelector('[data-prep-link]'))return;
    const id=card.dataset.eventId;
    if(!id||!window.PTCGStorage)return;
    const participation=window.PTCGStorage.getParticipation(id);
    if(!participation||participation.attendanceStatus!=='attending')return;
    const actions=card.querySelector('.event-actions');if(!actions)return;
    const link=document.createElement('a');
    link.dataset.prepLink='true';
    link.className='primary-link prep-entry-link';
    link.href=`./prep.html?participation=${encodeURIComponent(participation.id)}`;
    link.textContent=participation.prep?'Continue Prep':'Prep';
    const more=actions.querySelector('.more-button');actions.insertBefore(link,more||null);
  });
}
const target=document.getElementById('eventList');
if(target)new MutationObserver(enhance).observe(target,{childList:true,subtree:true});
window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();