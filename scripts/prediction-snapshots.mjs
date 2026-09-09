import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const stable = value => {
  if (Array.isArray(value)) return Array.from(value,stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
};
const json = value => JSON.stringify(stable(value));
const digest = value => crypto.createHash('sha256').update(json(value)).digest('hex');
const percentRows = rows => {
  const cleaned = (rows || []).map(row => ({name:String(row.name || '').trim(),share:Math.max(0,Number(row.share || 0))})).filter(row => row.name && row.share > 0);
  const total = cleaned.reduce((sum,row) => sum + row.share,0);
  return total ? cleaned.map(row => ({name:row.name,share:100 * row.share / total})).sort((a,b)=>b.share-a.share || a.name.localeCompare(b.name)) : [];
};
const eventRows = events => {
  const counts = new Map();
  for (const event of events || []) for (const row of event.decks || event.archetypes || []) {
    const name=String(row.name || '').trim(),entries=Math.max(0,Number(row.entries || 0));
    if(name && name!=='Other' && name!=='Unknown' && entries)counts.set(name,(counts.get(name)||0)+entries);
  }
  return percentRows([...counts].map(([name,share])=>({name,share})));
};

export async function loadBlendEngine(file) {
  const context=vm.createContext({window:{},globalThis:null,Date,Map,Math,Number,String,Array,Object,Set});
  context.globalThis=context;
  await vm.runInContext(await fs.readFile(file,'utf8'),context);
  return context.window.PTCGMetaBlend;
}

export function evidenceFromRelease(built) {
  const core=built.files.core,online={[core.online.format]:core.online},irl={[core.irl.format]:core.irl};
  for(const [format,descriptor] of Object.entries(core.archives?.online || {}))online[format]=built.files[descriptor.coreKey];
  for(const [format,descriptor] of Object.entries(core.archives?.irl || {}))irl[format]=built.files[descriptor.coreKey];
  return {asOf:core.formatDate,splitDate:core.splitDate || null,currentFormats:core.currentFormats,calendarRevision:core.calendarRevision,online,irl};
}

export function makeSnapshots(built, blend) {
  const evidence=evidenceFromRelease(built);
  return blend.predictions(evidence,{now:evidence.asOf}).map(result=>{
    const onlineCore=evidence.online[result.format];
    const irlFormat=result.evidence?.irl?.format || result.format,irlCore=evidence.irl[irlFormat];
    const selectedIds=new Set((result.evidence?.irl?.events || []).map(event=>String(event.id)));
    const onlineRows=percentRows(onlineCore?.scopes?.[result.onlineScope]?.decks || []);
    const irlRows=eventRows((irlCore?.events || []).filter(event=>selectedIds.has(String(event.id))));
    const content={
      schemaVersion:1,calculationDate:evidence.asOf,targetFormat:result.format,available:result.available,reason:result.reason || null,
      prediction:{rows:percentRows(result.rows),weights:result.weights,configuredWeights:result.configuredWeights,status:result.status,rule:result.rule,frozen:result.frozen},
      inputs:{
        online:{format:result.format,generatedAt:onlineCore?.generatedAt || null,scope:result.onlineScope || null,rows:onlineRows,evidence:result.evidence?.online || null},
        irl:{format:irlFormat,generatedAt:irlCore?.generatedAt || null,scope:result.irlScope || null,rows:irlRows,evidence:result.evidence?.irl || null},
      },
      formula:{version:result.version,rule:result.rule,parameters:{irlMax:blend.policy.irlMax,irlMin:blend.policy.irlMin,irlDecayPerDay:blend.policy.irlDecayPerDay,minOnlinePlayers:blend.policy.minOnlinePlayers}},
      provenance:{release:built.manifest.release,revision:result.revision || null,calendarRevision:evidence.calendarRevision},
    };
    const contentHash=digest(content);
    return stable({...content,snapshotId:`prediction-${contentHash.slice(0,20)}`,contentHash});
  });
}

export async function archiveSnapshots({built,blend,directory,publishedAt=new Date().toISOString()}) {
  const snapshots=makeSnapshots(built,blend);
  const snapshotsDir=path.join(directory,'snapshots'),indexFile=path.join(directory,'index.json');
  await fs.mkdir(snapshotsDir,{recursive:true});
  let index={schemaVersion:1,publications:[]};
  try{index=JSON.parse(await fs.readFile(indexFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const snapshot of snapshots){
    const file=path.join(snapshotsDir,`${snapshot.snapshotId}.json`),serialized=json(snapshot);
    try{
      const existing=await fs.readFile(file,'utf8');
      if(existing!==serialized)throw new Error(`Refusing to rewrite immutable prediction snapshot ${snapshot.snapshotId}`);
    }catch(error){if(error.code==='ENOENT')await fs.writeFile(file,serialized);else throw error;}
    const publication={publishedAt,snapshotId:snapshot.snapshotId,contentHash:snapshot.contentHash,targetFormat:snapshot.targetFormat,available:snapshot.available,release:built.manifest.release};
    if(!index.publications.some(row=>row.publishedAt===publishedAt && row.snapshotId===snapshot.snapshotId))index.publications.push(publication);
  }
  index.publications.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.targetFormat.localeCompare(b.targetFormat));
  await fs.writeFile(indexFile,json(index));
  return snapshots;
}
