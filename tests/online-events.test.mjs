import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseUpcoming, updateOnlineEvents, DISCOVERY_URL } from '../scripts/update-online-events.mjs';

const now = new Date('2026-09-12T19:00:00.000Z');
const future = '2026-09-13T01:00:00.000Z';
function row(id, date = future, name = 'Tournament &amp; friends') {
  return `<tr data-name="${name}" data-date="${date}"><td class="date"><a data-time="${Date.parse(date)}"></a></td><td class="name"><a href="/tournament/${id}/details">${name}</a></td></tr>`;
}
function page(rows) {
  return `<ul class="multi-selection active-options"><li>Game:Pokémon TCG</li><li>Type:Online</li></ul><table class="striped upcoming-tournaments"><tr><th data-sort="date">Date</th><th data-sort="name">Name</th></tr>${rows}</table>`;
}
const id = 'a'.repeat(24);
const fakeFetch = html => async url => { assert.equal(url, DISCOVERY_URL); return new Response(html, { headers: { 'content-type': 'text/html' } }); };

test('only future events, exact UTC times, decoded names, canonical links, soonest first', () => {
  const parsed = parseUpcoming(page(row('b'.repeat(24), '2026-09-14T01:00:00.000Z') + row(id) +
    row('c'.repeat(24), now.toISOString()) + row('d'.repeat(24), '2026-09-11T19:00:00.000Z')), now);
  assert.equal(parsed.discoveredCount, 4);
  assert.deepEqual(parsed.events.map(e => e.sourceId), [id, 'b'.repeat(24)]);
  assert.equal(parsed.events[0].name, 'Tournament & friends');
  assert.equal(parsed.events[0].startAt, future);
  assert.equal(parsed.events[0].url, `https://play.limitlesstcg.com/tournament/${id}/details`);
});

test('rejects changed source scope, malformed rows, duplicates, hostile URLs and missing table', () => {
  const good = page(row(id));
  for (const html of [good.replace('Pokémon TCG', 'Pokémon VGC'), good.replace('Type:Online', 'Type:In-person'),
    page(row(id) + row(id)), good.replace('/tournament/', 'https://evil.example/tournament/'),
    good.replace('data-date=', 'missing-date='), good.replace('data-time=', 'missing-time='),
    good.replace('upcoming-tournaments', 'changed-table'), page('')]) {
    assert.throws(() => parseUpcoming(html, now));
  }
});

test('preserves Limitless custom tournament URL slugs', () => {
  const event = parseUpcoming(page(row('chamionship-of-doom-ten')), now).events[0];
  assert.equal(event.sourceId, 'chamionship-of-doom-ten');
  assert.equal(event.url, 'https://play.limitlesstcg.com/tournament/chamionship-of-doom-ten/details');
});

test('refresh is atomic, unchanged content is a no-op and failures preserve prior bytes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'online-feed-test-'));
  const output = path.join(directory, 'feed.json');
  try {
    assert.equal((await updateOnlineEvents({ output, now, fetcher: fakeFetch(page(row(id))) })).changed, true);
    const original = await fs.readFile(output, 'utf8');
    assert.equal((await updateOnlineEvents({ output, now, fetcher: fakeFetch(page(row(id))) })).changed, false);
    for (const fetcher of [fakeFetch('<html>Error</html>'), fakeFetch(page('')),
      fakeFetch(page(row(id, '2026-09-11T00:00:00.000Z'))), async () => new Response('down', { status: 503 }),
      async () => { throw new Error('network failure'); }]) {
      await assert.rejects(updateOnlineEvents({ output, now, fetcher }));
      assert.equal(await fs.readFile(output, 'utf8'), original);
    }
    const many = Array.from({ length: 12 }, (_, i) => row(i.toString(16).padStart(24, '0'))).join('');
    await updateOnlineEvents({ output, now, fetcher: fakeFetch(page(many)) });
    const beforeCollapse = await fs.readFile(output, 'utf8');
    await assert.rejects(updateOnlineEvents({ output, now, fetcher: fakeFetch(page(row(id))) }), /reduction/);
    assert.equal(await fs.readFile(output, 'utf8'), beforeCollapse);
    assert.deepEqual(await fs.readdir(directory), ['feed.json']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('extracts format tooltip and platform, never numeric format sort key',()=>{
 const html=page(row(id).replace('<tr ', '<tr data-platform="PTCGL" data-format="999" ').replace('</tr>','<td class="format"><img class="format" data-tooltip="Standard (Reg H–J)"></td></tr>'));
 const event=parseUpcoming(html,now).events[0];assert.equal(event.format,'Standard (Reg H–J)');assert.equal(event.platform,'PTCGL');
 assert.equal(parseUpcoming(page(row(id)),now).events[0].format,null);
});
