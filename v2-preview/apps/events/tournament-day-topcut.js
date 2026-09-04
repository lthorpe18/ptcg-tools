(function(){
'use strict';
const STAGES=[['asym-top-16','Asym Top 16'],['asym-top-8','Asym Top 8'],['asym-top-4','Asym Top 4'],['top-16','Top 16'],['top-8','Top 8'],['top-4','Top 4'],['finals','Finals']];
let selected=null,originalPut=null;
const $=id=>document.getElementById(id);
function inject(){const form=$('roundForm');if(!form||$('roundStagePicker'))return;const block=document.createElement('div');block.id='roundStagePicker';block.className='field-block round-stage-picker';block.innerHTML=`<span>Stage <small>optional</small></span><div class="round-stage-buttons"><button type="button" data-stage="">Swiss</button>${STAGES.map(([value,label])=>`<button type="button" data-stage="${value}">${label}</button>`).join('')}</div>`;const more=form.querySelector('.round-more');(more||form.lastElementChild)?.insertAdjacentElement('beforebegin',block);block.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>setStage(button.dataset.stage||null)));setStage(null)}
function setStage(stage){selected=stage||null;document.querySelectorAll('#roundStagePicker [data-stage]').forEach(button=>button.classList.toggle('active',(button.dataset.stage||null)===selected))}
function stageFromMatch(id){const match=id?window.PTCGMatchStore?.get?.(id):null;setStage(match?.roundStage||null)}
function wrapStore(){if(!window.PTCGMatchStore?.put||originalPut)return;originalPut=window.PTCGMatchStore.put.bind(window.PTCGMatchStore);window.PTCGMatchStore.put=input=>originalPut({...input,roundStage:selected||null})}
function bind(){inject();wrapStore();$('addRound')?.addEventListener('click',()=>setTimeout(()=>setStage(null),0));document.addEventListener('click',event=>{const row=event.target.closest?.('#roundHistory [data-match-id]');if(row)setTimeout(()=>stageFromMatch(row.dataset.matchId),0)});$('deleteRound')?.addEventListener('click',()=>setStage(null))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
