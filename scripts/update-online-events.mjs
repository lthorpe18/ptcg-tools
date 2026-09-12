import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const DISCOVERY_URL = 'https://play.limitlesstcg.com/tournaments/upcoming?game=PTCG&type=online';
const OUTPUT = new URL('../v2-preview/data/online-events.json', import.meta.url);
const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

function decode(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, code) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()];
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '\ufffd';
  });
}
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1], decode(m[2] ?? m[3])]));
}
function hasClass(tag, name) { return (attrs(tag).class || '').split(/\s+/).includes(name); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

// Deliberately limited to the server-rendered Upcoming table, never descriptions.
export function parseUpcoming(html, now = new Date()) {
  assert(typeof html === 'string' && html.length < 5_000_000, 'Invalid discovery response');
  // Check actual selected filters, not merely options offered by the page.
  const selections = [...html.matchAll(/<ul\b[^>]*>[\s\S]*?<\/ul>/g)].map(m => m[0]);
  const selected = selections.find(s => hasClass(s.slice(0, s.indexOf('>') + 1), 'active-options'));
  const selectionText = decode((selected || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
  assert(/Game:\s*Pokémon TCG/.test(selectionText) && /Type:\s*Online/.test(selectionText), 'Expected Pokémon TCG / Online source filters');
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/g)].map(m => m[0]);
  const table = tables.find(t => hasClass(t.slice(0, t.indexOf('>') + 1), 'upcoming-tournaments'));
  assert(table, 'Upcoming tournament table missing');
  assert(/data-sort=["']date["']/.test(table) && /data-sort=["']name["']/.test(table), 'Upcoming table headers changed');
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[0]).filter(r => /<td\b/.test(r));
  assert(rows.length > 0, 'Empty discovery table; retaining last-known-good feed');
  const seen = new Set();
  const events = rows.map(row => {
    const data = attrs(row.slice(0, row.indexOf('>') + 1));
    const cell = [...row.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/g)].map(m => m[0]).find(c => hasClass(c.slice(0, c.indexOf('>') + 1), 'name'));
    const anchor = cell?.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/);
    assert(anchor, 'Tournament name/link missing');
    const link = attrs(anchor[1]).href;
    const match = link?.match(/^\/tournament\/([a-z0-9]+(?:-[a-z0-9]+)*)\/details$/);
    assert(match, 'Unexpected tournament URL');
    const sourceId = match[1];
    assert(!seen.has(sourceId), `Duplicate tournament ID: ${sourceId}`);
    seen.add(sourceId);
    const name = decode(anchor[2].replace(/<[^>]*>/g, '')).trim();
    assert(name && name.length <= 1000 && name === data['data-name'], 'Tournament name metadata mismatch');
    assert(timestamp(data['data-date']), `Invalid start time: ${sourceId}`);
    const time = row.match(/data-time=["'](\d+)["']/)?.[1];
    assert(time && Number(time) === Date.parse(data['data-date']), `Conflicting start time: ${sourceId}`);
    return { id: `limitless:${sourceId}`, source: 'limitless', sourceId, name,
      url: `https://play.limitlesstcg.com/tournament/${sourceId}/details`, startAt: data['data-date'] };
  });
  return { discoveredCount: rows.length, events: events.filter(e => Date.parse(e.startAt) > now.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id)) };
}

export function validateFeed(feed) {
  assert(feed?.schemaVersion === 1 && timestamp(feed.generatedAt), 'Invalid feed metadata');
  assert(feed.source?.provider === 'limitless' && feed.source.discoveryUrl === DISCOVERY_URL, 'Invalid feed source');
  assert(Array.isArray(feed.events), 'Invalid event array');
  const ids = new Set();
  for (const event of feed.events) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.sourceId) && event.id === `limitless:${event.sourceId}` && event.source === 'limitless', 'Invalid event identity');
    assert(!ids.has(event.id), 'Duplicate feed ID'); ids.add(event.id);
    assert(event.url === `https://play.limitlesstcg.com/tournament/${event.sourceId}/details`, 'Invalid Limitless URL');
    assert(typeof event.name === 'string' && event.name.trim() && timestamp(event.startAt), 'Invalid name/start time');
  }
  return feed;
}

export async function updateOnlineEvents({ output = OUTPUT, now = new Date(), fetcher = fetch } = {}) {
  let previous = null;
  try { previous = validateFeed(JSON.parse(await fs.readFile(output, 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const response = await fetcher(DISCOVERY_URL, { signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'PTCG-Tools online tournament discovery (GitHub Actions)' } });
  assert(response.ok, `Discovery request failed: HTTP ${response.status}`);
  assert((response.headers.get('content-type') || '').includes('text/html'), 'Discovery did not return HTML');
  const parsed = parseUpcoming(await response.text(), now);
  const stillFuture = previous?.events.filter(e => Date.parse(e.startAt) > now.getTime()).length || 0;
  assert(parsed.events.length > 0, 'No future tournaments discovered; retaining last-known-good feed');
  // A major unexplained loss is safer to review than automatically publish.
  assert(stillFuture < 10 || parsed.events.length >= Math.ceil(stillFuture * 0.5), 'Implausible feed reduction; retaining last-known-good feed');
  const feed = validateFeed({ schemaVersion: 1, generatedAt: now.toISOString(),
    source: { provider: 'limitless', discoveryUrl: DISCOVERY_URL }, events: parsed.events });
  if (previous && JSON.stringify(previous.events) === JSON.stringify(feed.events)) {
    return { changed: false, eventCount: feed.events.length, discoveredCount: parsed.discoveredCount };
  }
  const target = output instanceof URL ? fileURLToPath(output) : output;
  const temporary = `${target}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(feed, null, 2) + '\n'); await fs.rename(temporary, target); }
  finally { await fs.rm(temporary, { force: true }); }
  return { changed: true, eventCount: feed.events.length, discoveredCount: parsed.discoveredCount };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateOnlineEvents().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(`Online feed refresh failed: ${error.message}`); process.exitCode = 1;
  });
}
