import fs from 'node:fs/promises';
import path from 'node:path';
import { loadPublishedConfig, resolveCurrentFormats } from './lib/format-config.mjs';

const BASE = 'https://play.limitlesstcg.com/api';
const GAME = 'PTCG';
const FORMAT = 'STANDARD';
const MIN_PLAYERS = 50;
const CONCURRENCY = 8;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const DAY = 86400000;
const BOOTSTRAP_DAYS = 7;
const RESULT_TOURNAMENTS = 36;

const runtimeConfig = await loadPublishedConfig();
const resolvedFormats = resolveCurrentFormats(runtimeConfig, new Date());
if (!resolvedFormats.online) throw new Error('No current Online Standard format can be resolved');
const onlineFormat = resolvedFormats.online;
const FORMAT_ID = onlineFormat.id;
const FORMAT_LABEL = onlineFormat.label;
const FORMAT_START = `${onlineFormat.startDate}T00:00:00Z`;

const root = process.cwd();
const outputFile = path.join(root, 'data', 'meta', 'current-field.json');
const archiveFile = path.join(root, 'data', 'meta', 'online-events', `${FORMAT_ID}.json`);
const aggregateFile = path.join(root, 'data', 'meta', 'decks', `${FORMAT_ID}.json`);
const resultsFile = path.join(root, 'data', 'meta', 'online-results', `${FORMAT_ID}.json`);
const irlFiles = [resolvedFormats.irl, resolvedFormats.previousIrl]
  .filter(Boolean)
  .filter((format, index, rows) => rows.findIndex(row => row.id === format.id) === index)
  .map(format => ({ format, file:path.join(root, 'data', 'meta', 'irl', `${format.id}.json`) }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const standingsPromises = new Map();

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function get(pathname, attempt = 0) {
  const response = await fetch(BASE + pathname, { headers: { Accept: 'application/json' } });
  if (response.status === 429 && attempt < 7) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 750 * (2 ** attempt));
    await sleep(waitMs);
    return get(pathname, attempt + 1);
  }
  if (!response.ok) throw new Error(`Limitless API ${response.status}: ${pathname}`);
  return response.json();
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, worker));
  return results;
}

function standingsFor(tournamentId) {
  const id = String(tournamentId);
  if (!standingsPromises.has(id)) standingsPromises.set(id, get(`/tournaments/${encodeURIComponent(id)}/standings`));
  return standingsPromises.get(id);
}

async function tournamentIndex() {
  const cutoff = new Date(FORMAT_START).getTime();
  const unique = new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await get(`/tournaments?game=${GAME}&format=${FORMAT}&limit=${PAGE_SIZE}&page=${page}`);
    if (!Array.isArray(rows) || !rows.length) break;
    for (const tournament of rows) unique.set(String(tournament.id), tournament);
    const dates = rows.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
    if ((dates.length && Math.min(...dates) < cutoff) || rows.length < PAGE_SIZE) break;
  }
  return [...unique.values()]
    .filter(t => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= cutoff && Number(t.players || 0) >= MIN_PLAYERS;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function compactTournament(tournament, standings, pairings) {
  const archetypes = new Map();
  const deckByPlayer = new Map();
  for (const standing of standings || []) {
    const name = standing?.deck?.name;
    if (!name || name === 'Other' || name === 'Unknown') continue;
    if (standing.player != null) deckByPlayer.set(standing.player, name);
    const row = archetypes.get(name) || { name, entries: 0, wins: 0, losses: 0, ties: 0 };
    row.entries += 1;
    row.wins += Number(standing.record?.wins || 0);
    row.losses += Number(standing.record?.losses || 0);
    row.ties += Number(standing.record?.ties || 0);
    archetypes.set(name, row);
  }
  if (!archetypes.size) return null;

  const matchups = new Map();
  let matchCount = 0;
  for (const pairing of pairings || []) {
    if (!pairing?.player1 || !pairing?.player2 || pairing.winner === -1) continue;
    const a = deckByPlayer.get(pairing.player1);
    const b = deckByPlayer.get(pairing.player2);
    if (!a || !b) continue;
    matchCount += 1;
    const add = (left, right, outcome) => {
      const key = `${left}|||${right}`;
      const row = matchups.get(key) || { a:left, b:right, wins:0,losses:0,ties:0,games:0 };
      row.games += 1;
      row[outcome] += 1;
      matchups.set(key, row);
    };
    if (pairing.winner === 0) {
      add(a,b,'ties'); add(b,a,'ties');
    } else if (pairing.winner === pairing.player1) {
      add(a,b,'wins'); add(b,a,'losses');
    } else if (pairing.winner === pairing.player2) {
      add(a,b,'losses'); add(b,a,'wins');
    }
  }

  return {
    id: String(tournament.id), name: tournament.name || '', date: tournament.date,
    players: Number(tournament.players || 0),
    archetypes: [...archetypes.values()].sort((a, b) => b.entries - a.entries),
    matchups: [...matchups.values()], matchCount,
  };
}

function compactResultEvent(tournament, standings) {
  const results = [];
  for (const standing of standings || []) {
    const archetype = standing?.deck?.name;
    const placing = Number(standing?.placing);
    if (ignoredArchetype(archetype) || !Number.isFinite(placing) || placing <= 0) continue;
    results.push({
      archetype,
      placing,
      player:standing.name || standing.player || 'Unknown player',
      tournament:tournament.name || '',
      eventId:String(tournament.id),
      date:tournament.date,
      players:Number(tournament.players || 0),
      record:{
        wins:Number(standing.record?.wins || 0),
        losses:Number(standing.record?.losses || 0),
        ties:Number(standing.record?.ties || 0),
      },
    });
  }
  return { id:String(tournament.id), name:tournament.name || '', date:tournament.date, players:Number(tournament.players || 0), results };
}

function ignoredArchetype(name) {
  return !name || name === 'Other' || name === 'Unknown';
}

function isoWeekKey(value) {
  const d = new Date(value);
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - day);
  const year = u.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year,0,1));
  const week = Math.ceil((((u-yearStart)/DAY)+1)/7);
  return `${year}-W${String(week).padStart(2,'0')}`;
}

function endOfIsoWeek(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const day = d.getUTCDay() || 7;
  const mondayAfter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  mondayAfter.setUTCDate(mondayAfter.getUTCDate() + (8-day));
  return mondayAfter.getTime();
}

async function latestMajorWeekend() {
  const candidates = [];
  for (const entry of irlFiles) {
    const raw = await readJson(entry.file, { events:[] });
    for (const event of raw?.events || []) {
      if (!Number.isFinite(new Date(event.date).getTime())) continue;
      candidates.push({ ...event, formatId:entry.format.id });
    }
  }
  candidates.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!candidates.length) return null;
  const latestWeek = isoWeekKey(candidates[0].date);
  const weekend = candidates.filter(e => isoWeekKey(e.date) === latestWeek);
  const latestDate = Math.max(...weekend.map(e=>new Date(e.date).getTime()));
  const cutoff = endOfIsoWeek(latestDate);
  if (!Number.isFinite(cutoff)) return null;
  return {
    week:latestWeek,
    cutoff,
    cutoffIso:new Date(cutoff).toISOString(),
    formatId:weekend[0]?.formatId || null,
    events:weekend.map(e=>({id:String(e.id),name:e.name||'IRL major',date:e.date,formatId:e.formatId})),
  };
}

function eventsForScope(events, scope, majorWeekend = null) {
  if (scope === 'all') return events;
  if (scope === 'since-major') {
    if (!Number.isFinite(majorWeekend?.cutoff)) return [];
    return events.filter(e => new Date(e.date).getTime() >= majorWeekend.cutoff);
  }
  const newest = Math.max(0, ...events.map(e=>new Date(e.date).getTime()).filter(Number.isFinite));
  if (!newest) return [];
  const cutoff = newest - Number(scope) * DAY;
  return events.filter(e => new Date(e.date).getTime() >= cutoff);
}

function matchupBucket(events) {
  const map = new Map();
  let matches = 0;
  for (const event of events) {
    matches += Number(event.matchCount || 0);
    for (const m of event.matchups || []) {
      const key = `${m.a}|||${m.b}`;
      const row = map.get(key) || { a:m.a,b:m.b,wins:0,losses:0,ties:0,games:0 };
      row.wins += Number(m.wins||0); row.losses += Number(m.losses||0); row.ties += Number(m.ties||0); row.games += Number(m.games||0);
      map.set(key,row);
    }
  }
  return { overview:{events:events.length,matches}, matchups:[...map.values()].sort((a,b)=>b.games-a.games) };
}

function fullAggregateBucket(raw) {
  return {
    overview:{ events:Number(raw?.overview?.tournaments||0), matches:Number(raw?.overview?.matches||0) },
    matchups:Array.isArray(raw?.matchups) ? raw.matchups : [],
  };
}

const [index, majorWeekend, previousField, previousArchive, fullAggregate, previousResults] = await Promise.all([
  tournamentIndex(), latestMajorWeekend(), readJson(outputFile, null), readJson(archiveFile, null), readJson(aggregateFile, null), readJson(resultsFile, { events:[] }),
]);
console.log(`Resolved Online ${FORMAT_ID} (${FORMAT_START}); IRL ${resolvedFormats.irl?.id || 'unresolved'}; config ${runtimeConfig.source} v${runtimeConfig.formatRegistryVersion}.`);
console.log(`Found ${index.length} qualifying ${FORMAT_ID} online tournaments.`);
if (majorWeekend) console.log(`Post-major scope starts ${majorWeekend.cutoffIso} after ${majorWeekend.events.map(e=>e.name).join(' + ')}`);

const archiveMap = new Map((previousArchive?.events || []).map(e => [String(e.id), e]));
const previousFieldMap = new Map(previousField?.format === FORMAT_ID ? (previousField?.tournaments || []).map(e => [String(e.id), e]) : []);
const newestTs = Math.max(0, ...index.map(t=>new Date(t.date).getTime()).filter(Number.isFinite));

const previousCoverage = new Date(previousArchive?.coverageStart || '').getTime();
const existingArchiveDates = [...archiveMap.values()].map(e => new Date(e.date).getTime()).filter(Number.isFinite);
const inferredCoverage = existingArchiveDates.length ? Math.min(...existingArchiveDates) : NaN;
const bootstrapCoverage = newestTs ? newestTs - BOOTSTRAP_DAYS * DAY : Date.now() - BOOTSTRAP_DAYS * DAY;
const coverageStart = Number.isFinite(previousCoverage)
  ? previousCoverage
  : Number.isFinite(inferredCoverage)
    ? inferredCoverage
    : bootstrapCoverage;

const needDetailed = index.filter(t => {
  const id = String(t.id);
  if (archiveMap.has(id)) return false;
  const ts = new Date(t.date).getTime();
  return Number.isFinite(ts) && ts >= coverageStart;
});
console.log(`Detailed matchup fetch: ${needDetailed.length} tournament(s); ${archiveMap.size} already archived; coverage starts ${new Date(coverageStart).toISOString()}.`);

const fetched = await mapConcurrent(needDetailed, CONCURRENCY, async (tournament, i) => {
  try {
    const [standings,pairings] = await Promise.all([
      standingsFor(tournament.id),
      get(`/tournaments/${encodeURIComponent(tournament.id)}/pairings`),
    ]);
    const compact = compactTournament(tournament,standings,pairings);
    console.log(`${i+1}/${needDetailed.length} ${tournament.date} ${tournament.name}: ${compact?.matchCount||0} matches`);
    return compact;
  } catch (error) {
    console.warn(`Skipping detailed ${tournament.id}: ${error.message}`);
    return null;
  }
});
for (const event of fetched.filter(Boolean)) archiveMap.set(String(event.id), event);

const fieldMap = new Map(previousFieldMap);
for (const event of archiveMap.values()) {
  if (!fieldMap.has(String(event.id))) {
    const {matchups,matchCount,...fieldEvent}=event;
    fieldMap.set(String(event.id),fieldEvent);
  }
}
const missingField = index.filter(t => !fieldMap.has(String(t.id)));
if (missingField.length) console.log(`Field-only fetch: ${missingField.length} tournament(s).`);
const fieldFetched = await mapConcurrent(missingField, CONCURRENCY, async tournament => {
  try {
    const standings = await standingsFor(tournament.id);
    const compact = compactTournament(tournament,standings,[]);
    if (!compact) return null;
    const {matchups,matchCount,...fieldEvent}=compact;
    return fieldEvent;
  } catch (error) {
    console.warn(`Skipping field ${tournament.id}: ${error.message}`);
    return null;
  }
});
for (const event of fieldFetched.filter(Boolean)) fieldMap.set(String(event.id),event);

const previousResultMap = new Map((previousResults?.events || []).map(event => [String(event.id), event]));
const resultTargets = index.slice(0, RESULT_TOURNAMENTS);
const missingResults = resultTargets.filter(tournament => !previousResultMap.has(String(tournament.id)));
if (missingResults.length) console.log(`Result fetch: ${missingResults.length} tournament(s); retaining the latest ${RESULT_TOURNAMENTS}.`);
const fetchedResults = await mapConcurrent(missingResults, CONCURRENCY, async tournament => {
  try {
    return compactResultEvent(tournament, await standingsFor(tournament.id));
  } catch (error) {
    console.warn(`Skipping results ${tournament.id}: ${error.message}`);
    return null;
  }
});
for (const event of fetchedResults.filter(Boolean)) previousResultMap.set(String(event.id), event);
const resultEvents = resultTargets.map(tournament => previousResultMap.get(String(tournament.id))).filter(Boolean);

const indexIds = new Set(index.map(t=>String(t.id)));
const fieldEvents = [...fieldMap.values()].filter(e=>indexIds.has(String(e.id))).sort((a,b)=>new Date(b.date)-new Date(a.date));
const archivedEvents = [...archiveMap.values()].filter(e=>indexIds.has(String(e.id)) && new Date(e.date).getTime() >= coverageStart).sort((a,b)=>new Date(b.date)-new Date(a.date));
if (!fieldEvents.length) throw new Error(`No compact Online field history available for ${FORMAT_ID}`);

const matchupScopes = {
  '14':matchupBucket(eventsForScope(archivedEvents,'14',majorWeekend)),
  '30':matchupBucket(eventsForScope(archivedEvents,'30',majorWeekend)),
  'since-major':matchupBucket(eventsForScope(archivedEvents,'since-major',majorWeekend)),
  all:fullAggregateBucket(fullAggregate),
};

const generatedAt = new Date().toISOString();
const payload = {
  schemaVersion:7, generatedAt, source:'play.limitlesstcg.com', format:FORMAT_ID, label:FORMAT_LABEL,
  formatStart:FORMAT_START, minTournamentSize:MIN_PLAYERS, tournamentCount:fieldEvents.length,
  formatConfig:{ registryVersion:runtimeConfig.formatRegistryVersion, source:runtimeConfig.source, online:onlineFormat, irl:resolvedFormats.irl || null },
  rollingMatchupCoverageStart:new Date(coverageStart).toISOString(),
  majorWeekend:majorWeekend ? {week:majorWeekend.week,cutoff:majorWeekend.cutoffIso,formatId:majorWeekend.formatId,events:majorWeekend.events}:null,
  matchupScopes, tournaments:fieldEvents,
};
const archivePayload = {
  schemaVersion:3, generatedAt, format:FORMAT_ID, formatStart:FORMAT_START,
  minimumPlayers:MIN_PLAYERS, bootstrapDays:BOOTSTRAP_DAYS,
  coverageStart:new Date(coverageStart).toISOString(),
  note:'Append-only per-tournament matchup archive. Bootstrap begins with 7 days; daily refreshes add every unseen qualifying tournament from coverageStart onward.',
  events:archivedEvents,
};
const resultsPayload = {
  schemaVersion:2,
  generatedAt,
  format:FORMAT_ID,
  tournamentLimit:RESULT_TOURNAMENTS,
  note:'Recent Online placement evidence collected centrally. Browsers do not query Limitless tournament standings.',
  events:resultEvents,
};

await fs.mkdir(path.dirname(outputFile),{recursive:true});
await fs.mkdir(path.dirname(archiveFile),{recursive:true});
await fs.mkdir(path.dirname(resultsFile),{recursive:true});
await Promise.all([
  fs.writeFile(outputFile,JSON.stringify(payload)),
  fs.writeFile(archiveFile,JSON.stringify(archivePayload)),
  fs.writeFile(resultsFile,JSON.stringify(resultsPayload)),
]);

console.log(`Wrote ${outputFile}: ${fieldEvents.length} field tournaments; ${archivedEvents.length} detailed archived tournaments.`);
for (const [scope,bucket] of Object.entries(matchupScopes)) console.log(`Matchups ${scope}: ${bucket.overview.events} events · ${bucket.overview.matches} matches · ${bucket.matchups.length} rows`);
console.log(`Results: ${resultEvents.reduce((sum, event) => sum + (event.results || []).length, 0)} placements from ${resultEvents.length} recent tournaments.`);
