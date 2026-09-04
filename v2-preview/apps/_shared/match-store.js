(function(global){
  'use strict';

  const MODEL_VERSION=3;
  const RESULTS=new Set(['win','loss','draw','unknown']);
  const SOURCES=new Set(['ptcgl','irl']);
  const ROUND_STAGES=new Set(['asym-top-16','asym-top-8','asym-top-4','top-16','top-8','top-4','finals']);

  function uid(prefix='match'){
    return global.crypto&&global.crypto.randomUUID
      ? global.crypto.randomUUID()
      : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  }
  function iso(value,fallback=new Date().toISOString()){const parsed=Date.parse(value||'');return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback}
  function text(value){return String(value==null?'':value).trim()}
  function nullable(value){const out=text(value);return out||null}
  function normaliseGame(input,index,matchResult){const source=input&&typeof input==='object'?input:{};const result=RESULTS.has(source.result)?source.result:(RESULTS.has(matchResult)?matchResult:'unknown');return {id:nullable(source.id)||uid('game'),number:Number.isFinite(Number(source.number))?Math.max(1,Number(source.number)):index+1,result,wentFirst:typeof source.wentFirst==='boolean'?source.wentFirst:null,notes:text(source.notes)}}
  function normalise(input){
    const source=input&&typeof input==='object'?input:{};const now=new Date().toISOString();const result=RESULTS.has(source.result)?source.result:'unknown';
    const games=(Array.isArray(source.games)&&source.games.length?source.games:[{result,wentFirst:source.wentFirst}]).map((game,index)=>normaliseGame(game,index,result));
    const imported=source.import&&typeof source.import==='object'?{kind:source.import.kind==='ptcgl-battle-log'?'ptcgl-battle-log':nullable(source.import.kind),hash:nullable(source.import.hash),parserVersion:Number(source.import.parserVersion)||1,rawLog:text(source.import.rawLog),importedAt:iso(source.import.importedAt,now)}:null;
    return {modelVersion:MODEL_VERSION,id:nullable(source.id)||uid(),source:SOURCES.has(source.source)?source.source:'irl',playedAt:iso(source.playedAt,now),result,deckId:nullable(source.deckId),deckVersionId:nullable(source.deckVersionId),listHash:nullable(source.listHash),deckNameSnapshot:nullable(source.deckNameSnapshot),deckVersionLabelSnapshot:nullable(source.deckVersionLabelSnapshot),opponentArchetype:nullable(source.opponentArchetype),format:nullable(source.format),wentFirst:typeof source.wentFirst==='boolean'?source.wentFirst:null,participationId:nullable(source.participationId),eventId:nullable(source.eventId),eventName:nullable(source.eventName),roundLabel:nullable(source.roundLabel),roundStage:ROUND_STAGES.has(source.roundStage)?source.roundStage:null,notes:text(source.notes),games,import:imported,createdAt:iso(source.createdAt,now),updatedAt:iso(source.updatedAt,now)};
  }
  function state(){if(!global.PTCGStorage)throw new Error('Shared storage unavailable');return global.PTCGStorage.load()}
  function all(){return (state().matches||[]).map(normalise).sort((a,b)=>Date.parse(b.playedAt)-Date.parse(a.playedAt))}
  function get(id){return all().find(match=>match.id===id)||null}
  function findByImportHash(hash){const target=nullable(hash);return target?all().find(match=>match.import&&match.import.hash===target)||null:null}
  function put(input){const record=normalise(input);const duplicate=record.import?.hash?findByImportHash(record.import.hash):null;if(duplicate&&duplicate.id!==record.id)return {match:duplicate,duplicate:true};global.PTCGStorage.update(current=>{const rows=Array.isArray(current.matches)?current.matches:[];const index=rows.findIndex(match=>match&&match.id===record.id);const existing=index>=0?normalise(rows[index]):null;record.createdAt=existing?.createdAt||record.createdAt;record.updatedAt=new Date().toISOString();if(index>=0)rows[index]=record;else rows.push(record);current.matches=rows;return current});return {match:record,duplicate:false}}
  function remove(id){global.PTCGStorage.update(current=>{current.matches=(current.matches||[]).filter(match=>match&&match.id!==id);return current})}
  function gamesFromScore(wins,losses,draws,wentFirst=null){const results=[];for(const [result,count] of [['win',wins],['loss',losses],['draw',draws]]){const total=Math.max(0,Math.min(9,Number(count)||0));for(let index=0;index<total;index++)results.push({result,wentFirst:index===0?wentFirst:null})}return results}
  function score(match){return (match?.games||[]).reduce((out,game)=>{if(game.result==='win')out.wins++;else if(game.result==='loss')out.losses++;else if(game.result==='draw')out.draws++;return out},{wins:0,losses:0,draws:0})}
  function stats(rows=all()){const out={wins:0,losses:0,draws:0,total:0,gameWins:0,gameLosses:0,gameDraws:0,winRate:0};for(const match of rows){if(match.result==='win')out.wins++;else if(match.result==='loss')out.losses++;else if(match.result==='draw')out.draws++;else continue;out.total++;const games=score(match);out.gameWins+=games.wins;out.gameLosses+=games.losses;out.gameDraws+=games.draws}out.winRate=out.total?out.wins/out.total:0;return out}
  function subscribe(callback){if(typeof callback!=='function')return ()=>{};const onStorage=event=>{if(event.key===global.PTCGStorage?.ROOT_KEY)callback()};global.addEventListener('storage',onStorage);return ()=>global.removeEventListener('storage',onStorage)}
  global.PTCGMatchStore={MODEL_VERSION,ROUND_STAGES,all,get,findByImportHash,put,remove,normalise,gamesFromScore,score,stats,subscribe};
})(window);
