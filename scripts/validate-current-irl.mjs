import fs from 'node:fs/promises';
import { loadPublishedConfig, resolveCurrentFormats } from './lib/format-config.mjs';

const config=await loadPublishedConfig();
const formats=resolveCurrentFormats(config,new Date());
if(!formats.irl)throw new Error('Unable to resolve current IRL format');
const file=`data/meta/irl/${formats.irl.id}.json`;
const data=JSON.parse(await fs.readFile(file,'utf8'));
if(data.format!==formats.irl.id)throw new Error(`IRL dataset format ${data.format} does not match ${formats.irl.id}`);
if(!Array.isArray(data.events)||!Array.isArray(data.decks)||!Array.isArray(data.matchups)||!Array.isArray(data.results))throw new Error('Invalid IRL dataset shape');
if(data.events.length&&!data.decks.length)throw new Error('IRL events present but field data empty');
for(const event of data.events){
  if(Number(event.players||0)>=50&&(!Array.isArray(event.decks)||!event.decks.length))throw new Error(`IRL event ${event.id} has no deck field`);
  if(!Array.isArray(event.results))throw new Error(`IRL event ${event.id} has no results array`);
  if(typeof event.day1FieldComplete!=='boolean')throw new Error(`IRL event ${event.id} has no explicit Day 1 field completeness marker`);
  const knownEntries=(event.decks||[]).reduce((sum,row)=>sum+Number(row.entries||0),0);
  const unclassifiedEntries=Number(event.unclassifiedEntries||0);
  const accounted=knownEntries+unclassifiedEntries;
  if(Number(event.day1FieldEntries||0)!==accounted)throw new Error(`IRL event ${event.id} Day 1 field count is inconsistent (${event.day1FieldEntries} vs ${accounted})`);
  if(event.day1FieldComplete&&accounted!==Number(event.players||0))throw new Error(`IRL event ${event.id} marked complete with ${accounted}/${event.players||0} Day 1 entries`);
}
console.log(`Validated ${formats.irl.id}: ${data.events.length} events, ${data.decks.length} decks, ${data.matchups.length} matchups, ${data.results.length} results`);
