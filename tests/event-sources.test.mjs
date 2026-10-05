import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fetchPokedata,parseBattlefieldsListing,parseBattlefieldsDetail,mergeEvents,normalisePokedata} from '../scripts/event-sources.mjs';
import {updateEvents} from '../scripts/update-events.mjs';
const verifiedAt='2026-10-05T21:00:00.000Z',today='2026-10-05',horizon='2027-04-05';
const fixture=name=>fs.readFile(new URL(`./fixtures/events/${name}`,import.meta.url),'utf8');
const raw=(id,extra={})=>({guid:id,date:'2026-10-09',when:'2026-10-09 18:00:00',country_code:'GB',type:'League Challenge',name:'Challenge',shop:'FIRESTORM GLOUCESTER',league:'6244142',city:'Gloucester',latitude:'51.8663',longitude:'-2.24746',...extra});
const response=body=>({ok:true,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
test('v2 follows every numbered page and explains rejected records',async()=>{
  const requests=[];
  const fetcher=async url=>{
    requests.push(url);const type=url.match(/_tcg\/([^/]+)/)[1],page=Number(url.match(/_page\/(\d+)/)[1]);
    const rows=type==='challenges'?(page===1?[raw('first'),raw('foreign',{country_code:'IE'}),raw('missing',{guid:null}),raw('date',{date:'2026-02-30',when:null}),raw('old',{date:'2026-01-01',when:null}),raw('unsupported',{type:'nonpremier TCG'})]:[raw('second')]):[];
    return response({metadata:{current_page:page,total_pages:type==='challenges'?2:0},events:rows});
  };
  const result=await fetchPokedata({today,horizon,verifiedAt,fetcher});
  assert.deepEqual(result.events.map(e=>e.id),['pokedata:first','pokedata:second']);
  assert.equal(requests.filter(u=>u.includes('_tcg/challenges')).length,2);
  assert.deepEqual(result.diagnostics.queries[1].rejected,{non_uk:1,missing_id:1,missing_or_invalid_date:1,outside_horizon:1,unsupported_type:1});
});
test('v2 rejects repeated pages rather than publishing a truncated refresh',async()=>{
  const fetcher=async url=>response({metadata:{current_page:Number(url.match(/_page\/(\d+)/)[1]),total_pages:2},events:[raw('same')]});
  await assert.rejects(fetchPokedata({today,horizon,verifiedAt,fetcher}),/Repeated Pokédata page/);
});
test('real Gloucester listing and ticket page produce a discoverable event',async()=>{
  const listing=parseBattlefieldsListing(await fixture('battlefields-listing.html'));
  assert.equal(listing.pages,2);
  const row=listing.rows.find(e=>e.name.includes('Gloucester'));assert.equal(row.type,'League Challenge');
  const event=parseBattlefieldsDetail(await fixture('gloucester-challenge.html'),row,[],verifiedAt);
  assert.equal(event.id,'battlefields:2758:2026-10-09');assert.equal(event.startTime,'18:00:00');assert.equal(event.cost,'£9.00');assert.equal(event.organiserId,'6244142');assert.equal(event.venue,'FIRESTORM GLOUCESTER');assert.equal(event.sanctioned,false);assert(event.latitude>51&&event.longitude<0);assert.match(event.registrationUrl,/pokemon-gloucester-league-challenge-/);
  assert.equal(listing.rows.find(e=>e.name.includes('Casual')).type,null);
  const detail=await fixture('gloucester-challenge.html');
  assert.throws(()=>parseBattlefieldsDetail(detail,{...row,date:'2026-10-10'},[],verifiedAt),/disagrees/);
});
test('merge keeps sanctioned identity, enriches ticket data, and preserves saved direct IDs',async()=>{
  const listing=parseBattlefieldsListing(await fixture('battlefields-listing.html')),row=listing.rows.find(e=>e.name.includes('Gloucester'));
  const direct=parseBattlefieldsDetail(await fixture('gloucester-challenge.html'),row,[],verifiedAt);
  const primary=normalisePokedata(raw('official',{cost:'£8',Display_id:'26-10-123456',pokemon_url:'https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-10-123456/'}),'challenges',verifiedAt);
  const merged=mergeEvents([primary],[direct]);assert.equal(merged.events.length,1);assert.equal(merged.events[0].id,primary.id);assert.deepEqual(merged.events[0].sources,['pokedata','battlefields']);assert.equal(merged.events[0].cost,'£9.00');assert.equal(merged.diagnostics.conflicts.length,1);assert.equal(merged.events[0].sanctioned,true);
  const later=mergeEvents([primary],[direct],[direct]);assert.equal(later.events[0].id,direct.id);assert(later.events[0].aliases.includes(primary.id));assert.equal(later.events[0].officialUrl,primary.officialUrl);
  const ambiguity=mergeEvents([primary,{...primary,id:'pokedata:other',sourceId:'other'}],[{...direct,startTime:null}]);assert.equal(ambiguity.events.length,3);assert.equal(ambiguity.diagnostics.ambiguous.length,1);
});
test('partial source failure retains its previous events and lets the other source refresh',async()=>{
  const listing=await fixture('battlefields-listing.html'),detail=await fixture('gloucester-challenge.html');
  const old=normalisePokedata(raw('existing'),'challenges','2026-10-04T12:00:00.000Z');
  const existing={schemaVersion:5,status:'ok',lastSuccessfulUpdate:'2026-10-04T12:00:00.000Z',sources:{major:{provider:'pokemon-championships'}},events:[old,{id:'major',scope:'major'}]};
  const fetcher=async url=>{if(url.includes('pokedata'))throw new Error('source offline');if(url.includes('resultpage='))return response(listing.replace('Page 1 of 2','Page 1 of 1'));if(url.includes('gloucester-league'))return response(detail);throw new Error('ticket unavailable');};
  const output=await updateEvents(existing,{now:new Date(verifiedAt),fetcher});
  assert.equal(output.status,'partial');assert.equal(output.lastSuccessfulUpdate,existing.lastSuccessfulUpdate);assert.equal(output.sources.local.adapters.pokedata.status,'error');assert.equal(output.events.filter(e=>e.scope==='local').length,1);assert.deepEqual(output.events[0].sources,['pokedata','battlefields']);assert.equal(output.events[0].cost,'£9.00');assert.deepEqual(output.events[0].staleSources,['pokedata']);assert.equal(output.events.at(-1).id,'major');
  await assert.rejects(updateEvents(existing,{now:new Date(verifiedAt),fetcher:async()=>{throw new Error('offline')}}),/Both event sources failed/);
});
