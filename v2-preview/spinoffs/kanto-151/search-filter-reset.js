(function(){
  'use strict';

  const grid=document.getElementById('pokedex-grid');
  const setFilter=document.getElementById('filter-set');
  const cardNumber=document.getElementById('filter-card-number');
  const illustrator=document.getElementById('filter-illustrator');
  const rarity=document.getElementById('filter-rarity');
  const regulation=document.getElementById('filter-regulation');
  const standard=document.getElementById('filter-standard');
  const panel=document.getElementById('filters-panel');
  const toggle=document.getElementById('filters-toggle');
  const searchForm=document.getElementById('search-form');
  const clearButton=document.getElementById('clear-filters');
  let cardNumberTimer=null;

  function resetFilters(){
    if(setFilter)setFilter.value='';
    if(cardNumber)cardNumber.value='';
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

  cardNumber?.addEventListener('input',()=>{
    clearTimeout(cardNumberTimer);
    cardNumberTimer=setTimeout(()=>searchForm?.requestSubmit(),260);
  });

  clearButton?.addEventListener('click',()=>{
    if(cardNumber)cardNumber.value='';
  },true);
})();
