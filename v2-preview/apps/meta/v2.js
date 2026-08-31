(function(){
  'use strict';
  const toggle=document.getElementById('metaFiltersToggle');
  const controls=document.querySelector('.global-controls');
  const summary=document.getElementById('metaFilterSummary');
  if(toggle&&controls){
    controls.classList.add('meta-collapsed');
    toggle.addEventListener('click',()=>{
      const collapsed=controls.classList.toggle('meta-collapsed');
      toggle.setAttribute('aria-expanded',String(!collapsed));
    });
  }
  function updateSummary(){
    if(!summary)return;
    const format=document.getElementById('format');
    const days=document.getElementById('days');
    const players=document.getElementById('minPlayers');
    const f=format&&format.options[format.selectedIndex]?format.options[format.selectedIndex].text.replace(/\s*\(.*/, ''):'Standard';
    const d=days&&days.options[days.selectedIndex]?days.options[days.selectedIndex].text:'All in format';
    summary.textContent=`${f} · ${d} · ${players?players.value:'50'}+`;
  }
  ['format','days','minPlayers'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('change',updateSummary)});
  const apply=document.getElementById('apply');if(apply)apply.addEventListener('click',()=>{updateSummary();if(window.innerWidth<=720&&controls)controls.classList.add('meta-collapsed')});
  updateSummary();
})();
