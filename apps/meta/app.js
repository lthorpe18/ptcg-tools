let DATA = null;
let MANIFEST = null;
let CACHE = null;
let FILTERED_TOURNAMENTS = [];
let loading = false;
const FORMAT_CACHES = new Map();
const INDEX_URL = '../../data/meta/index.json';
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toFixed(1) + '%';
const ignoredArchetype = name => !name || name === 'Unknown' || name === 'Other';

function setStatus(text) { $('status').textContent = text; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function short(value) {
  const s = String(value || '');
  return escapeHtml(s.length > 16 ? s.slice(0, 14) + '…' : s);
}
function setBusy(value) {
  loading = value;
  $('apply').disabled = value;
  $('refresh').disabled = value;
  $('format').disabled = value;
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tabpane').forEach(x => x.classList.add('hidden'));
      button.classList.add('active');
      $(button.dataset.tab).classList.remove('hidden');
    });
  });
}

async function fetchJson(url, force = false) {
  const target = force ? `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}` : url;
  const response = await fetch(target, { cache: force ? 'no-store' : 'default' });
  if (!response.ok) throw new Error(`Shared meta data ${response.status}`);
  return response.json();
}

function formatMeta(id) {
  return MANIFEST?.formats?.find(f => f.id === id) || null;
}

async function loadFormatCache(id, force = false) {
  const meta = formatMeta(id);
  if (!meta?.file) throw new Error(`No archived cache is available for ${id}`);
  if (!force && FORMAT_CACHES.has(id)) return FORMAT_CACHES.get(id);
  const payload = await fetchJson(`../../data/meta/${meta.file}`, force);
  if (!payload || !Array.isArray(payload.tournaments)) throw new Error(`${id} archive is invalid`);
  FORMAT_CACHES.set(id, payload);
  return payload;
}

async function loadManifest(force = false) {
  MANIFEST = await fetchJson(INDEX_URL, force);
  if (!MANIFEST || !Array.isArray(MANIFEST.formats)) throw new Error('Meta format manifest is invalid');
  return MANIFEST;
}

async function loadSelectedFormat(force = false) {
  const selectedId = $('format').value || MANIFEST?.current;
  CACHE = await loadFormatCache(selectedId, force);
  return CACHE;
}

function filteredFor(cache, daysValue, minPlayers) {
  if (!cache) return [];
  const cutoff = daysValue === 'all' ? -Infinity : Date.now() - Number(daysValue) * 86400000;
  return (cache.tournaments || []).filter(t => {
    const date = new Date(t.date).getTime();
    return Number.isFinite(date) && date >= cutoff && Number(t.players || 0) >= minPlayers;
  });
}

function usingFullMatchups() {
  return CACHE?.format === 'TEF-PBL' && window.DeckAggregate?.hasData?.();
}

function onlineMatchup(a, b) {
  if (ignoredArchetype(a) || ignoredArchetype(b)) return null;
  if (usingFullMatchups()) return window.DeckAggregate?.getMatchup?.(a, b) || null;
  return DATA?.matchups?.get(`${a}|||${b}`) || null;
}

function onlineMatchupsFor(name) {
  if (ignoredArchetype(name)) return [];
  if (usingFullMatchups()) {
    return (window.DeckAggregate?.getData?.()?.matchups || []).filter(row => row.a === name && !ignoredArchetype(row.b));
  }
  return [...(DATA?.matchups?.values?.() || [])].filter(row => row.a === name && !ignoredArchetype(row.b));
}

function renderComparison() {
  const current = FORMAT_CACHES.get(MANIFEST?.current || 'TEF-PBL');
  const previous = FORMAT_CACHES.get(MANIFEST?.previous || 'TEF-CRI');
  const currentMeta = formatMeta(MANIFEST?.current || 'TEF-PBL');
  const previousMeta = formatMeta(MANIFEST?.previous || 'TEF-CRI');

  if (!current || !previous || !current.tournaments?.length || !previous.tournaments?.length) {
    $('comparisonTitle').textContent = 'Current vs previous legality';
    $('comparisonStatus').textContent = 'Historical reference unavailable';
    $('comparison').innerHTML = '<div class="comparison-empty">Current meta is live. Previous-format comparison will appear when the archived reference data is available.</div>';
    return;
  }

  const minPlayers = Math.max(50, Number($('minPlayers').value));
  const currentData = MetaEngine.aggregate(filteredFor(current, 'all', minPlayers));
  const previousData = MetaEngine.aggregate(filteredFor(previous, 'all', minPlayers));
  const previousByName = new Map(previousData.archetypes.map(x => [x.name, x]));
  const currentByName = new Map(currentData.archetypes.map(x => [x.name, x]));
  const names = new Set([...currentByName.keys(), ...previousByName.keys()]);

  const rows = [...names].map(name => {
    const now = currentByName.get(name);
    const before = previousByName.get(name);
    return {
      name,
      current: now?.share ?? 0,
      previous: before?.share ?? 0,
      change: (now?.share ?? 0) - (before?.share ?? 0),
      currentPlayers: now?.players ?? 0,
      previousPlayers: before?.players ?? 0,
      isNew: !!now && !before,
      disappeared: !now && !!before,
    };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.current - a.current).slice(0, 20);

  const currentLabel = currentMeta?.label || 'TEF–PBL';
  const previousLabel = previousMeta?.label || 'TEF–CRI';
  $('comparisonTitle').textContent = `${currentLabel} vs ${previousLabel}`;
  $('comparisonStatus').textContent = `${currentData.tournamentCount} vs ${previousData.tournamentCount} tournaments`;
  $('comparison').innerHTML = '<table><thead><tr><th>Archetype</th><th>Current</th><th>Previous</th><th>Change</th><th>Status</th></tr></thead><tbody>' + rows.map(r => {
    const status = r.isNew ? 'New' : r.disappeared ? 'Absent now' : '';
    const changeClass = r.change > 0.05 ? 'change-up' : r.change < -0.05 ? 'change-down' : '';
    return `<tr><td><b>${escapeHtml(r.name)}</b></td><td>${fmt(r.current)}</td><td>${r.previousPlayers ? fmt(r.previous) : '—'}</td><td class="${changeClass}">${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)} pp</td><td>${status}</td></tr>`;
  }).join('') + '</tbody></table>';
}

function applyFilters() {
  if (!CACHE) return;
  const daysValue = $('days').value;
  const requestedMinPlayers = Number($('minPlayers').value);
  const cacheFloor = Number(CACHE.minTournamentSize || 0);
  const minPlayers = Math.max(requestedMinPlayers, cacheFloor);

  FILTERED_TOURNAMENTS = filteredFor(CACHE, daysValue, minPlayers);
  DATA = MetaEngine.aggregate(FILTERED_TOURNAMENTS);
  render();
  renderComparison();
}

function render() {
  const archetypes = DATA?.archetypes || [];
  $('summary').innerHTML = `
    <div class="metric"><b>${DATA?.tournamentCount || 0}</b><span>Tournaments</span></div>
    <div class="metric"><b>${DATA?.totalPlayers || 0}</b><span>Deck entries</span></div>
    <div class="metric"><b>${DATA?.matches || 0}</b><span>Loaded pairings</span></div>
    <div class="metric"><b>${archetypes.length}</b><span>Archetypes</span></div>`;

  $('metaBody').innerHTML = archetypes.map(row => `
    <tr class="click" data-archetype="${escapeHtml(row.name)}">
      <td><b>${escapeHtml(row.name)}</b></td><td>${row.players}</td><td>${fmt(row.share)}</td>
      <td>${row.wins}</td><td>${row.losses}</td><td>${row.ties}</td><td>${fmt(row.winRate)}</td>
    </tr>`).join('');

  document.querySelectorAll('#metaBody tr').forEach(row => row.addEventListener('click', () => openArchetype(row.dataset.archetype)));
  $('archSelect').innerHTML = archetypes.map(row => `<option>${escapeHtml(row.name)}</option>`).join('');
  $('archSelect').onchange = () => renderArchetype($('archSelect').value);
  renderMatrix();

  if (archetypes[0]) renderArchetype(archetypes[0].name);
  else {
    $('archTitle').textContent = 'No archetype data';
    $('archSummary').innerHTML = '';
    $('trendSummary').innerHTML = '';
    $('trendChart').innerHTML = '<div class="chart-empty">No data for these filters.</div>';
    $('archMatchups').innerHTML = '';
    $('archResults').innerHTML = '';
  }
  window.SearchableDecks?.sync?.();
}

function renderMatrix() {
  const minMatches = Number($('minMatches').value);
  const top = (DATA?.archetypes || []).slice(0, 15);
  let html = '<table><thead><tr><th>Deck</th>' + top.map(x => `<th title="${escapeHtml(x.name)}">${short(x.name)}</th>`).join('') + '</tr></thead><tbody>';
  for (const row of top) {
    html += `<tr><th>${escapeHtml(row.name)}</th>`;
    for (const col of top) {
      const matchup = onlineMatchup(row.name, col.name);
      const decisive = matchup ? Number(matchup.wins || 0) + Number(matchup.losses || 0) : 0;
      const games = matchup ? Number(matchup.games || decisive + Number(matchup.ties || 0)) : 0;
      const value = matchup && games >= minMatches && decisive > 0 ? fmt(100 * Number(matchup.wins || 0) / decisive) : '—';
      const title = matchup ? `${matchup.wins}-${matchup.losses}-${matchup.ties} (${games} games)${usingFullMatchups() ? ' • all PBL events' : ''}` : '';
      html += `<td title="${escapeHtml(title)}">${value}</td>`;
    }
    html += '</tr>';
  }
  $('matrix').innerHTML = html + '</tbody></table>';
}

function archetypeOf(standing) { return standing?.deck?.name || 'Unknown'; }

function trendPoints(name) {
  if (!FILTERED_TOURNAMENTS.length) return { points: [], rollingDays: 7 };
  const daysValue = $('days').value;
  const dates = FILTERED_TOURNAMENTS.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
  if (!dates.length) return { points: [], rollingDays: 7 };

  const now = new Date(Math.max(...dates));
  now.setHours(23, 59, 59, 999);
  const earliest = new Date(Math.min(...dates));
  earliest.setHours(0, 0, 0, 0);
  const requestedDays = daysValue === 'all' ? Math.max(1, Math.ceil((now - earliest) / 86400000) + 1) : Number(daysValue);
  const rollingDays = requestedDays <= 14 ? 3 : 7;
  const start = daysValue === 'all' ? earliest : new Date(now.getTime() - (requestedDays - 1) * 86400000);
  const pointCount = Math.max(1, Math.ceil((now - start) / 86400000) + 1);
  const points = [];

  for (let i = 0; i < pointCount; i++) {
    const end = new Date(start.getTime() + i * 86400000);
    end.setHours(23, 59, 59, 999);
    const windowStart = new Date(end.getTime() - (rollingDays - 1) * 86400000);
    windowStart.setHours(0, 0, 0, 0);
    let total = 0;
    let target = 0;

    for (const t of FILTERED_TOURNAMENTS) {
      const ts = new Date(t.date).getTime();
      if (ts < windowStart.getTime() || ts > end.getTime()) continue;
      for (const standing of t.standings || []) {
        const arch = archetypeOf(standing);
        if (ignoredArchetype(arch)) continue;
        total += 1;
        if (arch === name) target += 1;
      }
    }
    if (total > 0) points.push({ date: end, share: 100 * target / total, total, target });
  }
  return { points, rollingDays };
}

function renderTrend(name) {
  const { points, rollingDays } = trendPoints(name);
  if (points.length < 2) {
    $('trendSummary').textContent = `${rollingDays}-day rolling share`;
    $('trendChart').innerHTML = '<div class="chart-empty">Not enough tournament data to draw a trend.</div>';
    return;
  }

  const first = points[0].share;
  const latest = points[points.length - 1].share;
  const change = latest - first;
  $('trendSummary').innerHTML = `<b>${fmt(latest)}</b><span>${change >= 0 ? '+' : ''}${change.toFixed(1)} pp • ${rollingDays}-day rolling</span>`;

  const W = 820, H = 250, L = 48, R = 18, T = 18, B = 34;
  const plotW = W - L - R, plotH = H - T - B;
  const maxValue = Math.max(5, ...points.map(p => p.share));
  const yMax = Math.ceil((maxValue * 1.12) / 5) * 5;
  const x = i => L + (i / Math.max(1, points.length - 1)) * plotW;
  const y = v => T + plotH - (v / yMax) * plotH;
  const poly = points.map((p, i) => `${x(i).toFixed(1)},${y(p.share).toFixed(1)}`).join(' ');
  const grid = [0, .25, .5, .75, 1].map(frac => {
    const value = yMax * frac;
    const yy = y(value);
    return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="chart-grid"/><text x="${L-8}" y="${yy+4}" text-anchor="end" class="chart-label">${value.toFixed(0)}%</text>`;
  }).join('');
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.share)}" r="3" class="chart-dot"><title>${p.date.toLocaleDateString()}: ${p.share.toFixed(1)}% (${p.target}/${p.total})</title></circle>`).join('');
  const firstDate = points[0].date.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  const lastDate = points[points.length-1].date.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  $('trendChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(name)} meta share trend">${grid}<polyline points="${poly}" class="chart-line"/>${dots}<text x="${L}" y="${H-8}" class="chart-label">${escapeHtml(firstDate)}</text><text x="${W-R}" y="${H-8}" text-anchor="end" class="chart-label">${escapeHtml(lastDate)}</text></svg>`;
}

function renderArchetype(name) {
  const archetype = DATA?.archetypes?.find(x => x.name === name);
  if (!archetype) return;
  $('archTitle').textContent = name;
  $('archSelect').value = name;
  $('archSummary').innerHTML = `
    <div class="metric"><b>${archetype.players}</b><span>50+ event entries</span></div>
    <div class="metric"><b>${fmt(archetype.share)}</b><span>50+ event meta share</span></div>
    <div class="metric"><b>${fmt(archetype.winRate)}</b><span>50+ event win rate</span></div>
    <div class="metric"><b>${archetype.wins}-${archetype.losses}-${archetype.ties}</b><span>50+ event record</span></div>`;

  renderTrend(name);

  const matchups = onlineMatchupsFor(name).sort((a, b) => Number(b.games || 0) - Number(a.games || 0)).slice(0, 30);
  const matchupSource = usingFullMatchups() ? 'All PBL Standard events' : 'Loaded tournament pairings';
  $('archMatchups').innerHTML = `<div class="inspect-note"><b>${escapeHtml(matchupSource)}</b> • matchup evidence is independent from the 50+ event meta model.</div><table><thead><tr><th>Opponent</th><th>Games</th><th>Record</th><th>Win %</th></tr></thead><tbody>` +
    matchups.map(m => { const d = Number(m.wins || 0) + Number(m.losses || 0); const games = Number(m.games || d + Number(m.ties || 0)); return `<tr><td>${escapeHtml(m.b)}</td><td>${games}</td><td>${m.wins}-${m.losses}-${m.ties}</td><td>${d ? fmt(100 * Number(m.wins || 0) / d) : '—'}</td></tr>`; }).join('') + '</tbody></table>';

  const results = DATA.results.filter(x => x.archetype === name).sort((a, b) => a.placing - b.placing || new Date(b.date) - new Date(a.date)).slice(0, 20);
  $('archResults').innerHTML = '<table><thead><tr><th>Place</th><th>Player</th><th>Event</th><th>Record</th></tr></thead><tbody>' +
    results.map(r => `<tr><td>${r.placing}/${r.players}</td><td>${escapeHtml(r.player)}</td><td>${escapeHtml(r.tournament)}</td><td>${r.record?.wins || 0}-${r.record?.losses || 0}-${r.record?.ties || 0}</td></tr>`).join('') + '</tbody></table>';
  window.SearchableDecks?.sync?.();
}

function openArchetype(name) {
  document.querySelector('[data-tab="archetype"]').click();
  renderArchetype(name);
}

$('apply').onclick = applyFilters;
setupTabs();
window.addEventListener('deckagg:updated', () => {
  if (!DATA || CACHE?.format !== 'TEF-PBL') return;
  renderMatrix();
  const selected = $('archSelect')?.value;
  if (selected) renderArchetype(selected);
});
// Startup is deliberately owned by live.js. Archived GitHub data is loaded only
// if live loading fails or the user explicitly selects a historical legality.
