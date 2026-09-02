(function(){
  'use strict';
  if(!window.PTCGStorage||typeof window.PTCGStorage.update!=='function')return;

  const aliases=new Map([
    ['excelsior!','Excelsior! Games'],
    ['e!','Excelsior! Games']
  ]);

  function key(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ')}

  window.PTCGStorage.update(state=>{
    if(!Array.isArray(state.favouriteOrganisers)||!state.favouriteOrganisers.length)return state;
    let changed=false;
    state.favouriteOrganisers=state.favouriteOrganisers.map(row=>{
      const current=typeof row==='string'?row:(row&&row.name)||(row&&row.organiser)||'';
      const canonical=aliases.get(key(current));
      if(!canonical)return row;
      changed=true;
      if(typeof row==='string')return {organiserKey:'organiser:excelsior! games',name:canonical,source:null,savedAt:new Date().toISOString()};
      return {...row,organiserKey:'organiser:excelsior! games',name:canonical,organiser:canonical};
    });
    if(changed){
      const seen=new Set();
      state.favouriteOrganisers=state.favouriteOrganisers.filter(row=>{
        const name=typeof row==='string'?row:(row&&row.name)||(row&&row.organiser)||'';
        const organiserKey=(row&&typeof row==='object'&&row.organiserKey)||`organiser:${key(name)}`;
        if(seen.has(organiserKey))return false;
        seen.add(organiserKey);return true;
      });
    }
    return state;
  });
})();