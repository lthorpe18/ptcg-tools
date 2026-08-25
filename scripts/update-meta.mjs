import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://play.limitlesstcg.com/api';
const GAME = 'PTCG';
const CURRENT_FORMAT = 'TEF-PBL';
const MIN_TOURNAMENT_SIZE = 50;
const SEED_DAYS = 30;
const CONCURRENCY = 6;
const DATA_DIR = path.join(process.cwd(), 'data', 'meta');
const FORMAT_DIR = path.join(DATA_DIR, 'formats');
const FORMAT_FILE = path.join(FORMAT_DIR, `${CURRENT_FORMAT}.json`);
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(pathname, attempt = 0) {
  const res = await fetch(BASE + pathname, { headers: { Accept: 'application/json' } });
  if (res.status === 429 && attempt < 6) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30000, 1000 * (2 ** attempt));
    console.log(`429 for ${pathname}; retrying in ${waitMs}ms`);
    await sleep(waitMs);
    return get(pathname, attempt + 1);
  }
  if (!res.ok) throw new Error(`Limitless API ${res.status}: ${pathname}`);
  return res.json();
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function fetchTournamentIndex() {
  const found = [];
  // The first build only needs the current legality. Querying by its Limitless
  // format ID prevents old Standard card pools being mixed into this dataset.
  for (let page = 0; page < 10; page++) {
    const rows = await get(`/tournaments?game=${GAME}&format=${encodeURIComponent(CURRENT_FORMAT)}&limit=100&page=${page}`);
    if (!Array.isArray(rows) || !rows.length) break;
    found.push(...rows);
    if (rows.length < 100) break;
  }
  return found;
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchTournament(t, i, total) {
  console.log(`Fetching ${i + 1}/${total}: ${t.name} (${t.id})`);
  try {
    const [standings, pairings] = await Promise.all([
      get(`/tournaments/${encodeURIComponent(t.id)}/standings`),
      get(`/tournaments/${encodeURIComponent(t.id)}/pairings`),
    ]);
    return { ...t, standings, pairings };
  } catch (error) {
    console.warn(`Skipping ${t.id}: ${error.message}`);
    return null;
  }
}

async function main() {
  await fs.mkdir(FORMAT_DIR, { recursive: true });
  const existing = await readJson(FORMAT_FILE, { tournaments: [] });
  const existingTournaments = Array.isArray(existing?.tournaments) ? existing.tournaments : [];
  const cachedById = new Map(existingTournaments.map(t => [String(t.id), t]));

  const index = await fetchTournamentIndex();
  const now = Date.now();
  const seedCutoff = now - SEED_DAYS * 86400000;
  const hasSeed = existingTournaments.some(t => (t.standings?.length || 0) > 0 && (t.pairings?.length || 0) > 0);

  const eligible = index.filter(t => {
    const date = new Date(t.date).getTime();
    if (!Number.isFinite(date) || Number(t.players || 0) < MIN_TOURNAMENT_SIZE) return false;
    // First run: seed 30 days quickly. Once seeded, keep all cached events and
    // add every new tournament in this same legality as it appears.
    return hasSeed || date >= seedCutoff;
  });

  const retained = new Map();
  for (const t of existingTournaments) {
    if (Number(t.players || 0) >= MIN_TOURNAMENT_SIZE) retained.set(String(t.id), t);
  }

  const missing = eligible.filter(t => {
    const cached = cachedById.get(String(t.id));
    if (cached?.standings?.length && cached?.pairings?.length) {
      retained.set(String(t.id), { ...cached, ...t, standings: cached.standings, pairings: cached.pairings });
      return false;
    }
    return true;
  });

  console.log(`${CURRENT_FORMAT}: ${eligible.length} eligible tournaments; ${missing.length} need fetching.`);
  const fetched = await mapConcurrent(missing, CONCURRENCY, (t, i) => fetchTournament(t, i, missing.length));
  for (const t of fetched) if (t) retained.set(String(t.id), t);

  const tournaments = [...retained.values()]
    .filter(t => Number(t.players || 0) >= MIN_TOURNAMENT_SIZE)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    game: GAME,
    format: CURRENT_FORMAT,
    minTournamentSize: MIN_TOURNAMENT_SIZE,
    seedDays: SEED_DAYS,
    tournamentCount: tournaments.length,
    tournaments,
  };
  await fs.writeFile(FORMAT_FILE, JSON.stringify(payload));

  const oldIndex = await readJson(INDEX_FILE, { formats: [] });
  const formats = new Map((oldIndex.formats || []).map(f => [f.id, f]));
  formats.set(CURRENT_FORMAT, {
    id: CURRENT_FORMAT,
    label: CURRENT_FORMAT,
    file: `formats/${CURRENT_FORMAT}.json`,
    generatedAt,
    tournamentCount: tournaments.length,
    minTournamentSize: MIN_TOURNAMENT_SIZE,
  });
  await fs.writeFile(INDEX_FILE, JSON.stringify({
    generatedAt,
    current: CURRENT_FORMAT,
    formats: [...formats.values()],
  }));

  console.log(`Wrote ${FORMAT_FILE} with ${tournaments.length} tournaments.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
