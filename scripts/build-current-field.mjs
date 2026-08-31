import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://play.limitlesstcg.com/api';
const GAME = 'PTCG';
const FORMAT = 'STANDARD';
const FORMAT_ID = 'TEF-PBL';
const FORMAT_LABEL = 'TEF–PBL';
const FORMAT_START = '2026-07-17T00:00:00Z';
const MIN_PLAYERS = 50;
const CONCURRENCY = 8;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const DAY = 86400000;

const root = process.cwd();
const outputFile = path.join(root, 'data', 'meta', 'current-field.json');
const archiveFile = path.join(root, 'data', 'meta', 'online-events', `${FORMAT_ID}.json`);
const aggregateFile = path.join(root, 'data', 'meta', 'decks', `${FORMAT_ID}.json`);
const irlFile = path.join(root, 'data', 'meta', 'irl', `${FORMAT_ID}.json`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      const row = matchups.get(key) || { a:left, b:right, wins:0, losses:0, ties:0, games:0 };
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
  const raw = await readJson(irlFile, { events:[] });
  const events = (raw?.events || []).filter(e => Number.isFinite(new Date(e.date).getTime())).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!events.length) return null;
  const latestWeek = isoWeekKey(events[0].date);
  const weekend = events.filter(e => isoWeekKey(e.date) === latestWeek);
  const latestDate = Math.max(...weekend.map(e=>new Date(e.date).getTime()));
  const cutoff = endOfIsoWeek(latestDate);
  if (!Number.isFinite(cutoff)) return null;
  return { week:latestWeek, cutoff, cutoffIso:new Date(cutoff).toISOString(), events:weekend.map(e=>({id:String(e.id),name:e.name||'IRL major',date:e.date})) };
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

const [index, majorWeekend, previousField, previousArchive, fullAggregate] = await Promise.all([
  tournamentIndex(), latestMajorWeekend(), readJson(outputFile, null), readJson(archiveFile, null), readJson(aggregateFile, null),
]);
console.log(`Found ${index.length} qualifying ${FORMAT_ID} online tournaments.`);
if (majorWeekend) console.log(`Post-major scope starts ${majorWeekend.cutoffIso} after ${majorWeekend.events.map(e=>e.name).join(' + ')}`);

const archiveMap = new Map((previousArchive?.events || []).map(e => [String(e.id), e]));
const previousFieldMap = new Map((previousField?.tournaments || []).map(e => [String(e.id), e]));
const newestTs = Math.max(0, ...index.map(t=>new Date(t.date).getTime()).filter(Number.isFinite));
const recentFloor = Math.min(
  newestTs ? newestTs - 31*DAY : Date.now()-31*DAY,
  Number.isFinite(majorWeekend?.cutoff) ? majorWeekend.cutoff : Infinity,
);

// Pairings are only required for rolling scopes. Bootstrap/backfill just the rolling
// window; older all-format matchup evidence comes from the existing full aggregate.
const needDetailed = index.filter(t => {
  const id = String(t.id);
  if (archiveMap.has(id)) return false;
  const ts = new Date(t.date).getTime();
  return Number.isFinite(ts) && ts >= recentFloor;
});
console.log(`Detailed matchup fetch: ${needDetailed.length} tournament(s); ${archiveMap.size} already archived.`);

const fetched = await mapConcurrent(needDetailed, CONCURRENCY, async (tournament, i) => {
  try {
    const [standings,pairings] = await Promise.all([
      get(`/tournaments/${encodeURIComponent(tournament.id)}/standings`),
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

// Preserve existing compact field history; add field data for any truly new tournament.
// Detailed fetches already include standings, so normally this costs no extra requests.
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
    const standings = await get(`/tournaments/${encodeURIComponent(tournament.id)}/standings`);
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

const indexIds = new Set(index.map(t=>String(t.id)));
const fieldEvents = [...fieldMap.values()].filter(e=>indexIds.has(String(e.id))).sort((a,b)=>new Date(b.date)-new Date(a.date));
const archivedEvents = [...archiveMap.values()].filter(e=>indexIds.has(String(e.id))).sort((a,b)=>new Date(b.date)-new Date(a.date));
if (!fieldEvents.length) throw new Error('No compact Online field history available');

const matchupScopes = {
  '14':matchupBucket(eventsForScope(archivedEvents,'14',majorWeekend)),
  '30':matchupBucket(eventsForScope(archivedEvents,'30',majorWeekend)),
  'since-major':matchupBucket(eventsForScope(archivedEvents,'since-major',majorWeekend)),
  all:fullAggregateBucket(fullAggregate),
};

const generatedAt = new Date().toISOString();
const payload = {
  schemaVersion:5, generatedAt, source:'play.limitlesstcg.com', format:FORMAT_ID, label:FORMAT_LABEL,
  formatStart:FORMAT_START, minTournamentSize:MIN_PLAYERS, tournamentCount:fieldEvents.length,
  majorWeekend:majorWeekend ? {week:majorWeekend.week,cutoff:majorWeekend.cutoffIso,events:majorWeekend.events}:null,
  matchupScopes, tournaments:fieldEvents,
};
const archivePayload = {
  schemaVersion:1, generatedAt, format:FORMAT_ID, formatStart:FORMAT_START,
  note:'Incremental per-tournament matchup archive for rolling Online Meta scopes.',
  events:archivedEvents,
};

await fs.mkdir(path.dirname(outputFile),{recursive:true});
await fs.mkdir(path.dirname(archiveFile),{recursive:true});
await Promise.all([
  fs.writeFile(outputFile,JSON.stringify(payload)),
  fs.writeFile(archiveFile,JSON.stringify(archivePayload)),
]);

console.log(`Wrote ${outputFile}: ${fieldEvents.length} field tournaments; ${archivedEvents.length} detailed archived tournaments.`);
for (const [scope,bucket] of Object.entries(matchupScopes)) console.log(`Matchups ${scope}: ${bucket.overview.events} events · ${bucket.overview.matches} matches · ${bucket.matchups.length} rows`);
