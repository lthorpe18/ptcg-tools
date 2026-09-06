const clamp=(min,max,value)=>Math.min(max,Math.max(min,Number(value)||0));

export function normaliseField(rows){
  const map=new Map();
  for(const row of rows||[]){
    const name=String(row?.name||'').trim();
    const share=Math.max(0,Number(row?.share||0));
    if(!name||name==='Other'||name==='Unknown'||!share)continue;
    map.set(name,(map.get(name)||0)+share);
  }
  const total=[...map.values()].reduce((sum,value)=>sum+value,0);
  return total?[...map.entries()].map(([name,value])=>({name,share:value/total})).sort((a,b)=>b.share-a.share||a.name.localeCompare(b.name)):[];
}

export function weightsForDays(days,formula){
  const start=clamp(0,1,formula?.irlStartWeight??0.70);
  const floor=clamp(0,start,formula?.irlFloor??0.30);
  const decay=clamp(0,1,formula?.irlDecayPerDay??0.02);
  const irl=clamp(floor,start,start-decay*Math.max(0,Number(days)||0));
  return {irl,online:1-irl};
}

export function weightsForObservation(observation,formula){
  if(!observation?.irlInput?.length||['rotation-online-only','online-only'].includes(observation.transitionState))return{irl:0,online:1};
  const normal=weightsForDays(observation.daysSinceMajor??0,formula);
  if(observation.transitionState==='previous-format-prior'){
    const cap=clamp(0,1,observation.previousFormatCap??0.25);
    const irl=Math.min(normal.irl,cap);
    return{irl,online:1-irl};
  }
  return normal;
}

export function blendFields(irlRows,onlineRows,weights){
  const irl=normaliseField(irlRows),online=normaliseField(onlineRows);
  if(!online.length)return[];
  if(!irl.length||!weights?.irl)return online.map(row=>({...row}));
  const map=new Map();
  for(const row of irl)map.set(row.name,(map.get(row.name)||0)+row.share*weights.irl);
  for(const row of online)map.set(row.name,(map.get(row.name)||0)+row.share*weights.online);
  return normaliseField([...map.entries()].map(([name,share])=>({name,share})));
}

export function distributionAccuracy(predictedRows,actualRows){
  const predicted=new Map(normaliseField(predictedRows).map(row=>[row.name,row.share]));
  const actual=new Map(normaliseField(actualRows).map(row=>[row.name,row.share]));
  const names=new Set([...predicted.keys(),...actual.keys()]);
  const absoluteError=[...names].reduce((sum,name)=>sum+Math.abs((predicted.get(name)||0)-(actual.get(name)||0)),0);
  return clamp(0,1,1-0.5*absoluteError);
}

export function varianceDiagnostics(predictedRows,actualRows,{threshold=0.01,limit=5}={}){
  const predicted=new Map(normaliseField(predictedRows).map(row=>[row.name,row.share]));
  const actual=new Map(normaliseField(actualRows).map(row=>[row.name,row.share]));
  const rows=[...new Set([...predicted.keys(),...actual.keys()])].map(name=>{
    const predictedShare=predicted.get(name)||0,actualShare=actual.get(name)||0,variance=actualShare-predictedShare;
    return{name,predictedShare,actualShare,variance,absoluteVariance:Math.abs(variance)};
  }).filter(row=>row.predictedShare>=threshold||row.actualShare>=threshold);
  const successes=[...rows].sort((a,b)=>a.absoluteVariance-b.absoluteVariance||Math.max(b.actualShare,b.predictedShare)-Math.max(a.actualShare,a.predictedShare)||a.name.localeCompare(b.name));
  const misses=[...rows].sort((a,b)=>b.absoluteVariance-a.absoluteVariance||Math.max(b.actualShare,b.predictedShare)-Math.max(a.actualShare,a.predictedShare)||a.name.localeCompare(b.name));
  return{threshold,successes:successes.slice(0,limit),misses:misses.slice(0,limit),allSuccesses:successes,allMisses:misses};
}

export function evaluateObservation(observation,formula){
  const weights=weightsForObservation(observation,formula);
  const predicted=blendFields(observation.irlInput||[],observation.onlineInput||[],weights);
  return{weights,predicted,accuracy:distributionAccuracy(predicted,observation.actualField||[])};
}

export function meanAccuracy(observations,formula){
  const complete=(observations||[]).filter(row=>Array.isArray(row.actualField)&&row.actualField.length&&Array.isArray(row.onlineInput)&&row.onlineInput.length);
  if(!complete.length)return null;
  return complete.reduce((sum,row)=>sum+evaluateObservation(row,formula).accuracy,0)/complete.length;
}

function validFormula(formula){
  const start=clamp(0,1,formula.irlStartWeight),floor=clamp(0,1,formula.irlFloor),decay=clamp(0,1,formula.irlDecayPerDay);
  return{...formula,irlStartWeight:start,irlFloor:Math.min(floor,start),irlDecayPerDay:decay};
}

function betterCandidate(observations,current,candidate){
  const formula=validFormula(candidate),accuracy=meanAccuracy(observations,formula);
  if(accuracy==null)return current;
  if(!current||accuracy>current.accuracy+1e-12)return{formula,accuracy};
  if(Math.abs(accuracy-current.accuracy)<=1e-12){
    const complexity=formula.irlStartWeight+formula.irlFloor+formula.irlDecayPerDay;
    const currentComplexity=current.formula.irlStartWeight+current.formula.irlFloor+current.formula.irlDecayPerDay;
    if(complexity<currentComplexity)return{formula,accuracy};
  }
  return current;
}

export function fitBestFormula(observations,liveFormula){
  const complete=(observations||[]).filter(row=>Array.isArray(row.actualField)&&row.actualField.length&&Array.isArray(row.onlineInput)&&row.onlineInput.length);
  const live=validFormula(liveFormula||{irlStartWeight:0.70,irlDecayPerDay:0.02,irlFloor:0.30});
  const liveAccuracy=meanAccuracy(complete,live);
  if(!complete.length)return{dataPoints:0,liveFormula:live,liveAccuracy:null,bestFormula:live,bestAccuracy:null,improvement:null};
  let best=null;
  const coarse=[];
  for(let start=0;start<=1.0001;start+=0.05){
    for(let floor=0;floor<=start+0.0001;floor+=0.05){
      for(let decay=0;decay<=1.0001;decay+=0.05)coarse.push({irlStartWeight:start,irlFloor:floor,irlDecayPerDay:decay});
    }
  }
  coarse.push(live);
  for(const candidate of coarse)best=betterCandidate(complete,best,candidate);
  for(const step of [0.01,0.002,0.0005]){
    let improved=true;
    while(improved){
      improved=false;
      const base=best;
      for(const key of ['irlStartWeight','irlFloor','irlDecayPerDay']){
        for(const direction of [-1,1]){
          const candidate={...base.formula,[key]:base.formula[key]+direction*step};
          const next=betterCandidate(complete,best,candidate);
          if(next!==best){best=next;improved=true;}
        }
      }
    }
  }
  return{
    dataPoints:complete.length,
    liveFormula:live,
    liveAccuracy,
    bestFormula:best.formula,
    bestAccuracy:best.accuracy,
    improvement:best.accuracy-liveAccuracy,
  };
}
