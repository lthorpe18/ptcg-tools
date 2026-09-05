(function(){
'use strict';
const today=()=>new Date().toISOString().slice(0,10);
function rowFor(card){return window.PTCGStorage?.getParticipation?.(card?.dataset?.id)||null}
function date(row){return String(row?.eventSnapshot?.startDate||'').slice(0,10)}
function reopen(row){if(!row)return;window.PTCGStorage.updateParticipation(row.id,current=>{const prior=current.completion?{...current.completion}:null;current.completion=null;current.archivedAt=null;current.attendanceStatus='attending';current.tournamentDay={...(current.tournamentDay||{}),finishedAt:null,reopenedAt:new Date().toISOString(),reopenDraft:prior};return current})}
function routeAfterReopen(row){const d=date(row);if(d>today())document.querySelector('#mtFilters [data-filter="upcoming"]')?.click();else if(d===today())document.querySelector('#mtFilters [data-filter="current"]')?.click();else document.querySelector('#mtFilters [data-filter="incomplete"]')?.click()}
function enhance(){document.querySelectorAll('#mtList .tournament-card').forEach(card=>{if(card.querySelector('[data-reopen]'))return;const row=rowFor(card);if(!row||(!row.completion&&!row.archivedAt))return;const menu=card.querySelector('.tournament-menu');if(!menu)return;const button=document.createElement('button');button.type='button';button.dataset.reopen='';button.textContent='Reopen tournament';button.addEventListener('click',()=>{reopen(row);setTimeout(()=>routeAfterReopen(window.PTCGStorage.getParticipation(row.id)),0)});menu.prepend(button)})}
function applyEntryRoute(){if(new URLSearchParams(location.search).get('view')==='tournaments')setTimeout(()=>document.getElementById('myTournamentsTab')?.click(),0)}
function bind(){const host=document.getElementById('myTournamentsPanel');if(host)new MutationObserver(()=>setTimeout(enhance,0)).observe(host,{childList:true,subtree:true});window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,30));setTimeout(enhance,100);applyEntryRoute()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();