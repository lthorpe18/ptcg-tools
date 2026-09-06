import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMAT = 'TEF-PBL';
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
  return { id:String(event.id), name:event.name || '', date:event.date, players:Number(event.players || 0) };
}

export function buildRelease({ online, irl, deckAggregate, onlineResults }) {
  const versionSeed = {
    schemaVersion:1,
    online:digest(online),
    irl:digest(irl),
    deckAggregate:digest(deckAggregate),
    onlineResults:digest(onlineResults),
  };
  const release = digest(versionSeed).slice(0, 20);
  const onlineScopes = {};
  for (const scope of SCOPES) {
    const events = eventsForScope(online, scope);
    onlineScopes[scope] = { ...aggregateField(events), events:events.map(eventSummary) };
  }

  const irlEvents = (irl.events || []).map(event => {
    const { results, matchups, ...core } = event;
    return core;
  });
  const files = {
    core:{
      schemaVersion:1, release, format:FORMAT,
      online:{
        generatedAt:online.generatedAt,
        label:online.label,
        formatStart:online.formatStart,
        minTournamentSize:online.minTournamentSize,
        majorWeekend:online.majorWeekend || null,
        scopes:onlineScopes,
        records:{
          rotation:deckAggregate.rotation || 2026,
          set:deckAggregate.set || 'PBL',
          decks:(deckAggregate.decks || []).map(deck => ({ name:deck.name, slug:deck.slug || '' })),
        },
      },
      irl:{
        generatedAt:irl.generatedAt,
        source:irl.source,
        sourceUrl:irl.sourceUrl,
        events:irlEvents,
        decks:Array.isArray(irl.decks) ? irl.decks : [],
        note:irl.note || '',
      },
    },
    onlineHistory:{ schemaVersion:1, release, format:FORMAT, tournaments:online.tournaments || [] },
    onlineMatchups:{
      schemaVersion:1, release, format:FORMAT,
      scopes:{
        ...online.matchupScopes,
        all:{
          overview:{ events:Number(deckAggregate?.overview?.tournaments || online.matchupScopes?.all?.overview?.events || 0), matches:Number(deckAggregate?.overview?.matches || online.matchupScopes?.all?.overview?.matches || 0) },
          matchups:Array.isArray(deckAggregate?.matchups) ? deckAggregate.matchups : (online.matchupScopes?.all?.matchups || []),
        },
      },
    },
    onlineResults:{ schemaVersion:1, release, format:FORMAT, results:onlineResults.results || (onlineResults.events || []).flatMap(event => event.results || []) },
    irlMatchups:{ schemaVersion:1, release, format:FORMAT, matchups:irl.matchups || [] },
    irlResults:{ schemaVersion:1, release, format:FORMAT, results:irl.results || [] },
  };

  const names = {
    core:'core.json', onlineHistory:'online-history.json', onlineMatchups:'online-matchups.json',
    onlineResults:'online-results.json', irlMatchups:'irl-matchups.json', irlResults:'irl-results.json',
  };
  const manifestFiles = {};
  for (const [key, value] of Object.entries(files)) {
    manifestFiles[key] = { path:names[key], sha256:digest(value), bytes:Buffer.byteLength(json(value)) };
  }
  const sourceTimes = [online.generatedAt, irl.generatedAt, deckAggregate.generatedAt, onlineResults.generatedAt]
    .map(value => new Date(value).getTime()).filter(Number.isFinite);
  const manifest = {
    schemaVersion:1, release, format:FORMAT,
    generatedAt:new Date(sourceTimes.length ? Math.max(...sourceTimes) : 0).toISOString(),
    files:manifestFiles,
  };
  return { manifest, files, names };
}

async function main() {
  const [online, irl, deckAggregate, onlineResults] = await Promise.all([
    readJson(path.join(root, 'data', 'meta', 'current-field.json')),
    readJson(path.join(root, 'data', 'meta', 'irl', `${FORMAT}.json`)),
    readJson(path.join(root, 'data', 'meta', 'decks', `${FORMAT}.json`)),
    readJson(path.join(root, 'data', 'meta', 'online-results', `${FORMAT}.json`)).catch(() => ({ generatedAt:'', results:[] })),
  ]);
  const release = buildRelease({ online, irl, deckAggregate, onlineResults });
  await fs.mkdir(outputDir, { recursive:true });
  await Promise.all(Object.entries(release.files).map(([key, value]) => fs.writeFile(path.join(outputDir, release.names[key]), json(value))));
  await fs.writeFile(path.join(outputDir, 'manifest.json'), json(release.manifest));
  console.log(`Built Meta release ${release.manifest.release}`);
  for (const [key, file] of Object.entries(release.manifest.files)) console.log(`${key}: ${file.bytes} bytes`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
