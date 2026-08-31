import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://labs.limitlesstcg.com';
const FORMAT = 'TEF-PBL';
const FORMAT_START = new Date('2026-07-17T00:00:00Z').getTime();
const OUTPUT = path.join('data', 'meta', 'irl', `${FORMAT}.json`);
const MAX_EVENTS_TO_PROBE = 16;
const MAX_DECKS_FOR_MATCHUPS = 35;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

async function get(url) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'ptcg-tools meta research; public Limitless Labs pages' } });
    if (r.ok) return r.text();
    last = new Error(`${r.status} ${url}`);
    if (r.status === 429 || r.status >= 500) { await sleep(1000 * (attempt + 1)); continue; }
    throw last;
  }
  throw last;
}

function eventIds(home) {
  const ids = new Set();
  for (const m of home.matchAll(/href=["']\/(\d{4})\/standings["']/g)) ids.add(m[1]);
  return [...ids].sort((a,b) => Number(b) - Number(a)).slice(0, MAX_EVENTS_TO_PROBE);
}

function parseDate(html) {
  const text = clean(html);
  const m = text.match(/([A-Z][a-z]+)\s+(\d{1,2})(?:–(\d{1,2}))?,\s+(20\d{2})/);
  if (!m) return null;
  const month = new Date(`${m[1]} 1, 2000`).getMonth();
  if (!Number.isFinite(month)) return null;
  return new Date(Date.UTC(Number(m[4]), month, Number(m[2]))).toISOString();
}

function parseEventMeta(html, id) {
  const text = clean(html);
  const title = clean((html.match(/<title>(.*?)<\/title>/is) || [,''])[1]).replace(/^Decks:\s*/i,'').replace(/\s*[–-]\s*Limitless Labs.*$/i,'');
  const players = Number((text.match(/([\d,]+)\s+players/i) || [,'0'])[1].replace(/,/g,''));
  return { id, name: title || `Labs ${id}`, date: parseDate(html), players, url: `${BASE}/${id}/decks` };
}

function parseRecord(cells) {
  for (const cell of cells) {
    const m = String(cell).match(/(^|\s)(\d+)\s*-\s*(\d+)\s*-\s*(\d+)(\s|$)/);
    if (m) return { wins: Number(m[2]), losses: Number(m[3]), ties: Number(m[4]) };
  }
  return { wins: 0, losses: 0, ties: 0 };
}

function percentages(cells) {
  return cells.map(x => String(x).match(/(-?\d+(?:\.\d+)?)%/)).filter(Boolean).map(m => Number(m[1]));
}

function parseDeckRows(html, eventId) {
  const rows = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const body = tr[1];
    const link = body.match(new RegExp(`href=["']\\/${eventId}\\/decks\\/([^"'?]+)["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'));
    if (!link) continue;
    const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => clean(x[1]));
    const entries = Number(String(cells[1] || '').replace(/[, ]/g, '')) || cells.map(x => Number(String(x).replace(/[% ,]/g,''))).find(n => Number.isInteger(n) && n >= 1) || 0;
    const pcts = percentages(cells);
    const winRate = pcts.length ? pcts[pcts.length - 1] : null;
    const share = pcts.length > 1 ? pcts[0] : null;
    const record = parseRecord(cells);
    rows.push({
      name: clean(link[2]),
      slug: link[1],
      entries,
      share,
      winRate,
      ...record,
    });
  }
  const dedup = new Map();
  for (const row of rows) if (row.name && row.name !== 'Other') dedup.set(row.name, row);
  return [...dedup.values()].sort((a,b) => b.entries - a.entries);
}

function parseMatchups(html, candidate) {
  const out = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const body = tr[1];
    const links = [...body.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map(x => clean(x[1])).filter(Boolean);
    const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => clean(x[1]));
    const wr = percentages(cells).at(-1);
    const games = cells.map(x => Number(String(x).replace(/[, ]/g,''))).find(n => Number.isInteger(n) && n > 0 && n < 100000);
    const opponent = links.find(x => x !== candidate && !/^Image:/i.test(x));
    if (!opponent || !games || !Number.isFinite(wr)) continue;
    const wins = Math.round(games * wr / 100);
    out.push({ a: candidate, b: opponent, games, wins, losses: Math.max(0, games - wins), ties: 0 });
  }
  return out;
}

function addMatchup(map, m) {
  const key = `${m.a}|||${m.b}`;
  const row = map.get(key) || { a: m.a, b: m.b, games: 0, wins: 0, losses: 0, ties: 0 };
  row.games += Number(m.games || 0);
  row.wins += Number(m.wins || 0);
  row.losses += Number(m.losses || 0);
  row.ties += Number(m.ties || 0);
  map.set(key, row);
}

async function main() {
  const home = await get(`${BASE}/`);
  const ids = eventIds(home);
  const events = [];
  const deckAgg = new Map();
  const matchupAgg = new Map();

  for (const id of ids) {
    const html = await get(`${BASE}/${id}/decks`);
    const meta = parseEventMeta(html, id);
    const ts = meta.date ? new Date(meta.date).getTime() : NaN;
    if (!Number.isFinite(ts) || ts < FORMAT_START) continue;

    const decks = parseDeckRows(html, id);
    if (meta.players >= 50 && /\/decks\//.test(html) && !decks.length) {
      throw new Error(`Labs event ${id} has a populated metagame page but parsed zero decks`);
    }

    meta.decks = decks.map(d => ({
      name: d.name,
      entries: d.entries,
      share: d.share,
      wins: d.wins,
      losses: d.losses,
      ties: d.ties,
      winRate: d.winRate,
      url: `${BASE}/${id}/decks/${d.slug}`,
    }));
    events.push(meta);

    for (const d of decks) {
      const row = deckAgg.get(d.name) || { name: d.name, entries: 0, wins: 0, losses: 0, ties: 0 };
      row.entries += d.entries;
      row.wins += d.wins;
      row.losses += d.losses;
      row.ties += d.ties;
      deckAgg.set(d.name, row);
    }

    const eventMatchups = new Map();
    for (const d of decks.slice(0, MAX_DECKS_FOR_MATCHUPS)) {
      await sleep(80);
      const mh = await get(`${BASE}/${id}/decks/${d.slug}/matchups`);
      for (const m of parseMatchups(mh, d.name)) {
        addMatchup(eventMatchups, m);
        addMatchup(matchupAgg, m);
      }
    }
    meta.matchups = [...eventMatchups.values()];
  }

  const payload = {
    schemaVersion: 3,
    source: 'Limitless Labs',
    sourceUrl: BASE,
    format: FORMAT,
    formatStart: new Date(FORMAT_START).toISOString(),
    generatedAt: new Date().toISOString(),
    events: events.sort((a,b)=>new Date(b.date)-new Date(a.date)),
    decks: [...deckAgg.values()].sort((a,b)=>b.entries-a.entries),
    matchups: [...matchupAgg.values()],
    note: events.length ? `${events.length} current-format IRL major event(s) from Limitless Labs.` : 'No completed current-format IRL major is available on Limitless Labs yet.'
  };

  if (payload.events.length && !payload.decks.length) throw new Error('IRL events were found but no deck field data was parsed');
  if (payload.events.some(e => !Array.isArray(e.matchups))) throw new Error('IRL event matchup evidence was not preserved');

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${OUTPUT}: ${events.length} events, ${payload.decks.length} decks, ${payload.matchups.length} matchups`);
  if (payload.decks.length) console.log('Top decks:', payload.decks.slice(0, 8).map(d => `${d.name} ${d.entries}`).join(' | '));
}

main().catch(err => { console.error(err); process.exit(1); });
