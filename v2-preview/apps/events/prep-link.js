(function(){
'use strict';
const ACRONYMS=new Set(['TCG','CCG','LGS','UK','US','USA','EU','GB','Q1','Q2','Q3','Q4']);
const LEGACY_ORGANISER_ALIASES=new Map([
  ['excelsior!','Excelsior! Games'],
  ['e!','Excelsior! Games']
]);
function organiserKey(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ')}
function migrateLegacyOrganisers(){
  if(!window.PTCGStorage||typeof window.PTCGStorage.update!=='function')return;
  window.PTCGStorage.update(state=>{
    if(!Array.isArray(state.favouriteOrganisers)||!state.favouriteOrganisers.length)return state;
    let changed=false;
    state.favouriteOrganisers=state.favouriteOrganisers.map(row=>{
      const current=typeof row==='string'?row:(row&&row.name)||(row&&row.organiser)||'';
      const canonical=LEGACY_ORGANISER_ALIASES.get(organiserKey(current));
      if(!canonical)return row;
      changed=true;
      if(typeof row==='string')return {organiserKey:'organiser:excelsior! games',name:canonical,source:null,savedAt:new Date().toISOString()};
      return {...row,organiserKey:'organiser:excelsior! games',name:canonical,organiser:canonical};
    });
    if(changed){
      const seen=new Set();
      state.favouriteOrganisers=state.favouriteOrganisers.filter(row=>{
        const current=typeof row==='string'?row:(row&&row.name)||(row&&row.organiser)||'';
        const key=(row&&typeof row==='object'&&row.organiserKey)||`organiser:${organiserKey(current)}`;
        if(seen.has(key))return false;
        seen.add(key);return true;
      });
    }
    return state;
  });
}
function titleWord(word){
  const raw=String(word||'');if(!raw)return raw;
  const upper=raw.toUpperCase();if(ACRONYMS.has(upper))return upper;
  return raw.toLowerCase().replace(/(^|[-'’])([a-z])/g,(m,prefix,ch)=>prefix+ch.toUpperCase());
}
function displayName(value){return String(value||'').split(/(\s+)/).map(part=>/^\s+$/.test(part)?part:titleWord(part)).join('')}
function normaliseOrganiserLabels(){
  document.querySelectorAll('.event-organiser,.saved-venue-card strong').forEach(node=>{
    const next=displayName(node.textContent);if(next&&next!==node.textContent)node.textContent=next;
  });
}
function enhance(){
  normaliseOrganiserLabels();
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
    link.textContent='Prep';
    const more=actions.querySelector('.more-button');actions.insertBefore(link,more||null);
    actions.classList.add('has-prep');
  });
}
migrateLegacyOrganisers();
const target=document.getElementById('eventList');
if(target)new MutationObserver(enhance).observe(target,{childList:true,subtree:true,characterData:true});
const organisers=document.getElementById('yourVenuesList');
if(organisers)new MutationObserver(normaliseOrganiserLabels).observe(organisers,{childList:true,subtree:true,characterData:true});
window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();