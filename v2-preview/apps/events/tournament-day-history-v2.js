(function(){
'use strict';
const $=id=>document.getElementById(id);
const ID_MARKER='[ID]';
const participationId=new URLSearchParams(location.search).get('participation');
let pokemonIndexPromise=null;
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
function resultLetter(result){return result==='win'?'W':result==='loss'?'L':result==='draw'?'D':'?'}
function gameSequence(match){if(String(match?.notes||'').trim().startsWith(ID_MARKER))return 'ID';return (match?.games||[]).map(game=>game.result==='win'?'W':game.result==='loss'?'L':game.result==='draw'?'T':'').filter(Boolean).join(' ')}
function participation(){return window.PTCGStorage?.getParticipation?.(participationId)||null}
function usedArchetype(){const row=participation();return row?.usedDeckRef?.archetypeSnapshot||row?.plannedDeckRef?.archetypeSnapshot||''}
async function index(){if(!pokemonIndexPromise)pokemonIndexPromise=window.PTCGSprites?.getIndex?.().catch(()=>[])||Promise.resolve([]);return pokemonIndexPromise}
function normalise(text){return String(text||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\b(ex|vstar|vmax|v|gx)\b/g,' ').replace(/\s+/g,' ').trim()}
function namesFromArchetype(archetype,rows){const source=` ${normalise(archetype)} `;if(!source.trim())return[];const found=[];for(const item of rows){const phrase=String(item.name||'').toLowerCase().replace(/-/g,' ');if(!phrase||phrase.length<3)continue;if(source.includes(` ${phrase} `))found.push({name:item.name,length:phrase.length})}return found.sort((a,b)=>b.length-a.length).filter((item,index,arr)=>arr.findIndex(other=>other.name===item.name)===index).slice(0,2).map(item=>item.name)}
async function spriteImgs(archetype,container){if(!container||!window.PTCGSprites)return;const rows=await index();const names=namesFromArchetype(archetype,rows);if(!names.length)return;const sprites=await Promise.all(names.map(name=>window.PTCGSprites.fetchSprite(name).catch(()=>null)));const html=sprites.filter(Boolean).map(item=>item.spriteUrl?`<img src="${esc(item.spriteUrl)}" alt="" loading="lazy">`:'').join('');if(html)container.innerHTML=html}
function enhanceRow(button){if(button.dataset.richHistory==='true')return;const match=window.PTCGMatchStore?.get?.(button.dataset.matchId);if(!match)return;button.dataset.richHistory='true';button.classList.add('rich-round-row');const isId=String(match.notes||'').trim().startsWith(ID_MARKER);const opponent=match.opponentArchetype||'Opponent';const sequence=gameSequence(match)||resultLetter(match.result);button.innerHTML=`<span class="rich-round-number">${esc((match.roundLabel||'R').replace(/^Round\s*/i,'R'))}</span><span class="rich-matchup"><span class="rich-sprites rich-sprites-self" aria-hidden="true"></span><span class="rich-vs">vs</span><span class="rich-sprites rich-sprites-opponent" aria-hidden="true"></span><span class="rich-opponent">${esc(opponent)}</span></span><span class="rich-round-result ${esc(match.result)}${isId?' id':''}"><strong>${isId?'ID':resultLetter(match.result)}</strong><small>${esc(sequence)}</small></span>`;spriteImgs(usedArchetype(),button.querySelector('.rich-sprites-self'));spriteImgs(opponent,button.querySelector('.rich-sprites-opponent'))}
function enhance(){document.querySelectorAll('#roundHistory [data-match-id]').forEach(enhanceRow)}
const target=$('roundHistory');if(target)new MutationObserver(()=>setTimeout(enhance,0)).observe(target,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,80),{once:true});else setTimeout(enhance,80);
window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,40));
})();