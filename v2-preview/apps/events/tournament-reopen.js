(function(){
'use strict';
function rowFor(card){return window.PTCGStorage?.getParticipation?.(card?.dataset?.id)||null}
function reopen(row){if(!row)return;window.PTCGStorage.updateParticipation(row.id,current=>{const prior=current.completion?{...current.completion}:null;current.completion=null;current.archivedAt=null;current.attendanceStatus='attending';current.tournamentDay={...(current.tournamentDay||{}),finishedAt:null,reopenedAt:new Date().toISOString(),reopenDraft:prior};return current})}
function enhance(){document.querySelectorAll('#mtList .tournament-card').forEach(card=>{if(card.querySelector('[data-reopen]'))return;const row=rowFor(card);if(!row||( !row.completion && !row.archivedAt))return;const menu=card.querySelector('.tournament-menu');if(!menu)return;const button=document.createElement('button');button.type='button';button.dataset.reopen='';button.textContent='Reopen tournament';button.addEventListener('click',()=>{reopen(row);document.querySelector('#mtFilters [data-filter="upcoming"]')?.click()});menu.prepend(button)})}
function bind(){const host=document.getElementById('myTournamentsPanel');if(host)new MutationObserver(enhance).observe(host,{childList:true,subtree:true});window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,20));setTimeout(enhance,100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
