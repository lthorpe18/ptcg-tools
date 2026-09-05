(function(){
'use strict';
const $=id=>document.getElementById(id);
const pct=value=>`${(Math.max(0,Math.min(1,value))*100).toFixed(value<.01?2:1)}%`;
function showView(name,{writeHash=true}={}){
  const safe=['cut','tournament','odds'].includes(name)?name:'cut';
  document.querySelectorAll('[data-tool-view]').forEach(button=>button.classList.toggle('active',button.dataset.toolView===safe));
  ['cut','tournament','odds'].forEach(view=>$( `view-${view}`)?.classList.toggle('hidden',view!==safe));
  if(writeHash&&location.hash!==`#${safe}`)history.replaceState(null,'',`${location.pathname}${location.search}#${safe}`);
}
function showOdds(name){
  const safe=['draw','opening','prizes'].includes(name)?name:'draw';
  document.querySelectorAll('[data-odds-mode]').forEach(button=>button.classList.toggle('active',button.dataset.oddsMode===safe));
  ['draw','opening','prizes'].forEach(mode=>$( `odds-${mode}`)?.classList.toggle('hidden',mode!==safe));
}
function validInts(values){return values.every(([value,min=0])=>Number.isFinite(Number(value))&&Number(value)>=min)}
function result(id,headline,detail){const el=$(id);el.className='calc-result';el.innerHTML=`<strong class="headline-stat">${headline}</strong><span>${detail}</span>`}
function calcOuts(){const deck=Number($('outsDeck').value),outs=Number($('outsCount').value),draw=Number($('outsDraw').value);if(!validInts([[deck,1],[outs,0],[draw,1]])||outs>deck||draw>deck){result('outsResult','Check inputs','Outs and cards drawn cannot exceed the cards remaining.');return}const chance=window.PTCGProbability.atLeast({population:deck,successes:outs,draws:draw,minHits:1});result('outsResult',pct(chance),`${outs} live out${outs===1?'':'s'} in ${deck} cards, seeing ${draw} card${draw===1?'':'s'}. Chance of missing all outs: ${pct(1-chance)}.`)}
function calcOpening(){const deck=Number($('openingDeck').value),copies=Number($('openingCopies').value),hand=Number($('openingHand').value);if(!validInts([[deck,1],[copies,0],[hand,1]])||copies>deck||hand>deck){result('openingResult','Check inputs','Copies and opening hand size cannot exceed deck size.');return}const chance=window.PTCGProbability.atLeast({population:deck,successes:copies,draws:hand,minHits:1});result('openingResult',pct(chance),`Chance of opening at least one of ${copies} cop${copies===1?'y':'ies'} in a ${hand}-card hand from ${deck} cards. Exactly one: ${pct(window.PTCGProbability.exactly({population:deck,successes:copies,draws:hand,hits:1}))}.`)}
function calcPrizes(){const deck=Number($('prizeDeck').value),copies=Number($('prizeCopies').value),prizes=Number($('prizeCount').value),min=Number($('prizeMin').value),exact=Number($('prizeExact').value);if(!validInts([[deck,1],[copies,1],[prizes,1],[min,1],[exact,0]])||copies>deck||prizes>deck||min>copies||exact>copies){result('prizeResult','Check inputs','Copies/prizes must fit within deck size, and requested prized copies cannot exceed copies played.');return}const atLeast=window.PTCGProbability.atLeast({population:deck,successes:copies,draws:prizes,minHits:min});const exactly=window.PTCGProbability.exactly({population:deck,successes:copies,draws:prizes,hits:exact});result('prizeResult',pct(atLeast),`Chance at least ${min} of ${copies} cop${copies===1?'y is':'ies are'} in the ${prizes} prizes. Exactly ${exact} prized: ${pct(exactly)}. None prized: ${pct(window.PTCGProbability.exactly({population:deck,successes:copies,draws:prizes,hits:0}))}.`)}
document.querySelectorAll('[data-tool-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.toolView)));
document.querySelectorAll('[data-odds-mode]').forEach(button=>button.addEventListener('click',()=>showOdds(button.dataset.oddsMode)));
$('outsCalculate')?.addEventListener('click',calcOuts);$('openingCalculate')?.addEventListener('click',calcOpening);$('prizeCalculate')?.addEventListener('click',calcPrizes);
window.addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(['cut','tournament','odds'].includes(hash))showView(hash,{writeHash:false});else if(['draw','opening','prizes'].includes(hash)){showView('odds',{writeHash:false});showOdds(hash)}});
const initial=location.hash.slice(1);if(['draw','opening','prizes'].includes(initial)){showView('odds',{writeHash:false});showOdds(initial)}else showView(initial||'cut',{writeHash:false});
if(!document.querySelector('script[data-tournament-clock]')){const script=document.createElement('script');script.src='./tournament-clock.js?v=1';script.dataset.tournamentClock='1';document.head.appendChild(script)}
})();