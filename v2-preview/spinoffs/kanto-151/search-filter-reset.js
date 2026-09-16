(function(){
  'use strict';

  const grid=document.getElementById('pokedex-grid');
  const setFilter=document.getElementById('filter-set');
  const illustrator=document.getElementById('filter-illustrator');
  const rarity=document.getElementById('filter-rarity');
  const regulation=document.getElementById('filter-regulation');
  const standard=document.getElementById('filter-standard');
  const panel=document.getElementById('filters-panel');
  const toggle=document.getElementById('filters-toggle');

  function resetFilters(){
    if(setFilter)setFilter.value='';
    if(illustrator)illustrator.value='';
    if(rarity){
      rarity.innerHTML='<option value="">Any rarity</option>';
      rarity.value='';
    }
    if(regulation)regulation.value='';
    if(standard)standard.checked=false;
    if(panel)panel.hidden=true;
    if(toggle){
      toggle.setAttribute('aria-expanded','false');
      toggle.textContent='Filters ▾';
    }
  }

  grid?.addEventListener('click',event=>{
    if(event.target.closest?.('[data-open-picker]'))resetFilters();
  },true);
})();
