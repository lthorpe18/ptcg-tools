// Public adapters retain source IDs, verification times and matching diagnostics.
const POKEDATA='https://www.pokedata.ovh/events/apiv2';
const BATTLEFIELDS='https://www.thebattlefields.co.uk';
export const nullable=value=>String(value??'').trim()||null;
const numberOrNull=value=>value==null||String(value).trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
export function isUK(raw){
  const country=key(raw.country||raw.country_code);
  if(country)return ['gb','uk','gbr','united kingdom','great britain'].includes(country);
  return ['england','scotland','wales','cymru wales','northern ireland'].includes(key(raw.state||raw.region))||/(?:\bUK\b|\bGB\b|UNITED KINGDOM|GREAT BRITAIN)\s*$/.test(String(raw.street_address||raw.address||'').toUpperCase());
}
function typeName(value,fallback){
  const type=key(value);
  if(type==='league cup')return 'League Cup';
  if(type==='league challenge')return 'League Challenge';
  if(/^(pre release|prerelease)$/.test(type))return 'Prerelease';
  return type?null:({cups:'League Cup',challenges:'League Challenge',pre:'Prerelease'}[fallback]||null);
}
export function normalisePokedata(raw,fallback,verifiedAt){
  const sourceId=nullable(raw.guid)||nullable(raw.Guid)||nullable(raw.id);
  const parts=nullable(raw.when)?.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  const date=parts?.[1]||nullable(raw.date)||nullable(raw.start_date)||nullable(raw.startDate);
  const time=parts?.[2]||nullable(raw.time)||nullable(raw.start_time)||nullable(raw.startTime);
  if(!sourceId||!validDate(date))return null;
  const contact=raw.contact_data&&typeof raw.contact_data==='object'?raw.contact_data:{};
  return {
    id:`pokedata:${sourceId}`,source:'pokedata',sourceId,scope:'local',type:typeName(raw.type,fallback),
    name:nullable(raw.name)||nullable(raw.Name)||nullable(raw.shop)||'Pokémon TCG event',venue:nullable(raw.shop),
    organiser:nullable(raw.organiser)||nullable(raw.organizer)||nullable(raw.league_name),
    organiserId:nullable(raw.organiser_id)||nullable(raw.organizer_id)||nullable(raw.league_id)||nullable(raw.league_guid)||nullable(raw.league)||nullable(raw.shop_id),
    startDate:date,startTime:time,endDate:null,endTime:null,address:nullable(raw.street_address)||nullable(raw.address),
    city:nullable(raw.city),region:nullable(raw.state)||nullable(raw.region),postcode:nullable(raw.postal_code)||nullable(raw.postcode),country:'GB',
    latitude:numberOrNull(raw.latitude),longitude:numberOrNull(raw.longitude),distanceFromSeedMiles:null,
    cost:nullable(raw.cost)||nullable(raw.Admission),status:nullable(raw.Status)||nullable(raw.status),
    officialUrl:nullable(raw.pokemon_url),registrationUrl:nullable(raw.Third_party_registration_website)||nullable(raw.registration_url)||nullable(contact.Registration)||nullable(contact.registration),
    sourceUrl:'https://www.pokedata.ovh/events/',secondarySourceUrl:null,details:nullable(raw.Details)||nullable(contact.Details)||nullable(raw.details),
    registrationStart:nullable(raw.Registration_start),registrationEnd:nullable(raw.Registration_end),
    sources:['pokedata'],sourceIds:{pokedata:sourceId},lastVerifiedAt:{pokedata:verifiedAt},sanctioned:!!nullable(raw.Display_id)||key(raw.Status)==='sanctioned'
  };
}
export async function fetchText(url,fetcher=fetch){
  const response=await fetcher(url,{headers:{'user-agent':'PTCG-Tools event updater (GitHub Actions)'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}
export async function fetchPokedata({today,horizon,verifiedAt,fetcher=fetch}){
  const events=new Map(),queries=[];
  for(const type of ['cups','challenges','pre']){
    let page=1,totalPages=1;const seen=new Set();
    const query={type,country:'GB',pages:0,returned:0,accepted:0,rejected:{},rejectedSamples:[]};
    const reject=(reason,raw)=>{query.rejected[reason]=(query.rejected[reason]||0)+1;if(query.rejectedSamples.length<20)query.rejectedSamples.push({reason,sourceId:nullable(raw?.guid)||nullable(raw?.id),date:nullable(raw?.date),name:nullable(raw?.name)});};
    do{
      const url=`${POKEDATA}/_country/GB/_tcg/${type}/_start/${today}/_page/${page}`;
      const data=JSON.parse(await fetchText(url,fetcher)),meta=data.metadata;
      if(!Array.isArray(data.events)||!meta||Number(meta.current_page)!==page||!Number.isInteger(Number(meta.total_pages))||Number(meta.total_pages)<0)throw new Error(`Invalid Pokédata v2 page ${page} (${type})`);
      totalPages=Number(meta.total_pages);if(totalPages>100)throw new Error(`Unexpected Pokédata page count (${type}): ${totalPages}`);
      query.pages++;query.returned+=data.events.length;
      if(!data.events.length&&page<totalPages)throw new Error(`Empty intermediate Pokédata page ${page} (${type})`);
      let fresh=0;
      for(const raw of data.events){
        if(!raw||typeof raw!=='object'){reject('invalid_record',raw);continue;}
        if(!isUK(raw)){reject('non_uk',raw);continue;}
        if(!nullable(raw.guid)&&!nullable(raw.Guid)&&!nullable(raw.id)){reject('missing_id',raw);continue;}
        const event=normalisePokedata(raw,type,verifiedAt);
        if(!event){reject('missing_or_invalid_date',raw);continue;}
        if(seen.has(event.id)){reject('duplicate_id',raw);continue;}seen.add(event.id);fresh++;
        if(!event.type){reject('unsupported_type',raw);continue;}
        if(event.startDate<today||event.startDate>horizon){reject('outside_horizon',raw);continue;}
        events.set(event.id,event);query.accepted++;
      }
      if(data.events.length&&!fresh)throw new Error(`Repeated Pokédata page ${page} (${type})`);
      page++;
    }while(page<=totalPages);
    queries.push(query);
  }
  return {events:[...events.values()],diagnostics:{provider:'pokedata',apiVersion:2,status:'ok',url:POKEDATA,lastSuccessfulUpdate:verifiedAt,queries}};
}
export function htmlText(value){
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',pound:'£',eacute:'é'};
  return String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(all,entity)=>entity[0]==='#'?String.fromCodePoint(entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1))):entities[entity]??all).replace(/\s+/g,' ').trim();
}
export function englishDate(value){
  const m=htmlText(value).match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(\d{4})/i);
  if(!m)return null;const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].slice(0,3).toLowerCase())+1;
  const date=`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`;return validDate(date)?date:null;
}
function clock(value){
  const m=htmlText(value).match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);if(!m||+m[1]<1||+m[1]>12||+m[2]>59)return null;
  return `${String(+m[1]%12+(m[3].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${m[2]}:00`;
}
export function parseBattlefieldsListing(html){
  if(!/product-listing/.test(html)||!/pagenavinfo/.test(html))throw new Error('Battlefields listing structure changed');
  const pages=Number(html.match(/Page\s+\d+\s+of\s+(\d+)/i)?.[1]);if(!pages||pages>30)throw new Error('Invalid Battlefields pagination');
  const rows=[];
  for(const match of html.matchAll(/<a\s+href="(\/events-at-the-battlefields\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
    const title=match[2].match(/<h3\b[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1];if(!title)continue;
    const name=htmlText(title),date=englishDate(match[2].match(/<p\b[^>]*class="date"[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
    const normalized=key(name),type=/\bleague challenge\b/.test(normalized)?'League Challenge':/\bleague cup\b/.test(normalized)?'League Cup':/\b(pre release|prerelease|prelease)\b/.test(normalized)?'Prerelease':null;
    rows.push({name,date,type,url:new URL(match[1],BATTLEFIELDS).href});
  }
  if(!rows.length)throw new Error('Battlefields returned no event cards');
  return {pages,rows};
}
// Venue identities observed in the national feed; Swindon is source-native
// until a sanctioned record supplies a league ID. Never guess that ID.
const VENUES=[
  {city:'Gloucester',venue:'FIRESTORM GLOUCESTER',organiserId:'6244142',address:'48 Westgate Street, Gloucester GL1 2NF',postcode:'GL1 2NF',latitude:51.8663,longitude:-2.24746,region:'England'},
  {city:'Cardiff',venue:'FIRESTORM GAMES CARDIFF',organiserId:'1452907',address:'Sloper Road, Cardiff CF11 8AB',postcode:'CF11 8AB',latitude:51.4717,longitude:-3.19892,region:'Cymru / Wales'},
  {city:'Bridgend',venue:'FIRESTORM GAMES BRIDGEND',organiserId:'6241110',address:'6 Caroline Street, Bridgend CF31 1DQ',postcode:'CF31 1DQ',latitude:51.506,longitude:-3.57849,region:'Cymru / Wales'},
  {city:'Newport',venue:'FIRESTORM GAMES NEWPORT',organiserId:'2333018',address:'Unit F2, Tesco Extra, Newport Retail Park, Spytty Road, Newport NP19 4TX',postcode:'NP19 4TX',latitude:51.5786,longitude:-2.94353,region:'Cymru / Wales'},
  {city:'Merthyr Tydfil',venue:'FIRESTORM GAMES MERTHYR TYDFIL',organiserId:'6241833',address:'129 High Street, Merthyr Tydfil CF47 8DN',postcode:'CF47 8DN',latitude:51.7451,longitude:-3.3784,region:'Cymru / Wales'},
  {city:'Swindon',venue:'FIRESTORM GAMES SWINDON',organiserId:null,address:'121 Victoria Road, Swindon SN1 3BD',postcode:'SN1 3BD',latitude:null,longitude:null,region:'England'}
];
function venueFrom(text,known){
  const normalized=key(text);
  const matches=VENUES.filter(v=>normalized.includes(key(v.city))||(v.city==='Merthyr Tydfil'&&/\bmerthyr\b/.test(normalized))||(v.city==='Cardiff'&&normalized.includes('south wales gaming centre')));
  if(matches.length!==1)return null;
  const venue=matches[0],same=(known||[]).filter(e=>key(e.city)===key(venue.city)&&key(e.venue).includes('firestorm'));
  const identity=same.find(e=>e.organiserId===venue.organiserId)||same[0];
  return {...venue,...(identity?{venue:identity.venue,organiserId:identity.organiserId,latitude:identity.latitude??venue.latitude,longitude:identity.longitude??venue.longitude}:{}),venueId:`firestorm:${key(venue.city).replace(/ /g,'-')}`,organiserSource:'pokedata'};
}
export function parseBattlefieldsDetail(html,row,known,verifiedAt){
  const date=englishDate(html.match(/<tr\b[^>]*class="date"[^>]*>[\s\S]*?<td>Event Date<\/td>\s*<td>([\s\S]*?)<\/td>/i)?.[1]);
  if(!date||date!==row.date)throw new Error(`Battlefields detail date disagrees with listing: ${row.url}`);
  const id=html.match(/<input\b[^>]*name="p"[^>]*value="(\d+)"/i)?.[1];if(!id)throw new Error(`Missing Battlefields ticket ID: ${row.url}`);
  const reference=html.match(/<p\b[^>]*class="ref"[^>]*>([\s\S]*?)<\/p>/i)?.[1]||html.match(/Ref:[^<]*(?:<[^>]*>[^<]*<\/[^>]*>)?/i)?.[0]||'';
  const venue=venueFrom(`${row.name} ${htmlText(reference)}`,known);
  // Cityless tickets use the map's named address as venue evidence.
  const map=html.match(/<iframe\b[^>]*src="([^"]*google[^" ]*maps[^" ]*)"/i)?.[1];
  const resolved=venue||venueFrom(map?decodeURIComponent(htmlText(map)):'',known);if(!resolved)throw new Error(`Unknown or ambiguous Firestorm venue: ${row.url}`);
  const latitude=numberOrNull(map?.match(/!3d(-?[\d.]+)/)?.[1])??resolved.latitude,longitude=numberOrNull(map?.match(/!2d(-?[\d.]+)/)?.[1])??resolved.longitude;
  const startTime=clock(html.match(/<tr\b[^>]*class="start-time"[^>]*>[\s\S]*?<td>Event Start<\/td>\s*<td>([\s\S]*?)<\/td>/i)?.[1]);
  const cost=htmlText(html.match(/<h3\b[^>]*class="productprice"[^>]*>([\s\S]*?)<\/h3>/i)?.[1])||null;
  const availability=htmlText(html.match(/<h5\b[^>]*class="ticketsleft"[^>]*>([\s\S]*?)<\/h5>/i)?.[1]),sourceId=`${id}:${date}`;
  return {id:`battlefields:${sourceId}`,source:'battlefields',sourceId,scope:'local',type:row.type,name:row.name,...resolved,
    startDate:date,startTime,endDate:null,endTime:null,country:'GB',latitude,longitude,distanceFromSeedMiles:null,cost,status:/^0\s+of\s+\d+\s+tickets/i.test(availability)?'sold_out':null,
    officialUrl:null,registrationUrl:row.url,sourceUrl:row.url,secondarySourceUrl:null,details:null,ticketAvailability:availability||null,
    sources:['battlefields'],sourceIds:{battlefields:sourceId},lastVerifiedAt:{battlefields:verifiedAt},sanctioned:false};
}
export async function fetchBattlefields({today,horizon,verifiedAt,known=[],fetcher=fetch}){
  const rows=new Map(),diagnostics={provider:'battlefields',status:'ok',url:`${BATTLEFIELDS}/events-at-the-battlefields?venue=0&category=10`,pages:0,returned:0,accepted:0,rejected:{},rejectedSamples:[],lastSuccessfulUpdate:verifiedAt};
  let pages=1;
  for(let page=1;page<=pages;page++){
    const parsed=parseBattlefieldsListing(await fetchText(`${diagnostics.url}&resultpage=${page}`,fetcher));pages=parsed.pages;diagnostics.pages++;
    for(const row of parsed.rows)rows.set(`${row.url}|${row.date}`,row);
  }
  const events=[];diagnostics.returned=rows.size;
  for(const row of rows.values()){
    const reason=!row.date?'missing_or_invalid_date':!row.type?'unsupported_type':row.date<today||row.date>horizon?'outside_horizon':null;
    if(reason){diagnostics.rejected[reason]=(diagnostics.rejected[reason]||0)+1;continue;}
    try{events.push(parseBattlefieldsDetail(await fetchText(row.url,fetcher),row,known,verifiedAt));diagnostics.accepted++;}
    catch(error){diagnostics.status='partial';diagnostics.rejected.detail_error=(diagnostics.rejected.detail_error||0)+1;diagnostics.rejectedSamples.push({url:row.url,reason:String(error.message)});}
  }
  return {events,diagnostics};
}
const observedSources=event=>event.sources||[event.source];
function sameVenue(a,b){
  if(a.venueId&&b.venueId)return a.venueId===b.venueId;
  if(key(a.city)!==key(b.city)||!key(a.city))return false;
  if(a.organiserId&&a.organiserId===b.organiserId)return true;
  const norm=value=>key(value).replace(/\bgames\b/g,'').replace(/\s+/g,' ').trim();
  return !!norm(a.venue)&&norm(a.venue)===norm(b.venue);
}
const sameSlot=(a,b)=>a.startDate===b.startDate&&a.type===b.type&&sameVenue(a,b);
function sourceIdentities(event){return [...new Set([event.id,...(event.aliases||[]),...Object.entries(event.sourceIds||{}).map(([source,id])=>`${source}:${id}`)])];}
export function mergeEvents(primary,direct,previous=[]){
  const events=primary.map(e=>({...e})),diagnostics={merged:0,added:0,ambiguous:[],conflicts:[]};
  for(const incoming of direct){
    const matches=events.filter(e=>sameSlot(e,incoming)&&observedSources(e).includes('pokedata'));
    const timed=matches.filter(e=>e.startTime&&incoming.startTime&&e.startTime.slice(0,5)===incoming.startTime.slice(0,5));
    const candidates=timed.length===1?timed:matches;
    if(candidates.length===1){
      const event=candidates[0];
      for(const field of ['startTime','cost'])if(event[field]&&incoming[field]&&event[field]!==incoming[field])diagnostics.conflicts.push({id:event.id,field,pokedata:event[field],battlefields:incoming[field],selected:'battlefields'});
      for(const field of ['startTime','cost','registrationUrl','ticketAvailability','venueId'])if(incoming[field]!=null)event[field]=incoming[field];
      event.secondarySourceUrl=incoming.sourceUrl;event.organiserSource='pokedata';event.sources=[...new Set([...observedSources(event),'battlefields'])];
      event.sourceIds={...(event.sourceIds||{}),battlefields:incoming.sourceId};event.lastVerifiedAt={...(event.lastVerifiedAt||{}),...(incoming.lastVerifiedAt||{})};
      event.staleSources=[...new Set([...(event.staleSources||[]),...(incoming.staleSources||[])])].filter(source=>!(incoming.lastVerifiedAt?.[source]&&!incoming.staleSources?.includes(source)));
      event.aliases=[...new Set([...(event.aliases||[]),incoming.id])];diagnostics.merged++;
    }else{
      if(candidates.length>1)diagnostics.ambiguous.push({id:incoming.id,candidates:candidates.map(e=>e.id)});
      events.push({...incoming});diagnostics.added++;
    }
  }
  // Preserve IDs already saved by users as new sources enrich the record.
  for(const event of events){
    const ids=sourceIdentities(event),matches=previous.filter(old=>old.scope==='local'&&sourceIdentities(old).some(id=>ids.includes(id)));
    const old=matches.find(row=>row.id===event.id)||(matches.length===1?matches[0]:null);
    if(old){event.aliases=[...new Set([...ids,...sourceIdentities(old)])].filter(id=>id!==old.id);event.id=old.id;event.source=old.source;event.sourceId=old.sourceId;}
  }
  return {events,diagnostics};
}
