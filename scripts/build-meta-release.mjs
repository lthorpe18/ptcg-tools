import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublishedConfig, resolveCurrentFormats } from './lib/format-config.mjs';

const SCOPES = ['14', '30', 'since-major', 'all'];
const root = process.cwd();
const outputDir = path.join(root, 'v2-preview', 'data', 'meta', 'release');

const readJson = async (file, fallback = null) => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
};
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
  return { id:String(event.id), name:event.name || '', date:event.date, players:Number(event.players || 0) };
}

function compactIrl(raw, format) {
  const events = (raw?.events || []).map(event => {
    const { results, matchups, ...core } = event;
    return core;
  });
  return {
    format:format?.id || raw?.format || null,
    generatedAt:raw?.generatedAt || null,
    source:raw?.source || null,
    sourceUrl:raw?.sourceUrl || '',
    events,
    decks:Array.isArray(raw?.decks) ? raw.decks : [],
    note:raw?.note || '',
  };
}

function compactSets(sets) {
  return (sets || []).map(set => ({
    setCode:set.setCode,
    setTitle:set.setTitle,
    releaseOrder:Number(set.releaseOrder || 0),
    onlineLegalDate:set.onlineLegalDate || null,
    irlLegalDate:set.irlLegalDate || null,
    isRotationSet:!!set.isRotationSet,
    rotationLowerSetCode:set.rotationLowerSetCode || null,
  }));
}

export function buildRelease({ online, irl, deckAggregate, onlineResults, runtimeConfig = null, formats = null, previousIrl = null }) {
  const formatId = formats?.online?.id || online?.format || 'TEF-PBL';
  const configSummary = runtimeConfig ? {
    source:runtimeConfig.source,
    registryVersion:Number(runtimeConfig.formatRegistryVersion || 0),
    registryId:runtimeConfig.formatRegistryId || null,
    formatPublishedAt:runtimeConfig.formatPublishedAt || null,
    sets:compactSets(runtimeConfig.sets),
    onlineFormat:formats?.online || null,
    irlFormat:formats?.irl || null,
    previousOnlineFormat:formats?.previousOnline || null,
    previousIrlFormat:formats?.previousIrl || null,
    formula:runtimeConfig.liveFormula || null,
    formulaActivatedAt:runtimeConfig.formulaActivatedAt || null,
  } : null;
  const versionSeed = {
    schemaVersion:2,
    format:formatId,
    config:configSummary ? digest(configSummary) : null,
    online:digest(online),
    irl:digest(irl),
    previousIrl:digest(previousIrl),
    deckAggregate:digest(deckAggregate),
    onlineResults:digest(onlineResults),
  };
  const release = digest(versionSeed).slice(0, 20);
  const onlineScopes = {};
  for (const scope of SCOPES) {
    const events = eventsForScope(online, scope);
    onlineScopes[scope] = { ...aggregateField(events), events:events.map(eventSummary) };
  }

  const currentIrl = compactIrl(irl || {}, formats?.irl || null);
  const priorIrl = previousIrl ? compactIrl(previousIrl, formats?.previousIrl || null) : null;
  const files = {
    core:{
      schemaVersion:2, release, format:formatId, config:configSummary,
      online:{
        format:formats?.online?.id || online?.format || formatId,
        generatedAt:online.generatedAt,
        label:online.label,
        formatStart:online.formatStart,
        minTournamentSize:online.minTournamentSize,
        majorWeekend:online.majorWeekend || null,
        scopes:onlineScopes,
        records:{
          rotation:deckAggregate?.rotation || formats?.online?.rotationYear || 2026,
          set:deckAggregate?.set || formats?.online?.upperSetCode || 'PBL',
          decks:(deckAggregate?.decks || []).map(deck => ({ name:deck.name, slug:deck.slug || '' })),
        },
      },
      irl:{ ...currentIrl, previous:priorIrl },
    },
    onlineHistory:{ schemaVersion:2, release, format:formatId, tournaments:online.tournaments || [] },
    onlineMatchups:{
      schemaVersion:2, release, format:formatId,
      scopes:{
        ...online.matchupScopes,
        all:{
          overview:{ events:Number(deckAggregate?.overview?.tournaments || online.matchupScopes?.all?.overview?.events || 0), matches:Number(deckAggregate?.overview?.matches || online.matchupScopes?.all?.overview?.matches || 0) },
          matchups:Array.isArray(deckAggregate?.matchups) ? deckAggregate.matchups : (online.matchupScopes?.all?.matchups || []),
        },
      },
    },
    onlineResults:{ schemaVersion:2, release, format:formatId, results:onlineResults.results || (onlineResults.events || []).flatMap(event => event.results || []) },
    irlMatchups:{ schemaVersion:2, release, format:formatId, irlFormat:currentIrl.format, matchups:irl?.matchups || [] },
    irlResults:{ schemaVersion:2, release, format:formatId, irlFormat:currentIrl.format, results:irl?.results || [] },
  };

  const names = {
    core:'core.json', onlineHistory:'online-history.json', onlineMatchups:'online-matchups.json',
    onlineResults:'online-results.json', irlMatchups:'irl-matchups.json', irlResults:'irl-results.json',
  };
  const manifestFiles = {};
  for (const [key, value] of Object.entries(files)) {
    manifestFiles[key] = { path:names[key], sha256:digest(value), bytes:Buffer.byteLength(json(value)) };
  }
  const sourceTimes = [online.generatedAt, irl?.generatedAt, deckAggregate?.generatedAt, onlineResults?.generatedAt]
    .map(value => new Date(value).getTime()).filter(Number.isFinite);
  const manifest = {
    schemaVersion:1, release, format:formatId,
    generatedAt:new Date(sourceTimes.length ? Math.max(...sourceTimes) : 0).toISOString(),
    files:manifestFiles,
  };
  return { manifest, files, names };
}

async function main() {
  const runtimeConfig = await loadPublishedConfig();
  const formats = resolveCurrentFormats(runtimeConfig, new Date());
  if (!formats.online || !formats.irl) throw new Error('Unable to resolve current Online/IRL formats');
  const [online, irl, previousIrl, deckAggregate, onlineResults] = await Promise.all([
    readJson(path.join(root, 'data', 'meta', 'current-field.json')),
    readJson(path.join(root, 'data', 'meta', 'irl', `${formats.irl.id}.json`), { generatedAt:null, format:formats.irl.id, events:[], decks:[], matchups:[], results:[] }),
    formats.previousIrl && formats.previousIrl.id !== formats.irl.id
      ? readJson(path.join(root, 'data', 'meta', 'irl', `${formats.previousIrl.id}.json`), null)
      : Promise.resolve(null),
    readJson(path.join(root, 'data', 'meta', 'decks', `${formats.online.id}.json`), { generatedAt:null, format:formats.online.id, decks:[], matchups:[], overview:{} }),
    readJson(path.join(root, 'data', 'meta', 'online-results', `${formats.online.id}.json`), { generatedAt:'', results:[] }),
  ]);
  if (!online) throw new Error(`Current Online field is missing for ${formats.online.id}`);
  const built = buildRelease({ online, irl, previousIrl, deckAggregate, onlineResults, runtimeConfig, formats });
  await fs.mkdir(outputDir, { recursive:true });
  await Promise.all(Object.entries(built.files).map(([key, value]) => fs.writeFile(path.join(outputDir, built.names[key]), json(value))));
  await fs.writeFile(path.join(outputDir, 'manifest.json'), json(built.manifest));
  console.log(`Built Meta release ${built.manifest.release} · Online ${formats.online.id} · IRL ${formats.irl.id} · ${runtimeConfig.liveFormula.versionKey}`);
  for (const [key, file] of Object.entries(built.manifest.files)) console.log(`${key}: ${file.bytes} bytes`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
