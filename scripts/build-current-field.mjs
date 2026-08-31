import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://play.limitlesstcg.com/api';
const GAME = 'PTCG';
const FORMAT = 'STANDARD';
const FORMAT_ID = 'TEF-PBL';
const FORMAT_LABEL = 'TEF–PBL';
const FORMAT_START = '2026-07-17T00:00:00Z';
const MIN_PLAYERS = 50;
const CONCURRENCY = 6;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const outputFile = path.join(process.cwd(), 'data', 'meta', 'current-field.json');
const irlFile = path.join(process.cwd(), 'data', 'meta', 'irl', `${FORMAT_ID}.json`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(pathname, attempt = 0) {
  const response = await fetch(BASE + pathname, { headers: { Accept: 'application/json' } });
  if (response.status === 429 && attempt < 6) {
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
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
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
    id: String(tournament.id),
    name: tournament.name || '',
    date: tournament.date,
    players: Number(tournament.players || 0),
    archetypes: [...archetypes.values()].sort((a, b) => b.entries - a.entries),
    matchups: [...matchups.values()],
    matchCount,
  };
}

function isoWeekKey(value) {
  const d = new Date(value);
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - day);
  const year = u.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((u - yearStart) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function endOfIsoWeek(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const day = d.getUTCDay() || 7;
  const mondayAfter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  mondayAfter.setUTCDate(mondayAfter.getUTCDate() + (8 - day));
  return mondayAfter.getTime();
}

async function latestMajorWeekend() {
  try {
    const raw = JSON.parse(await fs.readFile(irlFile, 'utf8'));
    const events = (raw?.events || [])
      .filter(e => Number.isFinite(new Date(e.date).getTime()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!events.length) return null;
    const latestWeek = isoWeekKey(events[0].date);
    const weekend = events.filter(e => isoWeekKey(e.date) === latestWeek);
    const latestDate = Math.max(...weekend.map(e => new Date(e.date).getTime()));
    const cutoff = endOfIsoWeek(latestDate);
    if (!Number.isFinite(cutoff)) return null;
    return {
      week: latestWeek,
      cutoff,
      cutoffIso: new Date(cutoff).toISOString(),
      events: weekend.map(e => ({ id:String(e.id), name:e.name || 'IRL major', date:e.date })),
    };
  } catch (error) {
    console.warn(`IRL major cutoff unavailable: ${error.message}`);
    return null;
  }
}

function eventsForScope(tournaments, scope, majorWeekend = null) {
  if (scope === 'all') return tournaments;
  if (scope === 'since-major') {
    if (!Number.isFinite(majorWeekend?.cutoff)) return [];
    return tournaments.filter(t => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= majorWeekend.cutoff;
    });
  }
  const dates = tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
  if (!dates.length) return [];
  const newest = Math.max(...dates);
  const cutoff = newest - Number(scope) * 86400000;
  return tournaments.filter(t => {
    const ts = new Date(t.date).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

function matchupBucket(events) {
  const map = new Map();
  let matches = 0;
  for (const event of events) {
    matches += Number(event.matchCount || 0);
    for (const m of event.matchups || []) {
      const key = `${m.a}|||${m.b}`;
      const row = map.get(key) || { a:m.a, b:m.b, wins:0, losses:0, ties:0, games:0 };
      row.wins += Number(m.wins || 0);
      row.losses += Number(m.losses || 0);
      row.ties += Number(m.ties || 0);
      row.games += Number(m.games || 0);
      map.set(key, row);
    }
  }
  return {
    overview: { events:events.length, matches },
    matchups: [...map.values()].sort((a,b) => b.games - a.games),
  };
}

const [index, majorWeekend] = await Promise.all([tournamentIndex(), latestMajorWeekend()]);
console.log(`Found ${index.length} qualifying ${FORMAT_ID} online tournaments.`);
if (majorWeekend) console.log(`Post-major scope starts ${majorWeekend.cutoffIso} after ${majorWeekend.events.map(e => e.name).join(' + ')}`);
const loaded = await mapConcurrent(index, CONCURRENCY, async (tournament, i) => {
  try {
    const [standings, pairings] = await Promise.all([
      get(`/tournaments/${encodeURIComponent(tournament.id)}/standings`),
      get(`/tournaments/${encodeURIComponent(tournament.id)}/pairings`),
    ]);
    const compact = compactTournament(tournament, standings, pairings);
    console.log(`${i + 1}/${index.length} ${tournament.date} ${tournament.name}: ${compact?.archetypes?.length || 0} archetypes · ${compact?.matchCount || 0} matches`);
    return compact;
  } catch (error) {
    console.warn(`Skipping ${tournament.id}: ${error.message}`);
    return null;
  }
});

const internal = loaded.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
if (!internal.length) throw new Error('No compact online tournaments could be built');

const matchupScopes = {
  '14': matchupBucket(eventsForScope(internal, '14', majorWeekend)),
  '30': matchupBucket(eventsForScope(internal, '30', majorWeekend)),
  'since-major': matchupBucket(eventsForScope(internal, 'since-major', majorWeekend)),
  all: matchupBucket(internal),
};
const tournaments = internal.map(({ matchups, matchCount, ...event }) => event);

const payload = {
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  source: 'play.limitlesstcg.com',
  format: FORMAT_ID,
  label: FORMAT_LABEL,
  formatStart: FORMAT_START,
  minTournamentSize: MIN_PLAYERS,
  tournamentCount: tournaments.length,
  majorWeekend: majorWeekend ? { week:majorWeekend.week, cutoff:majorWeekend.cutoffIso, events:majorWeekend.events } : null,
  matchupScopes,
  tournaments,
};

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, JSON.stringify(payload));
const dates = tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
console.log(`Wrote ${outputFile}: ${tournaments.length} tournaments; ${new Date(Math.min(...dates)).toISOString().slice(0,10)} to ${new Date(Math.max(...dates)).toISOString().slice(0,10)}`);
for (const [scope, bucket] of Object.entries(matchupScopes)) console.log(`Matchups ${scope}: ${bucket.overview.events} events · ${bucket.overview.matches} matches · ${bucket.matchups.length} rows`);
