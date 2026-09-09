import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=process.cwd();
const stable=value=>Array.isArray(value)?Array.from(value,stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const json=value=>JSON.stringify(stable(value));
const digest=value=>crypto.createHash('sha256').update(json(value)).digest('hex');
const isoDay=value=>{const day=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(`${day}T00:00:00Z`))?day:null;};
const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));

export function majorType(event={}) {
  const text=`${event.type || ''} ${event.name || ''}`.toLowerCase();
  if(/\bworld championships?\b/.test(text))return 'worlds';
  if(/\binternational championships?\b/.test(text))return 'international';
  if(/\bspecial championships?\b/.test(text))return 'special';
  if(/\bregional championships?\b/.test(text))return 'regional';
  return null;
}

export function makeActual(event,dataset={}) {
  const type=majorType(event),day=isoDay(event.date),format=String(event.format || dataset.format || '');
  if(!type || !day || !format)return null;
  const totalPlayers=Number(event.players || 0),counts=new Map();
  for(const row of event.decks || []){
    const name=String(row.name || '').trim(),entries=Number(row.entries || 0);
    if(name && name!=='Other' && name!=='Unknown' && Number.isFinite(entries) && entries>0)counts.set(name,(counts.get(name)||0)+entries);
  }
  const classifiedEntries=[...counts.values()].reduce((sum,value)=>sum+value,0);
  const validPlayers=Number.isFinite(totalPlayers)&&totalPlayers>0&&classifiedEntries<=totalPlayers;
  const coverage=validPlayers?classifiedEntries/totalPlayers:0;
  const variants=[...counts].map(([name,entries])=>({name,entries,share:classifiedEntries?100*entries/classifiedEntries:0})).sort((a,b)=>b.entries-a.entries||a.name.localeCompare(b.name));
  const content={schemaVersion:1,eventKey:`${dataset.source || 'irl'}:${event.id}`,sourceEventId:String(event.id),name:event.name || 'Tournament',type,dayOneDate:day,format,totalPlayers,classifiedEntries,coverage,variants,source:dataset.source || 'irl',sourceUrl:event.url || dataset.sourceUrl || null,sourceRevision:digest({eventId:String(event.id),name:event.name,type,day,format,totalPlayers,variants}),eligible:validPlayers&&coverage>=0.95,unavailableReason:!validPlayers?'Invalid player or classified-entry totals.':coverage<0.95?'Fewer than 95% of Day 1 entries are classified.':null};
  const contentHash=digest(content);
  return stable({...content,actualId:`actual-${contentHash.slice(0,20)}`,contentHash});
}

export function selectPrediction(actual,publications) {
  return (publications || []).filter(row=>row.available&&row.targetFormat===actual.format&&isoDay(row.publishedAt)&&isoDay(row.publishedAt)<actual.dayOneDate)
    .sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt)))[0] || null;
}

export function scorePrediction(actual,snapshot,publication) {
  if(!actual.eligible)throw new Error(actual.unavailableReason || 'Actual field is ineligible');
  if(!snapshot.available || snapshot.targetFormat!==actual.format)throw new Error('Prediction is unavailable or format-incompatible');
  const predicted=new Map((snapshot.prediction?.rows||[]).map(row=>[row.name,Number(row.share||0)]));
  const observed=new Map((actual.variants||[]).map(row=>[row.name,Number(row.share||0)]));
  const predictedTotal=[...predicted.values()].reduce((sum,value)=>sum+value,0),observedTotal=[...observed.values()].reduce((sum,value)=>sum+value,0);
  if(![...predicted.values(),...observed.values()].every(Number.isFinite)||Math.abs(predictedTotal-100)>1e-6||Math.abs(observedTotal-100)>1e-6)throw new Error('Prediction and actual fields must each total 100%');
  const names=[...new Set([...predicted.keys(),...observed.keys()])].filter(name=>(predicted.get(name)||0)>1||(observed.get(name)||0)>1).sort();
  const rows=names.map(name=>({name,predicted:predicted.get(name)||0,actual:observed.get(name)||0,variance:(predicted.get(name)||0)-(observed.get(name)||0)}));
  const other={name:'Other',predicted:100-rows.reduce((sum,row)=>sum+row.predicted,0),actual:100-rows.reduce((sum,row)=>sum+row.actual,0)};
  other.variance=other.predicted-other.actual;
  if(Math.abs(other.predicted)>1e-9||Math.abs(other.actual)>1e-9)rows.push(other);
  const absoluteError=rows.reduce((sum,row)=>sum+Math.abs(row.variance),0);
  const ranked=rows.filter(row=>row.name!=='Other');
  const content={schemaVersion:1,actualId:actual.actualId,snapshotId:snapshot.snapshotId,snapshotPublishedAt:publication.publishedAt,eventKey:actual.eventKey,eventName:actual.name,dayOneDate:actual.dayOneDate,format:actual.format,formulaVersion:snapshot.formula?.version || null,metrics:{fieldAccuracy:Math.max(0,Math.min(100,100-absoluteError/2)),mae:rows.length?absoluteError/rows.length:0},rows,topOver:[...ranked].sort((a,b)=>b.variance-a.variance).filter(row=>row.variance>0).slice(0,5),topUnder:[...ranked].sort((a,b)=>a.variance-b.variance).filter(row=>row.variance<0).slice(0,5)};
  const contentHash=digest(content);
  return stable({...content,evaluationId:`evaluation-${contentHash.slice(0,20)}`,contentHash});
}

async function writeImmutable(file,value,label){
  const serialized=json(value);
  try{if(await fs.readFile(file,'utf8')!==serialized)throw new Error(`Refusing to rewrite immutable ${label} ${path.basename(file,'.json')}`);}
  catch(error){if(error.code==='ENOENT')await fs.writeFile(file,serialized);else throw error;}
}

export async function buildAccuracyArchive({datasets,snapshotDirectory,outputDirectory}) {
  const snapshotIndex=await readJson(path.join(snapshotDirectory,'index.json'));
  const actualDir=path.join(outputDirectory,'actuals'),evaluationDir=path.join(outputDirectory,'evaluations'),indexFile=path.join(outputDirectory,'index.json');
  await fs.mkdir(actualDir,{recursive:true});await fs.mkdir(evaluationDir,{recursive:true});
  let index={schemaVersion:1,events:[]};
  try{index=await readJson(indexFile);}catch(error){if(error.code!=='ENOENT')throw error;}
  const byKey=new Map(index.events.map(row=>[row.eventKey,row]));
  for(const dataset of datasets)for(const event of dataset.events || []){
    const actual=makeActual(event,dataset);if(!actual)continue;
    await writeImmutable(path.join(actualDir,`${actual.actualId}.json`),actual,'actual record');
    const previous=byKey.get(actual.eventKey)||{eventKey:actual.eventKey,actualRevisions:[],evaluationRevisions:[]};
    if(!previous.actualRevisions.includes(actual.actualId))previous.actualRevisions.push(actual.actualId);
    Object.assign(previous,{name:actual.name,type:actual.type,dayOneDate:actual.dayOneDate,format:actual.format,currentActualId:actual.actualId});
    if(!actual.eligible){Object.assign(previous,{status:'unavailable',reason:actual.unavailableReason,currentEvaluationId:null});byKey.set(actual.eventKey,previous);continue;}
    const publication=selectPrediction(actual,snapshotIndex.publications);
    if(!publication){Object.assign(previous,{status:'unscored',reason:'No available exact-format prediction was published strictly before Day 1.',currentEvaluationId:null});byKey.set(actual.eventKey,previous);continue;}
    const snapshot=await readJson(path.join(snapshotDirectory,'snapshots',`${publication.snapshotId}.json`));
    const {snapshotId,contentHash,...snapshotContent}=snapshot;
    if(snapshotId!==publication.snapshotId||contentHash!==publication.contentHash||digest(snapshotContent)!==contentHash)throw new Error(`Prediction snapshot integrity check failed: ${publication.snapshotId}`);
    const evaluation=scorePrediction(actual,snapshot,publication);
    await writeImmutable(path.join(evaluationDir,`${evaluation.evaluationId}.json`),evaluation,'evaluation');
    if(!previous.evaluationRevisions.includes(evaluation.evaluationId))previous.evaluationRevisions.push(evaluation.evaluationId);
    Object.assign(previous,{status:'scored',reason:null,currentEvaluationId:evaluation.evaluationId});byKey.set(actual.eventKey,previous);
  }
  index={schemaVersion:1,events:[...byKey.values()].sort((a,b)=>a.dayOneDate.localeCompare(b.dayOneDate)||a.eventKey.localeCompare(b.eventKey))};
  await fs.writeFile(indexFile,json(index));
  return index;
}

async function main(){
  const irlDir=path.join(root,'data/meta/irl'),files=(await fs.readdir(irlDir)).filter(file=>file.endsWith('.json'));
  const datasets=await Promise.all(files.map(file=>readJson(path.join(irlDir,file))));
  const index=await buildAccuracyArchive({datasets,snapshotDirectory:path.join(root,'data/meta/prediction-snapshots'),outputDirectory:path.join(root,'data/meta/prediction-accuracy')});
  console.log(`Built prediction accuracy records for ${index.events.length} eligible major(s): ${index.events.filter(row=>row.status==='scored').length} scored`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))main();
