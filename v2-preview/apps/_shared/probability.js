(function(global){
'use strict';
function clampInt(value,min,max){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min}
function logChoose(n,k){if(k<0||k>n)return -Infinity;k=Math.min(k,n-k);let out=0;for(let i=1;i<=k;i++)out+=Math.log(n-k+i)-Math.log(i);return out}
function combinationRatio(successes,failures,draws,hits){if(hits<0||hits>successes||draws-hits<0||draws-hits>failures)return 0;return Math.exp(logChoose(successes,hits)+logChoose(failures,draws-hits)-logChoose(successes+failures,draws))}
function distribution({population=60,successes=1,draws=1}={}){const n=clampInt(population,0,1000),k=clampInt(successes,0,n),d=clampInt(draws,0,n),max=Math.min(k,d),rows=[];for(let hits=0;hits<=max;hits++)rows.push({hits,probability:combinationRatio(k,n-k,d,hits)});return rows}
function atLeast({population=60,successes=1,draws=1,minHits=1}={}){const rows=distribution({population,successes,draws});const min=clampInt(minHits,0,Math.min(successes,draws));return rows.reduce((sum,row)=>sum+(row.hits>=min?row.probability:0),0)}
function exactly({population=60,successes=1,draws=1,hits=0}={}){const rows=distribution({population,successes,draws});const row=rows.find(item=>item.hits===Number(hits));return row?row.probability:0}
function prized({copies=1,prizes=6,deckSize=60,minCopies=1}={}){return atLeast({population:deckSize,successes:copies,draws:prizes,minHits:minCopies})}
global.PTCGProbability={distribution,atLeast,exactly,prized};
})(window);
