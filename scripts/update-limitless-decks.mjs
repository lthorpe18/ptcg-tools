import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadPublishedConfig, resolveCurrentFormats } from './lib/format-config.mjs';

const BASE = 'https://play.limitlesstcg.com';
const runtimeConfig = await loadPublishedConfig();
const resolvedFormats = resolveCurrentFormats(runtimeConfig, new Date());
if (!resolvedFormats.online) throw new Error('No current Online Standard format can be resolved');
const currentFormat = resolvedFormats.online;
const FORMAT_ID = currentFormat.id;
const ROTATION = currentFormat.rotationYear;
const SET = currentFormat.upperSetCode;
const QUERY = `format=standard&rotation=${encodeURIComponent(ROTATION)}&set=${encodeURIComponent(SET)}`;
const OVERVIEW_URL = `${BASE}/decks?${QUERY}`;
const OUTPUT = `data/meta/decks/${FORMAT_ID}.json`;
const MAX_DECKS = 80;
const MIN_DECK_COUNT = 20;
const CONCURRENCY = 2;
const REQUEST_DELAY_MS = 175;
const USER_AGENT = 'ptcg-tools-meta-updater/1.0 (+https://github.com/lthorpe18/ptcg-tools)';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ignored = name => !name || name === 'Other' || name === 'Unknown';
const num = value => Number(String(value || '').replace(/,/g, '')) || 0;

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+|#39);/gi, (m, key) => named[key.toLowerCase()] ?? m);
}

function text(html) {
  return decodeEntities(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRows(html) {
  return [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
}

function cells(rowHtml) {
  return [...String(rowHtml || '').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => text(m[1]));
}

function deckLink(rowHtml) {
  const matches = [...String(rowHtml || '').matchAll(/<a\b[^>]*href=["']\/decks\/([^"'?#/]+)(?:[\/?#][^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const match of matches) {
    const label = text(match[2]);
    if (label) return { slug: match[1], name: label };
  }
  return null;
}

function scoreFromCells(values) {
  for (const value of values) {
    const m = value.match(/^(\d[\d,]*)\s*-\s*(\d[\d,]*)\s*-\s*(\d[\d,]*)$/);
    if (m) return { wins: num(m[1]), losses: num(m[2]), ties: num(m[3]) };
  }
  return null;
}

function parseOverview(html) {
  const summary = text(html).match(/([\d,]+)\s+tournaments,\s*([\d,]+)\s+players,\s*([\d,]+)\s+matches/i);
  const stats = summary ? {
    tournaments: num(summary[1]), players: num(summary[2]), matches: num(summary[3]),
  } : { tournaments: 0, players: 0, matches: 0 };

  const decks = [];
  const seen = new Set();
  for (const row of tableRows(html)) {
    const link = deckLink(row);
    if (!link || ignored(link.name) || seen.has(link.name)) continue;
    const values = cells(row);
    const shareIndex = values.findIndex(v => /^\d+(?:\.\d+)?%$/.test(v));
    const score = scoreFromCells(values);
    if (shareIndex < 1 || !score) continue;
    const count = num(values[shareIndex - 1]);
    const share = Number(values[shareIndex].replace('%', '')) || 0;
    const winRate = values.slice(shareIndex + 1).map(v => v.match(/^(\d+(?:\.\d+)?)%$/)).find(Boolean);
    if (!count) continue;
    seen.add(link.name);
    decks.push({
      name: link.name, slug: link.slug, count, share,
      wins: score.wins, losses: score.losses, ties: score.ties,
      winRate: winRate ? Number(winRate[1]) : (score.wins + score.losses ? 100 * score.wins / (score.wins + score.losses) : 0),
    });
  }
  decks.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { stats, decks };
}

function parseMatchups(html, sourceName) {
  const rows = [];
  const seen = new Set();
  for (const row of tableRows(html)) {
    const link = deckLink(row);
    if (!link || ignored(link.name) || seen.has(link.name)) continue;
    const score = scoreFromCells(cells(row));
    if (!score) continue;
    const games = score.wins + score.losses + score.ties;
    if (!games) continue;
    seen.add(link.name);
    rows.push({ a: sourceName, b: link.name, wins: score.wins, losses: score.losses, ties: score.ties, games });
  }
  return rows;
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const body = await response.text();
      if (!body || body.length < 1000) throw new Error('unexpectedly short response');
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(600 * attempt);
    }
  }
  throw new Error(`Failed ${url}: ${lastError?.message || lastError}`);
}

async function mapConcurrent(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
      await sleep(REQUEST_DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function readPrevious() {
  try {
    const raw = await readFile(OUTPUT, 'utf8');
    return { raw, data: JSON.parse(raw) };
  } catch {
    return null;
  }
}

function comparable(payload) {
  return JSON.stringify({
    overview: payload?.overview || null,
    coverage: payload?.coverage || null,
    decks: payload?.decks || [],
    matchups: payload?.matchups || [],
  });
}

async function writeAtomic(payload) {
  await mkdir(dirname(OUTPUT), { recursive: true });
  const temp = `${OUTPUT}.tmp`;
  await writeFile(temp, `${JSON.stringify(payload)}\n`, 'utf8');
  await rename(temp, OUTPUT);
}

async function main() {
  const previous = await readPrevious();
  console.log(`Resolved Online format ${FORMAT_ID}; Limitless rotation=${ROTATION}, set=${SET}; config ${runtimeConfig.source} v${runtimeConfig.formatRegistryVersion}.`);
  console.log(`Reading ${OVERVIEW_URL}`);
  const overviewHtml = await fetchText(OVERVIEW_URL);
  const overview = parseOverview(overviewHtml);

  if (overview.stats.tournaments < 1 || overview.stats.matches < 1 || overview.decks.length < 1) {
    throw new Error(`Overview validation failed: ${JSON.stringify({ stats: overview.stats, decks: overview.decks.length })}`);
  }

  const targets = overview.decks.filter(deck => deck.count >= MIN_DECK_COUNT).slice(0, MAX_DECKS);
  console.log(`Overview: ${overview.stats.tournaments} tournaments, ${overview.stats.players} players, ${overview.stats.matches} matches, ${overview.decks.length} named decks`);
  console.log(`Fetching matchup pages for ${targets.length} decks (count >= ${MIN_DECK_COUNT}, cap ${MAX_DECKS})`);

  let failures = 0;
  const matchupPages = await mapConcurrent(targets, CONCURRENCY, async (deck, index) => {
    const url = `${BASE}/decks/${encodeURIComponent(deck.slug)}/matchups?${QUERY}`;
    try {
      const html = await fetchText(url);
      const rows = parseMatchups(html, deck.name);
      if (!rows.length) throw new Error('no matchup rows parsed');
      if ((index + 1) % 10 === 0 || index === targets.length - 1) console.log(`Parsed ${index + 1}/${targets.length} matchup pages`);
      return rows;
    } catch (error) {
      failures += 1;
      console.warn(`Skipping ${deck.name}: ${error.message}`);
      return [];
    }
  });

  const matchups = matchupPages.flat();
  const successfulPages = targets.length - failures;
  const minimumSuccess = targets.length ? Math.max(1, Math.ceil(targets.length * 0.75)) : 0;
  if (targets.length && (successfulPages < minimumSuccess || matchups.length < successfulPages)) {
    throw new Error(`Matchup validation failed: ${successfulPages}/${targets.length} pages, ${matchups.length} rows`);
  }

  const payload = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    previousGeneratedAt: previous?.data?.generatedAt || null,
    source: 'limitless-decks', game: 'PTCG', format: FORMAT_ID, apiFormat: 'STANDARD', rotation: ROTATION, set: SET,
    formatConfig:{ registryVersion:runtimeConfig.formatRegistryVersion, source:runtimeConfig.source, online:currentFormat },
    sourceUrl: OVERVIEW_URL,
    overview: overview.stats,
    coverage: {
      namedDecks: overview.decks.length,
      matchupDecksRequested: targets.length,
      matchupDecksLoaded: successfulPages,
      matchupRows: matchups.length,
      minimumDeckCount: MIN_DECK_COUNT,
      maximumDecks: MAX_DECKS,
    },
    decks: overview.decks,
    matchups,
  };

  if (previous && comparable(previous.data) === comparable(payload)) {
    const compact = `${JSON.stringify(previous.data)}\n`;
    if (previous.raw !== compact) {
      await writeAtomic(previous.data);
      console.log('Limitless aggregate unchanged; compacted existing snapshot without changing its timestamp');
    } else {
      console.log('Limitless aggregate is unchanged; keeping existing snapshot and timestamp');
    }
    return;
  }

  await writeAtomic(payload);
  console.log(`Wrote ${OUTPUT}: ${payload.decks.length} decks, ${payload.matchups.length} matchup rows`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
