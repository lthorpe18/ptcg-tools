import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://play.limitlesstcg.com/api';
const FORMAT = 'STANDARD';
const WINDOW_DAYS = 90;
const MIN_TOURNAMENT_SIZE = 16;
const OUT = path.join(process.cwd(), 'data', 'meta', 'standard.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(pathname, attempt = 0) {
  const res = await fetch(BASE + pathname, { headers: { Accept: 'application/json' } });
  if (res.status === 429 && attempt < 6) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(60000, 2000 * (2 ** attempt));
    console.log(`429 for ${pathname}; retrying in ${waitMs}ms`);
    await sleep(waitMs);
    return get(pathname, attempt + 1);
  }
  if (!res.ok) throw new Error(`Limitless API ${res.status}: ${pathname}`);
  return res.json();
}

async function readExisting() {
  try {
    return JSON.parse(await fs.readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

async function fetchTournamentIndex(cutoff) {
  const found = [];
  for (let page = 0; page < 20; page++) {
    const rows = await get(`/tournaments?game=PTCG&format=${FORMAT}&limit=100&page=${page}`);
    if (!Array.isArray(rows) || !rows.length) break;
    found.push(...rows);
    const oldest = Math.min(...rows.map(t => new Date(t.date).getTime()).filter(Number.isFinite));
    if (oldest < cutoff || rows.length < 100) break;
    await sleep(350);
  }
  return found;
}

async function main() {
  const now = Date.now();
  const cutoff = now - WINDOW_DAYS * 86400000;
  const existing = await readExisting();
  const cachedById = new Map((existing?.tournaments || []).map(t => [String(t.id), t]));

  const index = await fetchTournamentIndex(cutoff);
  const eligible = index.filter(t => {
    const date = new Date(t.date).getTime();
    return Number.isFinite(date) && date >= cutoff && Number(t.players || 0) >= MIN_TOURNAMENT_SIZE;
  });

  console.log(`Found ${eligible.length} eligible ${FORMAT} tournaments in last ${WINDOW_DAYS} days.`);
  const tournaments = [];

  for (let i = 0; i < eligible.length; i++) {
    const t = eligible[i];
    const cached = cachedById.get(String(t.id));
    if (cached?.standings?.length && cached?.pairings?.length) {
      tournaments.push({ ...cached, ...t, standings: cached.standings, pairings: cached.pairings });
      continue;
    }

    console.log(`Fetching ${i + 1}/${eligible.length}: ${t.name} (${t.id})`);
    try {
      const standings = await get(`/tournaments/${encodeURIComponent(t.id)}/standings`);
      await sleep(350);
      const pairings = await get(`/tournaments/${encodeURIComponent(t.id)}/pairings`);
      tournaments.push({ ...t, standings, pairings });
    } catch (error) {
      console.warn(`Skipping ${t.id}: ${error.message}`);
    }
    await sleep(350);
  }

  tournaments.sort((a, b) => new Date(b.date) - new Date(a.date));
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    game: 'PTCG',
    format: FORMAT,
    windowDays: WINDOW_DAYS,
    minTournamentSize: MIN_TOURNAMENT_SIZE,
    tournamentCount: tournaments.length,
    tournaments,
  }));
  console.log(`Wrote ${OUT} with ${tournaments.length} tournaments.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
