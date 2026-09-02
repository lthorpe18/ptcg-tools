(function(){
'use strict';
const participationId=new URLSearchParams(location.search).get('participation');
const button=document.getElementById('playtestPlan');
if(!button||!participationId)return;

function current(){return window.PTCGStorage?.getParticipation?.(participationId)||null}
function refresh(){const participation=current(),planned=participation?.plannedDeckRef;button.hidden=!(planned?.deckId&&planned?.deckVersionId&&planned?.listHash)}
async function launch(){
  const participation=current(),planned=participation?.plannedDeckRef;if(!planned)return;
  button.disabled=true;
  try{
    await window.PTCGPlaytestLaunch.open({
      deckId:planned.deckId,
      deckVersionId:planned.deckVersionId,
      listHash:planned.listHash,
      source:'event-prep',
      returnUrl:`../events/prep.html?participation=${encodeURIComponent(participationId)}`,
      targetUrl:'../decklists/playtest.html'
    });
  }catch(error){button.disabled=false;alert(error.message||'Playtest could not start')}
}
button.addEventListener('click',launch);
document.addEventListener('click',event=>{if(event.target.closest('#savePlan,#changePlan'))setTimeout(refresh,0)});
window.addEventListener('ptcg:local-change',refresh);
refresh();
})();
