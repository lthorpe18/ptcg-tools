import fs from 'node:fs/promises';
import path from 'node:path';
import { loadPublishedConfig, resolveCurrentFormats } from './lib/format-config.mjs';
import { normaliseField, weightsForDays, blendFields, distributionAccuracy, varianceDiagnostics, fitBestFormula } from './lib/blended-model.mjs';

const root=process.cwd();
const EVENTS_FILE=path.join(root,'v2-preview','data','events.json');
const CORE_FILE=path.join(root,'v2-preview','data','meta','release','core.json');
const OUTPUT=path.join(root,'v2-preview','data','meta','blended-performance.json');
const DAY=86400000;

const CITY_TZ={
  'san francisco':'America/Los_Angeles','anaheim':'America/Los_Angeles','los angeles':'America/Los_Angeles','las vegas':'America/Los_Angeles','portland':'America/Los_Angeles','seattle':'America/Los_Angeles','vancouver':'America/Vancouver',
  'baltimore':'America/New_York','new york':'America/New_York','orlando':'America/New_York','atlanta':'America/New_York','charlotte':'America/New_York','cleveland':'America/New_York','detroit':'America/Detroit','toronto':'America/Toronto','montreal':'America/Toronto',
  'milwaukee':'America/Chicago','chicago':'America/Chicago','new orleans':'America/Chicago','dallas':'America/Chicago','fort worth':'America/Chicago','minneapolis':'America/Chicago','denver':'America/Denver','salt lake city':'America/Denver',
  'frankfurt':'Europe/Berlin','stuttgart':'Europe/Berlin','dortmund':'Europe/Berlin','bremen':'Europe/Berlin','bochum':'Europe/Berlin','berlin':'Europe/Berlin','london':'Europe/London','birmingham':'Europe/London','liverpool':'Europe/London','utrecht':'Europe/Amsterdam','lille':'Europe/Paris','paris':'Europe/Paris','bologna':'Europe/Rome','madrid':'Europe/Madrid','barcelona':'Europe/Madrid','stockholm':'Europe/Stockholm','helsinki':'Europe/Helsinki',
  'brisbane':'Australia/Brisbane','sydney':'Australia/Sydney','melbourne':'Australia/Melbourne','perth':'Australia/Perth','auckland':'Pacific/Auckland','tokyo':'Asia/Tokyo','osaka':'Asia/Tokyo','seoul':'Asia/Seoul','singapore':'Asia/Singapore','hong kong':'Asia/Hong_Kong','sao paulo':'America/Sao_Paulo','são paulo':'America/Sao_Paulo'
};
const COUNTRY_TZ={GB:'Europe/London',UK:'Europe/London',DE:'Europe/Berlin',FR:'Europe/Paris',IT:'Europe/Rome',ES:'Europe/Madrid',NL:'Europe/Amsterdam',SE:'Europe/Stockholm',FI:'Europe/Helsinki',JP:'Asia/Tokyo',KR:'Asia/Seoul',SG:'Asia/Singapore',NZ:'Pacific/Auckland',BR:'America/Sao_Paulo'};

async function readJson(file,fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}}
function isoWeekKey(value){const d=new Date(`${String(value).slice(0,10)}T12:00:00Z`),u=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())),day=u.getUTCDay()||7;u.setUTCDate(u.getUTCDate()+4-day);const start=new Date(Date.UTC(u.getUTCFullYear(),0,1)),week=Math.ceil((((u-start)/DAY)+1)/7);return `${u.getUTCFullYear()}-W${String(week).padStart(2,'0')}`}
function addDays(date,days){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function eventTimeZone(event){const explicit=event?.timeZone||event?.timezone;if(explicit)return explicit;const city=String(event?.city||'').trim().toLowerCase();if(CITY_TZ[city])return CITY_TZ[city];const country=String(event?.country||'').trim().toUpperCase();return COUNTRY_TZ[country]||'UTC'}
function localParts(date,timeZone){const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date);const get=type=>parts.find(part=>part.type===type)?.value;return{date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')||0)}}
function tzOffsetMinutes(timeZone,date){const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);const get=type=>Number(parts.find(part=>part.type===type)?.value||0);const represented=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));return Math.round((represented-date.getTime())/60000)}
function eventStartRank(event){const date=String(event.startDate||event.date||'').slice(0,10),tz=eventTimeZone(event),noon=new Date(`${date}T12:00:00Z`),offset=tzOffsetMinutes(tz,noon);return new Date(`${date}T09:00:00Z`).getTime()-offset*60000}
function majorEvents(events){return (events||[]).filter(event=>event?.scope==='major'&&event?.startDate).sort((a,b)=>eventStartRank(a)-eventStartRank(b))}
function majorGroups(events){const map=new Map();for(const event of majorEvents(events)){const key=isoWeekKey(event.startDate),rows=map.get(key)||[];rows.push(event);map.set(key,rows)}return [...map.entries()].map(([weekKey,rows])=>{rows.sort((a,b)=>eventStartRank(a)-eventStartRank(b));const earliest=rows[0],startDate=String(earliest.startDate).slice(0,10),endDate=rows.reduce((max,event)=>String(event.endDate||event.startDate).slice(0,10)>max?String(event.endDate||event.startDate).slice(0,10):max,startDate);return{weekKey,events:rows,startDate,endDate,timeZone:eventTimeZone(earliest)}}).sort((a,b)=>a.startDate.localeCompare(b.startDate))}
function latestWeekend(events){const valid=[...(events||[])].filter(event=>event?.date).sort((a,b)=>new Date(b.date)-new Date(a.date));if(!valid.length)return[];const key=isoWeekKey(valid[0].date);return valid.filter(event=>isoWeekKey(event.date)===key)}
function aggregateEvents(events){const rows=[];for(const event of events||[])for(const deck of event.decks||event.archetypes||[])rows.push({name:deck.name,share:Number(deck.entries||0)});return normaliseField(rows)}
function coreOnlineField(core){return normaliseField((core?.online?.scopes?.['since-major']?.decks||[]).map(deck=>({name:deck.name,share:Number(deck.share||0)})))}
function chooseIrlInput(core){const onlineFormat=core?.config?.onlineFormat?.id||core?.online?.format||core?.format,currentFormat=core?.irl?.format,current=latestWeekend(core?.irl?.events||[]);if(current.length&&currentFormat===onlineFormat)return{kind:'current-format-major',formatId:currentFormat,events:current};if(current.length&&currentFormat!==onlineFormat)return{kind:'previous-format-prior',formatId:currentFormat,events:current};const previous=core?.irl?.previous,prior=latestWeekend(previous?.events||[]);if(prior.length)return{kind:'previous-format-prior',formatId:previous?.format||null,events:prior};return{kind:'none',formatId:null,events:[]}}
function majorFinalDate(core,events){const cutoff=new Date(core?.online?.majorWeekend?.cutoff).getTime();if(Number.isFinite(cutoff))return new Date(cutoff-DAY).toISOString().slice(0,10);const latest=Math.max(...(events||[]).map(event=>new Date(event.endDate||event.date).getTime()).filter(Number.isFinite));return Number.isFinite(latest)?new Date(latest).toISOString().slice(0,10):null}
function currentPrediction(core,formula,now){const onlineInput=coreOnlineField(core);if(!onlineInput.length)return{available:false,reason:'No qualifying current-format Online events'};const candidate=chooseIrlInput(core),rotation=!!core?.config?.onlineFormat?.isRotationStart,finalDate=majorFinalDate(core,candidate.events),daysSinceMajor=finalDate?Math.max(0,Math.floor((new Date(`${localParts(now,'UTC').date}T12:00:00Z`)-new Date(`${finalDate}T12:00:00Z`))/DAY)):null;let transitionState='online-only',weights={irl:0,online:1};if(candidate.kind==='current-format-major'){transitionState='current-format-major';weights=weightsForDays(daysSinceMajor??0,formula)}else if(candidate.kind==='previous-format-prior'&&!rotation){transitionState='previous-format-prior';const normal=weightsForDays(daysSinceMajor??0,formula),irl=Math.min(normal.irl,Number(formula.previousFormatCap??0.25));weights={irl,online:1-irl}}else if(rotation){transitionState='rotation-online-only'}const irlInput=weights.irl?aggregateEvents(candidate.events):[];return{available:true,onlineInput,irlInput,weights,predictedField:blendFields(irlInput,onlineInput,weights),transitionState,daysSinceMajor,majorFinalDate:finalDate,irlFormat:candidate.formatId}}
function cleanDiagnostics(value){const map=row=>({name:row.name,predictedShare:row.predictedShare,actualShare:row.actualShare,variance:row.variance,absoluteVariance:row.absoluteVariance});return{threshold:value.threshold,successes:value.successes.map(map),misses:value.misses.map(map),allSuccesses:value.allSuccesses.map(map),allMisses:value.allMisses.map(map)}}

async function main(){
  const now=new Date(),[events,core,existing,config]=await Promise.all([readJson(EVENTS_FILE,{events:[]}),readJson(CORE_FILE,null),readJson(OUTPUT,{schemaVersion:1,snapshots:[]}),loadPublishedConfig()]);
  if(!core)throw new Error('Prepared Meta core is missing');
  const formats=resolveCurrentFormats(config,now),groups=majorGroups(events.events||events),snapshots=[...(existing?.snapshots||[])];
  const byKey=new Map(snapshots.map(row=>[row.key,row]));

  for(const group of groups){
    const key=`${group.weekKey}:${formats.online?.id||core.format}`;
    if(byKey.has(key))continue;
    const local=localParts(now,group.timeZone),dayBefore=addDays(group.startDate,-1);
    if(local.date!==dayBefore||local.hour<22)continue;
    const prediction=currentPrediction(core,config.liveFormula,now);
    if(!prediction.available){console.log(`Skipping ${key}: Blended unavailable (${prediction.reason})`);continue}
    const snapshot={
      key,weekKey:group.weekKey,formatId:formats.online?.id||core.format,majorNames:group.events.map(event=>event.name),scheduledMajorCount:group.events.length,
      startDate:group.startDate,endDate:group.endDate,timeZone:group.timeZone,capturedAt:now.toISOString(),formulaVersion:config.liveFormula.versionKey,formula:{...config.liveFormula},
      daysSinceMajor:prediction.daysSinceMajor,majorFinalDate:prediction.majorFinalDate,transitionState:prediction.transitionState,previousFormatCap:Number(config.liveFormula.previousFormatCap??0.25),
      weights:prediction.weights,onlineInput:prediction.onlineInput,irlInput:prediction.irlInput,predictedField:prediction.predictedField,irlFormat:prediction.irlFormat,
      actualField:null,actualPlayers:null,evaluatedAt:null,accuracy:null,diagnostics:null
    };
    snapshots.push(snapshot);byKey.set(key,snapshot);console.log(`Captured ${key}: ${(100*snapshot.weights.irl).toFixed(1)}% IRL / ${(100*snapshot.weights.online).toFixed(1)}% Online`);
  }

  for(const snapshot of snapshots){
    if(snapshot.actualField?.length)continue;
    if(String(snapshot.endDate||'')>=localParts(now,snapshot.timeZone||'UTC').date)continue;
    const irl=await readJson(path.join(root,'data','meta','irl',`${snapshot.formatId}.json`),null);
    if(!irl)continue;
    const actualEvents=(irl.events||[]).filter(event=>isoWeekKey(event.date)===snapshot.weekKey);
    if(actualEvents.length<Number(snapshot.scheduledMajorCount||1))continue;
    const actualField=aggregateEvents(actualEvents);
    if(!actualField.length)continue;
    snapshot.actualField=actualField;
    snapshot.actualPlayers=actualEvents.reduce((sum,event)=>sum+Number(event.players||0),0);
    snapshot.actualMajorNames=actualEvents.map(event=>event.name);
    snapshot.evaluatedAt=now.toISOString();
    snapshot.accuracy=distributionAccuracy(snapshot.predictedField,actualField);
    snapshot.diagnostics=cleanDiagnostics(varianceDiagnostics(snapshot.predictedField,actualField,{threshold:0.01,limit:5}));
    console.log(`Evaluated ${snapshot.key}: ${(100*snapshot.accuracy).toFixed(1)}% accuracy`);
  }

  snapshots.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
  const completed=snapshots.filter(row=>row.actualField?.length);
  const fit=fitBestFormula(completed,config.liveFormula);
  const latestCompleted=[...completed].sort((a,b)=>String(b.evaluatedAt).localeCompare(String(a.evaluatedAt)))[0]||null;
  const output={
    schemaVersion:1,generatedAt:now.toISOString(),liveFormulaVersion:config.liveFormula.versionKey,formatRegistryVersion:config.formatRegistryVersion,
    latestEvaluationKey:latestCompleted?.key||null,
    fit:{dataPoints:fit.dataPoints,liveAccuracy:fit.liveAccuracy,bestAccuracy:fit.bestAccuracy,improvement:fit.improvement,liveFormula:fit.liveFormula,bestFormula:fit.bestFormula},
    snapshots
  };
  await fs.mkdir(path.dirname(OUTPUT),{recursive:true});
  await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log(`Wrote ${OUTPUT}: ${snapshots.length} snapshot(s), ${completed.length} evaluated, fit on ${fit.dataPoints} point(s)`);
}

main().catch(error=>{console.error(error);process.exit(1)});
