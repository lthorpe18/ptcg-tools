import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {fetchPokedata,fetchBattlefields,mergeEvents} from './event-sources.mjs';

const OUTPUT=new URL('../v2-preview/data/events.json',import.meta.url);
export async function updateEvents(existing,{now=new Date(),fetcher=fetch}={}){
  const verifiedAt=now.toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const future=new Date(`${today}T12:00:00Z`);future.setUTCMonth(future.getUTCMonth()+6);const horizon=future.toISOString().slice(0,10);
  const previous=(existing.events||[]).filter(e=>e.scope==='local'&&e.startDate>=today&&e.startDate<=horizon);
  const adapters={},errors=[];
  function cached(name,failedUrls=null){
    return previous.filter(e=>(e.sources||[e.source]).includes(name)&&(!failedUrls||failedUrls.has(e.registrationUrl)||failedUrls.has(e.secondarySourceUrl)||failedUrls.has(e.sourceUrl))).map(e=>{
      const sourceId=e.sourceIds?.[name]||(e.source===name?e.sourceId:null);
      return {...e,id:`${name}:${sourceId}`,source:name,sourceId,sources:[name],sourceIds:{[name]:sourceId},lastVerifiedAt:{[name]:e.lastVerifiedAt?.[name]||existing.lastSuccessfulUpdate},staleSources:[name]};
    });
  }
  async function readSource(name,operation){
    try{
      const result=await operation();adapters[name]={...result.diagnostics,lastAttemptedUpdate:verifiedAt};
      if(result.diagnostics.status==='partial'){
        errors.push(name);const successful=new Set(result.events.map(e=>e.id)),failedUrls=new Set(result.diagnostics.rejectedSamples.map(e=>e.url));
        result.events.push(...cached(name,failedUrls).filter(e=>!successful.has(e.id)));
        adapters[name].lastSuccessfulUpdate=existing.sources?.local?.adapters?.[name]?.lastSuccessfulUpdate||null;
      }
      return result.events;
    }catch(error){
      errors.push(name);const previousMeta=existing.sources?.local?.adapters?.[name];
      adapters[name]={...previousMeta,provider:name,status:'error',lastAttemptedUpdate:verifiedAt,error:String(error.message),lastSuccessfulUpdate:previousMeta?.lastSuccessfulUpdate||(name==='pokedata'?existing.lastSuccessfulUpdate:null)};
      return cached(name);
    }
  }
  const pokedata=await readSource('pokedata',()=>fetchPokedata({today,horizon,verifiedAt,fetcher}));
  const battlefields=await readSource('battlefields',()=>fetchBattlefields({today,horizon,verifiedAt,known:[...pokedata,...previous],fetcher}));
  if(errors.length===2&&adapters.pokedata.status==='error'&&adapters.battlefields.status==='error')throw new Error(`Both event sources failed: ${JSON.stringify(adapters)}`);
  const merged=mergeEvents(pokedata,battlefields,previous);
  const local=[...new Map(merged.events.map(e=>[e.id,e])).values()].sort((a,b)=>`${a.startDate} ${a.startTime||''} ${a.id}`.localeCompare(`${b.startDate} ${b.startTime||''} ${b.id}`));
  const majors=(existing.events||[]).filter(e=>e.scope==='major');
  return {...existing,schemaVersion:5,status:errors.length?'partial':'ok',lastAttemptedUpdate:verifiedAt,lastSuccessfulUpdate:errors.length?existing.lastSuccessfulUpdate:verifiedAt,eventCount:local.length+majors.length,
    sources:{...(existing.sources||{}),local:{provider:'multi-source',ingestionVersion:2,providers:['pokedata','battlefields'],url:'https://www.pokedata.ovh/events/',coverage:'United Kingdom',retention:{past:'none',futureMonths:6},adapters,merge:merged.diagnostics}},events:[...local,...majors]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const existing=JSON.parse(await fs.readFile(OUTPUT,'utf8')),output=await updateEvents(existing);
  const temporary=new URL('./events.json.tmp',OUTPUT);await fs.writeFile(temporary,JSON.stringify(output,null,2)+'\n');await fs.rename(temporary,OUTPUT);
  console.log(`Wrote ${output.events.filter(e=>e.scope==='local').length} UK local events; status ${output.status}; ${JSON.stringify(output.sources.local.merge)}`);
}
