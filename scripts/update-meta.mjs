import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://play.limitlesstcg.com/api';
const GAME = 'PTCG';
const API_FORMAT = 'STANDARD';
const MIN_TOURNAMENT_SIZE = 50;
const CONCURRENCY = 8;

// Keep legality boundaries explicit so Standard card pools never get blended.
// Older format files remain archived in data/meta/formats; the app highlights
// the current and previous legality as the useful comparison pair.
const FORMATS = [
  { id: 'TEF-CRI', label: 'TEF–CRI', start: '2026-05-22T00:00:00Z', end: '2026-07-17T00:00:00Z' },
  { id: 'TEF-PBL', label: 'TEF–PBL', start: '2026-07-17T00:00:00Z', end: null },
];
const CURRENT_FORMAT = FORMATS[FORMATS.length - 1].id;
const PREVIOUS_FORMAT = FORMATS.length > 1 ? FORMATS[FORMATS.length - 2].id : null;

const DATA_DIR = path.join(process.cwd(), 'data', 'meta');
const FORMAT_DIR = path.join(DATA_DIR, 'formats');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(pathname, attempt = 0) {
  const res = await fetch(BASE + pathname, { headers: { Accept: 'application/json' } });
  if (res.status === 429 && attempt < 6) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30000, 750 * (2 ** attempt));
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
  const earliest = Math.min(...FORMATS.map(f => new Date(f.start).getTime()));
  const found = [];
  for (let page = 0; page < 20; page++) {
    const rows = await get(`/tournaments?game=${GAME}&format=${API_FORMAT}&limit=100&page=${page}`);
    if (!Array.isArray(rows) || !rows.length) break;
    found.push(...rows);
    const dates = rows.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
    if ((dates.length && Math.min(...dates) < earliest) || rows.length < 100) break;
  }
  const unique = new Map();
  for (const t of found) unique.set(String(t.id), t);
  return [...unique.values()];
}

function formatForTournament(t) {
  const ts = new Date(t.date).getTime();
  if (!Number.isFinite(ts)) return null;
  return FORMATS.find(f => {
    const start = new Date(f.start).getTime();
    const end = f.end ? new Date(f.end).getTime() : Infinity;
    return ts >= start && ts < end;
  }) || null;
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

async function buildFormat(format, tournamentIndex) {
  const file = path.join(FORMAT_DIR, `${format.id}.json`);
  const existing = await readJson(file, { tournaments: [] });
  const existingTournaments = Array.isArray(existing?.tournaments) ? existing.tournaments : [];
  const cachedById = new Map(existingTournaments.map(t => [String(t.id), t]));

  const eligible = tournamentIndex.filter(t =>
    Number(t.players || 0) >= MIN_TOURNAMENT_SIZE && formatForTournament(t)?.id === format.id
  );

  const retained = new Map();
  for (const t of existingTournaments) {
    if (Number(t.players || 0) >= MIN_TOURNAMENT_SIZE && formatForTournament(t)?.id === format.id) {
      retained.set(String(t.id), t);
    }
  }

  const missing = eligible.filter(t => {
    const cached = cachedById.get(String(t.id));
    if (cached?.standings?.length && cached?.pairings?.length) {
      retained.set(String(t.id), { ...cached, ...t, standings: cached.standings, pairings: cached.pairings });
      return false;
    }
    return true;
  });

  console.log(`${format.id}: ${eligible.length} qualifying tournaments; ${missing.length} need fetching.`);
  const fetched = await mapConcurrent(missing, CONCURRENCY, (t, i) => fetchTournament(t, i, missing.length));
  for (const t of fetched) if (t) retained.set(String(t.id), t);

  const tournaments = [...retained.values()]
    .filter(t => Number(t.players || 0) >= MIN_TOURNAMENT_SIZE && formatForTournament(t)?.id === format.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 2,
    generatedAt,
    game: GAME,
    apiFormat: API_FORMAT,
    format: format.id,
    label: format.label,
    formatStart: format.start,
    formatEnd: format.end,
    minTournamentSize: MIN_TOURNAMENT_SIZE,
    tournamentCount: tournaments.length,
    tournaments,
  };
  await fs.writeFile(file, JSON.stringify(payload));
  console.log(`Wrote ${file} with ${tournaments.length} tournaments.`);
  return payload;
}

async function main() {
  await fs.mkdir(FORMAT_DIR, { recursive: true });
  const tournamentIndex = await fetchTournamentIndex();
  console.log(`Indexed ${tournamentIndex.length} Standard tournaments across retained legality windows.`);

  const built = [];
  for (const format of FORMATS) built.push(await buildFormat(format, tournamentIndex));

  const generatedAt = new Date().toISOString();
  const oldIndex = await readJson(INDEX_FILE, { formats: [] });
  const archived = new Map((oldIndex.formats || []).map(f => [f.id, f]));
  for (let i = 0; i < FORMATS.length; i++) {
    const f = FORMATS[i];
    const payload = built[i];
    archived.set(f.id, {
      id: f.id,
      label: f.label,
      file: `formats/${f.id}.json`,
      formatStart: f.start,
      formatEnd: f.end,
      generatedAt: payload.generatedAt,
      tournamentCount: payload.tournamentCount,
      minTournamentSize: MIN_TOURNAMENT_SIZE,
      role: f.id === CURRENT_FORMAT ? 'current' : f.id === PREVIOUS_FORMAT ? 'previous' : 'archive',
    });
  }

  const formats = [...archived.values()].sort((a, b) => new Date(b.formatStart || 0) - new Date(a.formatStart || 0));
  await fs.writeFile(INDEX_FILE, JSON.stringify({
    schemaVersion: 2,
    generatedAt,
    current: CURRENT_FORMAT,
    previous: PREVIOUS_FORMAT,
    activeComparison: [CURRENT_FORMAT, PREVIOUS_FORMAT].filter(Boolean),
    formats,
  }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
