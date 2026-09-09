import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calendar, resolver, formatAt, validateDataset } from './meta-format-contract.mjs';
import { archiveSnapshots, loadBlendEngine } from './prediction-snapshots.mjs';
const SCOPES = ['14', '30', 'since-major', 'all'];
const root = process.cwd();
const outputDir = path.join(root, 'v2-preview', 'data', 'meta', 'release');

const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const ignored = name => !name || name === 'Other' || name === 'Unknown';
const json = value => JSON.stringify(value);
const digest = value => crypto.createHash('sha256').update(json(value)).digest('hex');

export function eventsForScope(payload, scope) {
  const events = Array.isArray(payload?.tournaments) ? payload.tournaments : [];
  if (scope === 'all') return events;
  if (scope === 'since-major') {
    const cutoff = new Date(payload?.majorWeekend?.cutoff).getTime();
    return Number.isFinite(cutoff) ? events.filter(event => new Date(event.date).getTime() >= cutoff) : [];
  }
  const newest = Math.max(0, ...events.map(event => new Date(event.date).getTime()).filter(Number.isFinite));
  const cutoff = newest - Number(scope || 30) * 86400000;
  return events.filter(event => new Date(event.date).getTime() >= cutoff);
}

export function aggregateField(events) {
  const map = new Map();
  for (const event of events || []) {
    for (const deck of event.archetypes || []) {
      if (ignored(deck?.name)) continue;
      const row = map.get(deck.name) || { name:deck.name, entries:0, wins:0, losses:0, ties:0 };
      row.entries += Number(deck.entries || 0);
      row.wins += Number(deck.wins || 0);
      row.losses += Number(deck.losses || 0);
      row.ties += Number(deck.ties || 0);
      map.set(deck.name, row);
    }
  }
  const decks = [...map.values()].sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));
  const entries = decks.reduce((sum, deck) => sum + deck.entries, 0);
  for (const deck of decks) {
    deck.share = entries ? 100 * deck.entries / entries : 0;
    const decisive = deck.wins + deck.losses;
    deck.winRate = decisive ? 100 * deck.wins / decisive : null;
    deck.games = deck.wins + deck.losses + deck.ties;
  }
  return { decks, overview:{ events:(events || []).length, entries } };
}

function eventSummary(event) {
  return { id:String(event.id), name:event.name || '', date:event.date, players:Number(event.players || 0), format:event.format, formatBasis:event.formatEvidence?.basis };
}

function sourcePackage(environment, inputs, rules) {
  const raw = environment === 'online' ? inputs.online : inputs.irl;
  const format = raw?.format;
  if (!/^[A-Z0-9+-]+$/.test(format || '')) throw new Error('Missing or unsafe source format');
  const events = validateDataset(raw, environment, format, rules);
  if (environment === 'online') {
    const {deckAggregate, onlineResults} = inputs;
    validateDataset(deckAggregate,'online',format,rules);
    const resultEvents = validateDataset(onlineResults,'online',format,rules);
    if(deckAggregate.set && !format.endsWith('-'+deckAggregate.set))throw new Error('Aggregate set disagrees with format');
    for(const event of raw.majorWeekend?.events || [])validateDataset({format,events:[event]},'irl',format,rules);
    const scopes = {};
    const online = {...raw,tournaments:events};
    for (const scope of SCOPES) {
      const selected = eventsForScope(online,scope);
      scopes[scope] = {...aggregateField(selected),events:selected.map(eventSummary)};
    }
    const results = onlineResults.results || resultEvents.flatMap(event=>event.results || []);
    const dates = new Map(events.map(event=>[String(event.id),String(event.date).slice(0,10)]));
    if(results.some(row=>dates.get(String(row.eventId))!==String(row.date).slice(0,10)))throw new Error('Online result date disagrees with event');
    const ids = new Set(events.map(event=>String(event.id)));
    if (results.some(row=>!ids.has(String(row.eventId)))) throw new Error('Online result outside field event inventory');
    return {format, core:{format,generatedAt:raw.generatedAt,label:format.replaceAll('-','–'),formatStart:raw.formatStart,minTournamentSize:raw.minTournamentSize,majorWeekend:raw.majorWeekend || null,scopes,records:{rotation:deckAggregate.rotation,set:deckAggregate.set,decks:(deckAggregate.decks||[]).map(({name,slug})=>({name,slug:slug||''}))}},
      payloads:{History:{tournaments:events},Matchups:{scopes:{...raw.matchupScopes,all:{overview:{events:Number(deckAggregate.overview?.tournaments || 0),matches:Number(deckAggregate.overview?.matches || 0)},matchups:deckAggregate.matchups || []}}},Results:{results}}};
  }
  const ids = new Set(events.map(event=>String(event.id)));
  if ((raw.results || []).some(row=>!ids.has(String(row.eventId)))) throw new Error('IRL result outside field event inventory');
  return {format,core:{format,generatedAt:raw.generatedAt,source:raw.source,sourceUrl:raw.sourceUrl,events:events.map(({results,matchups,...event})=>event),decks:raw.decks||[],note:raw.note||''},payloads:{Matchups:{matchups:raw.matchups||[],events:events.filter(e=>Array.isArray(e.matchups)).map(e=>({id:e.id,matchups:e.matchups}))},Results:{results:raw.results||[]}}};
}

export function buildRelease({online,irl,deckAggregate,onlineResults,archives=[],asOf,registry=calendar}) {
  const rules = registry === calendar ? resolver : (newResolver(registry));
  const date = asOf || [online.generatedAt,irl.generatedAt].filter(Boolean).sort().at(-1)?.slice(0,10);
  if (!date) throw new Error('Explicit release date or source timestamps required');
  const currentFormats = Object.fromEntries(['online','irl'].map(env=>[env,formatAt(date,env,rules)]));
  const selected = {online:sourcePackage('online',{online,deckAggregate,onlineResults},rules),irl:sourcePackage('irl',{irl},rules)};
  const archived = archives.map(item=>({environment:item.environment,...sourcePackage(item.environment,item,rules)}));
  function evidenceContext(pkg,environment) {
    const currentMatch=Object.values(currentFormats).find(context=>context?.label===pkg.format);
    if(currentMatch)return currentMatch;
    const dates=(environment==='online'?(pkg.core.scopes?.all?.events||[]):(pkg.core.events||[])).map(event=>event.date).filter(Boolean).sort().reverse();
    const baseline=registry.baseline?.asOf;
    if(baseline)dates.push(baseline);
    for(const eventDate of dates) {
      const context=formatAt(eventDate,environment,rules);
      if(context?.contextId && context.label===pkg.format)return context;
    }
    return null;
  }
  for(const pkg of archived)pkg.core.formatContext=evidenceContext(pkg,pkg.environment);
  const seed = {schemaVersion:2,selected,archived,currentFormats,registry,asOf:date};
  const release = digest(seed).slice(0,20);
  const formats = Object.fromEntries(Object.entries(selected).map(([env,pkg])=>[env,pkg.format]));
  const format = formats.online === formats.irl ? formats.online : null;
  const files = {}, names = {}, manifestFiles = {};
  function add(key,name,value,environment=null,sourceFormat=null) {
    files[key] = {schemaVersion:2,release,format:sourceFormat,...value};
    names[key] = name;
    manifestFiles[key] = {path:name,sha256:digest(files[key]),bytes:Buffer.byteLength(json(files[key])),environment,format:sourceFormat};
  }
  const splitDate=format ? null : (registry.sets || []).flatMap(set=>[set.legality?.online?.value]).filter(value=>value && value<=date).sort().at(-1) || null;
  const core = {formats,currentFormats,...(splitDate?{splitDate}:{}),formatDate:date,calendarRevision:rules.revision,online:selected.online.core,irl:selected.irl.core,archives:{online:{},irl:{}}};
  for (const env of ['online','irl']) for (const [kind,payload] of Object.entries(selected[env].payloads)) add(env+kind,`${env}-${kind.toLowerCase()}.json`,payload,env,formats[env]);
  for (const pkg of archived) {
    const env=pkg.environment;
    if (pkg.format === formats[env]) continue;
    const prefix=`archive:${env}:${pkg.format}:`;
    core.archives[env][pkg.format]={format:pkg.format,generatedAt:pkg.core.generatedAt,formatContext:pkg.core.formatContext,payloadPrefix:prefix,coreKey:prefix+'Core'};
    add(prefix+'Core',`archives/${env}/${pkg.format}/core.json`,pkg.core,env,pkg.format);
    for (const [kind,payload] of Object.entries(pkg.payloads)) add(prefix+kind,`archives/${env}/${pkg.format}/${kind.toLowerCase()}.json`,payload,env,pkg.format);
  }
  add('core','core.json',core,null,format);
  const sourceTimes=[online.generatedAt,irl.generatedAt,deckAggregate.generatedAt,onlineResults.generatedAt].map(value=>new Date(value).getTime()).filter(Number.isFinite);
  const manifest={schemaVersion:2,release,format,formats,formatDate:date,generatedAt:new Date(sourceTimes.length?Math.max(...sourceTimes):0).toISOString(),files:manifestFiles};
  return {manifest,files,names};
}

// Keep the resolver shared with Checkpoint 1, including synthetic test registries.
import formatResolver from '../v2-preview/apps/_shared/format-resolver.js';
const newResolver = registry => formatResolver.create(registry);

async function optional(file,fallback) {
  try { return await readJson(file); } catch(error) { if(error.code==='ENOENT')return fallback; throw error; }
}
async function main() {
  const date = process.env.META_AS_OF || new Date().toISOString().slice(0,10);
  const current = Object.fromEntries(['online','irl'].map(env=>{const context=formatAt(date,env);return [env,context?.contextId?context.label:null]}));
  if (!current.online || !current.irl) throw new Error('Unknown current format; retaining published release');
  const latest = await readJson(path.join(root,'data/meta/current-field.json'));
  // Preserve the complete source package before a transition or later ingest replaces it.
  const fieldsDir=path.join(root,'data/meta/online-fields');
  await fs.mkdir(fieldsDir,{recursive:true});
  const stored=await optional(path.join(fieldsDir,`${latest.format}.json`),null);
  if(!stored || String(latest.generatedAt)>String(stored.generatedAt))await fs.writeFile(path.join(fieldsDir,`${latest.format}.json`),json(latest));
  async function onlineInput(format) {
    const online=await optional(path.join(fieldsDir,`${format}.json`),{format,generatedAt:null,tournaments:[],matchupScopes:{},minTournamentSize:50});
    const deckAggregate=await optional(path.join(root,`data/meta/decks/${format}.json`),{format,decks:[],matchups:[]});
    const onlineResults=await optional(path.join(root,`data/meta/online-results/${format}.json`),{format,events:[]});
    return {online,deckAggregate,onlineResults};
  }
  async function irlInput(format) {return {irl:await optional(path.join(root,`data/meta/irl/${format}.json`),{format,generatedAt:null,events:[],decks:[],results:[],matchups:[],note:'No evidence yet for this format.'})};}
  const archives=[];
  for(const file of await fs.readdir(fieldsDir))if(file.endsWith('.json')&&file!==`${current.online}.json`)archives.push({environment:'online',...await onlineInput(file.slice(0,-5))});
  for(const file of await fs.readdir(path.join(root,'data/meta/irl')))if(file.endsWith('.json')&&file!==`${current.irl}.json`)archives.push({environment:'irl',...await irlInput(file.slice(0,-5))});
  const built=buildRelease({...await onlineInput(current.online),...await irlInput(current.irl),archives,asOf:date});
  await fs.mkdir(outputDir,{recursive:true});
  for(const [key,value] of Object.entries(built.files)) {
    const target=path.join(outputDir,built.names[key]);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,json(value));
  }
  await fs.writeFile(path.join(outputDir,'manifest.json'),json(built.manifest));
  const blend=await loadBlendEngine(path.join(root,'v2-preview/apps/_shared/meta-blend.js'));
  const snapshots=await archiveSnapshots({built,blend,directory:path.join(root,'data/meta/prediction-snapshots'),publishedAt:process.env.META_PUBLISHED_AT || new Date().toISOString()});
  console.log(`Built Meta release ${built.manifest.release}: Online ${current.online}, IRL ${current.irl}; ${archives.length} retained source archives; ${snapshots.length} prediction snapshot(s)`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))main();
