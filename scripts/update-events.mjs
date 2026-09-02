import fs from 'node:fs/promises';

const OUTPUT=new URL('../v2-preview/data/events.json',import.meta.url);
const POKEDATA='https://www.pokedata.ovh/events/api';
const TYPES=['cups','challenges','pre'];
const SEEDS=[
  {name:'Great Britain',latitude:54.5,longitude:-2.5,radiusMiles:360},
  {name:'Northern Ireland',latitude:54.6,longitude:-5.93,radiusMiles:120}
];

function isoDate(date){return date.toISOString().slice(0,10)}
function horizonDate(from){const d=new Date(from);d.setUTCMonth(d.getUTCMonth()+6);return d}
function nullable(value){const text=String(value??'').trim();return text||null}
function numberOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null}
function startParts(raw){
  const when=nullable(raw.when);
  if(when){const m=when.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);if(m)return {date:m[1],time:m[2]||null}}
  const date=nullable(raw.date)||nullable(raw.start_date)||nullable(raw.startDate);
  const time=nullable(raw.time)||nullable(raw.start_time)||nullable(raw.startTime);
  return {date,time};
}
function isUK(raw){
  const country=String(raw.country||raw.country_code||'').trim().toLowerCase();
  if(['gb','uk','gbr','united kingdom','great britain'].includes(country))return true;
  const region=String(raw.state||raw.region||'').trim().toLowerCase();
  if(['england','scotland','wales','cymru / wales','northern ireland'].includes(region))return true;
  const address=String(raw.street_address||raw.address||'').toUpperCase();
  return /(?:\bUK\b|\bGB\b|UNITED KINGDOM|GREAT BRITAIN)\s*$/.test(address);
}
function typeName(raw,fallback){
  const supplied=nullable(raw.type);
  if(supplied)return supplied.replace(/^Pre Release$/i,'Prerelease');
  return fallback==='cups'?'League Cup':fallback==='challenges'?'League Challenge':'Prerelease';
}
function normalise(raw,fallbackType){
  const sourceId=nullable(raw.guid)||nullable(raw.id);if(!sourceId)return null;
  const {date,time}=startParts(raw);if(!date)return null;
  const contact=raw.contact_data&&typeof raw.contact_data==='object'?raw.contact_data:{};
  const organiserId=nullable(raw.organiser_id)||nullable(raw.organizer_id)||nullable(raw.league_id)||nullable(raw.league_guid)||nullable(raw.league)||nullable(raw.shop_id)||nullable(raw.shop_guid);
  const organiser=nullable(raw.organiser)||nullable(raw.organizer)||nullable(raw.league_name);
  return {
    id:`pokedata:${sourceId}`,source:'pokedata',sourceId,scope:'local',type:typeName(raw,fallbackType),
    name:nullable(raw.name)||nullable(raw.shop)||'Pokémon TCG event',venue:nullable(raw.shop),organiser,organiserId,
    startDate:date,startTime:time,endDate:null,endTime:null,address:nullable(raw.street_address)||nullable(raw.address),
    city:nullable(raw.city),region:nullable(raw.state)||nullable(raw.region),postcode:nullable(raw.postal_code)||nullable(raw.postcode),country:nullable(raw.country)||'GB',
    latitude:numberOrNull(raw.latitude),longitude:numberOrNull(raw.longitude),distanceFromSeedMiles:null,cost:nullable(raw.cost),status:nullable(raw.status),
    officialUrl:nullable(raw.pokemon_url),registrationUrl:nullable(raw.registration_url)||nullable(contact.Registration)||nullable(contact.registration),
    sourceUrl:'https://www.pokedata.ovh/events/',secondarySourceUrl:null,details:nullable(contact.Details)||nullable(raw.details)
  };
}
async function fetchJson(url){
  const response=await fetch(url,{headers:{'user-agent':'PTCG-Tools event updater (GitHub Actions)'}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const data=await response.json();if(!Array.isArray(data))throw new Error(`Unexpected Pokédata payload for ${url}`);return data;
}

const now=new Date(),today=isoDate(now),horizon=isoDate(horizonDate(now));
const existing=JSON.parse(await fs.readFile(OUTPUT,'utf8'));
const collected=new Map(),queries=[];
for(const seed of SEEDS){
  for(const tournamentType of TYPES){
    const url=`${POKEDATA}/_tcg/${tournamentType}/_latitude/${seed.latitude}/_longitude/${seed.longitude}/_radius/${seed.radiusMiles}/_unit/mi/_start/${today}`;
    const rows=await fetchJson(url);let accepted=0;
    for(const raw of rows){
      if(!isUK(raw))continue;
      const event=normalise(raw,tournamentType);if(!event||event.startDate<today||event.startDate>horizon)continue;
      collected.set(event.id,event);accepted++;
    }
    queries.push({seed:seed.name,type:tournamentType,radiusMiles:seed.radiusMiles,returned:rows.length,accepted});
  }
}
const local=[...collected.values()].sort((a,b)=>`${a.startDate} ${a.startTime||''}`.localeCompare(`${b.startDate} ${b.startTime||''}`));
const majors=(existing.events||[]).filter(event=>event&&event.scope==='major');
const generatedAt=new Date().toISOString();
const output={
  ...existing,schemaVersion:5,status:'ok',lastAttemptedUpdate:generatedAt,lastSuccessfulUpdate:generatedAt,eventCount:local.length+majors.length,
  sources:{...(existing.sources||{}),local:{provider:'pokedata',url:'https://www.pokedata.ovh/events/',coverage:'United Kingdom',retention:{past:'none',futureMonths:6},queries}},
  events:[...local,...majors]
};
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(`Wrote ${local.length} UK local events through ${horizon}; retained ${majors.length} major events.`);
