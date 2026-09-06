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
}
console.log(`Validated ${formats.irl.id}: ${data.events.length} events, ${data.decks.length} decks, ${data.matchups.length} matchups, ${data.results.length} results`);
