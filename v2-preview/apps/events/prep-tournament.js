(function(){
'use strict';
const participationId=new URLSearchParams(location.search).get('participation');
function enhance(){
  const host=document.getElementById('playtestPlan')?.parentElement;if(!host||host.querySelector('[data-tournament-day-link]')||!window.PTCGStorage)return;
  const participation=window.PTCGStorage.getParticipation(participationId);if(!participation||participation.completion||(!participation.plannedDeckRef&&!participation.tournamentDay))return;
  const link=document.createElement('a');link.dataset.tournamentDayLink='true';link.className='primary-button full-button';link.href=`./tournament-day.html?build=20260903-2128&participation=${encodeURIComponent(participation.id)}`;link.textContent=participation.tournamentDay?'Open Tournament Day':'Start Tournament';host.appendChild(link);
}
window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();