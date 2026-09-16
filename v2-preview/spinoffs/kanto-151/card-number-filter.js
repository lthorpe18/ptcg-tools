(function(){
  'use strict';

  const catalog=window.PTCGCardCatalog;
  if(!catalog?.searchAdvanced)return;

  const originalSearchAdvanced=catalog.searchAdvanced.bind(catalog);

  function normaliseCardNumber(value){
    const text=String(value||'').trim().replace(/^#/,'').toUpperCase();
    if(/^\d+$/.test(text))return text.replace(/^0+(?=\d)/,'');
    return text;
  }

  catalog.searchAdvanced=async function(params={}){
    const rows=await originalSearchAdvanced(params);
    const expected=normaliseCardNumber(document.getElementById('filter-card-number')?.value);
    if(!expected)return rows;
    return (rows||[]).filter(card=>normaliseCardNumber(card?.localId)===expected);
  };

  window.PTCGKantoCardNumber={normaliseCardNumber};
})();
