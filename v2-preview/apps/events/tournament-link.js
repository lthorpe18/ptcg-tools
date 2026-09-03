(function(){
'use strict';
function enhance(){
  document.querySelectorAll('.event-card').forEach(card=>{
    if(card.querySelector('[data-tournament-link]'))return;
    const id=card.dataset.eventId;if(!id||!window.PTCGStorage)return;
    let participation=window.PTCGStorage.getParticipation(id);if(!participation)return;
    if(!participation.plannedDeckRef){participation=window.PTCGStorage.updateParticipation(participation.id,row=>{row.plannedDeckRef={};return row})}
    const active=!!participation.tournamentDay&&!participation.completion;
    const needsCompletion=(participation.phase==='needs-completion'||participation.attendanceStatus==='attended')&&!participation.completion;
    const canStart=participation.attendanceStatus==='attending'&&!participation.completion;
    if(!active&&!needsCompletion&&!canStart)return;
    const actions=card.querySelector('.event-actions');if(!actions)return;
    const link=document.createElement('a');link.dataset.tournamentLink='true';link.className='primary-link tournament-entry-link';link.href=`./tournament-day.html?build=20260903-2158&participation=${encodeURIComponent(participation.id)}`;link.textContent=active?'Tournament':needsCompletion?'Complete':'Start';
    const more=actions.querySelector('.more-button');actions.insertBefore(link,more||null);
  });
}
const target=document.getElementById('eventList');if(target)new MutationObserver(enhance).observe(target,{childList:true,subtree:true});
window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();