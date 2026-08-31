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
const outputFile = path.join(process.cwd(), 'data', 'meta', 'current-field.json');
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

function compactTournament(tournament, standings) {
  const archetypes = new Map();
  for (const standing of standings || []) {
    const name = standing?.deck?.name;
    if (!name || name === 'Other' || name === 'Unknown') continue;
    const row = archetypes.get(name) || { name, entries: 0, wins: 0, losses: 0, ties: 0 };
    row.entries += 1;
    row.wins += Number(standing.record?.wins || 0);
    row.losses += Number(standing.record?.losses || 0);
    row.ties += Number(standing.record?.ties || 0);
    archetypes.set(name, row);
  }
  if (!archetypes.size) return null;
  return {
    id: String(tournament.id),
    name: tournament.name || '',
    date: tournament.date,
    players: Number(tournament.players || 0),
    archetypes: [...archetypes.values()].sort((a, b) => b.entries - a.entries),
  };
}

const index = await tournamentIndex();
console.log(`Found ${index.length} qualifying ${FORMAT_ID} online tournaments.`);
const loaded = await mapConcurrent(index, CONCURRENCY, async (tournament, i) => {
  try {
    const standings = await get(`/tournaments/${encodeURIComponent(tournament.id)}/standings`);
    const compact = compactTournament(tournament, standings);
    console.log(`${i + 1}/${index.length} ${tournament.date} ${tournament.name}: ${compact?.archetypes?.length || 0} archetypes`);
    return compact;
  } catch (error) {
    console.warn(`Skipping ${tournament.id}: ${error.message}`);
    return null;
  }
});

const tournaments = loaded.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
if (!tournaments.length) throw new Error('No compact online tournaments could be built');

const payload = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  source: 'play.limitlesstcg.com',
  format: FORMAT_ID,
  label: FORMAT_LABEL,
  formatStart: FORMAT_START,
  minTournamentSize: MIN_PLAYERS,
  tournamentCount: tournaments.length,
  tournaments,
};

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, JSON.stringify(payload));
const dates = tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
console.log(`Wrote ${outputFile}: ${tournaments.length} tournaments; ${new Date(Math.min(...dates)).toISOString().slice(0,10)} to ${new Date(Math.max(...dates)).toISOString().slice(0,10)}`);
