let DATA = null;
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toFixed(1) + '%';

function setStatus(text) { $('status').textContent = text; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function short(value) {
  const s = String(value || '');
  return escapeHtml(s.length > 16 ? s.slice(0, 14) + '…' : s);
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

async function load() {
  try {
    const days = Number($('days').value);
    const minPlayers = Number($('minPlayers').value);
    const cutoff = Date.now() - days * 86400000;
    setStatus('Loading tournaments…');

    let tournaments = await LimitlessAPI.tournaments({ limit: 100, page: 0 });
    tournaments = tournaments.filter(t => new Date(t.date).getTime() >= cutoff && t.players >= minPlayers);

    const loaded = [];
    for (let i = 0; i < tournaments.length; i++) {
      const tournament = tournaments[i];
      setStatus(`Loading ${i + 1}/${tournaments.length}: ${tournament.name}`);
      try {
        const [standings, pairings] = await Promise.all([
          LimitlessAPI.standings(tournament.id),
          LimitlessAPI.pairings(tournament.id),
        ]);
        loaded.push({ ...tournament, standings, pairings });
      } catch (error) {
        console.warn('Skipping tournament', tournament.id, error);
      }
    }

    DATA = MetaEngine.aggregate(loaded);
    render();
    setStatus(`Updated • ${DATA.tournamentCount} tournaments`);
  } catch (error) {
    console.error(error);
    setStatus('Error: ' + error.message);
  }
}

function render() {
  const archetypes = DATA.archetypes;
  $('summary').innerHTML = `
    <div class="metric"><b>${DATA.tournamentCount}</b><span>Tournaments</span></div>
    <div class="metric"><b>${DATA.totalPlayers}</b><span>Deck entries</span></div>
    <div class="metric"><b>${DATA.matches}</b><span>Matches</span></div>
    <div class="metric"><b>${archetypes.length}</b><span>Archetypes</span></div>`;

  $('metaBody').innerHTML = archetypes.map(row => `
    <tr class="click" data-archetype="${escapeHtml(row.name)}">
      <td><b>${escapeHtml(row.name)}</b></td><td>${row.players}</td><td>${fmt(row.share)}</td>
      <td>${row.wins}</td><td>${row.losses}</td><td>${row.ties}</td><td>${fmt(row.winRate)}</td>
    </tr>`).join('');

  document.querySelectorAll('#metaBody tr').forEach(row => {
    row.addEventListener('click', () => openArchetype(row.dataset.archetype));
  });

  $('archSelect').innerHTML = archetypes.map(row => `<option>${escapeHtml(row.name)}</option>`).join('');
  $('archSelect').onchange = () => renderArchetype($('archSelect').value);
  renderMatrix();
  if (archetypes[0]) renderArchetype(archetypes[0].name);
}

function renderMatrix() {
  const minMatches = Number($('minMatches').value);
  const top = DATA.archetypes.slice(0, 15);
  let html = '<table><thead><tr><th>Deck</th>' + top.map(x => `<th title="${escapeHtml(x.name)}">${short(x.name)}</th>`).join('') + '</tr></thead><tbody>';

  for (const row of top) {
    html += `<tr><th>${escapeHtml(row.name)}</th>`;
    for (const col of top) {
      const matchup = DATA.matchups.get(`${row.name}|||${col.name}`);
      const value = matchup && matchup.games >= minMatches
        ? fmt(100 * matchup.wins / (matchup.wins + matchup.losses))
        : '—';
      const title = matchup ? `${matchup.wins}-${matchup.losses}-${matchup.ties} (${matchup.games} games)` : '';
      html += `<td title="${title}">${value}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  $('matrix').innerHTML = html;
}

function renderArchetype(name) {
  const archetype = DATA.archetypes.find(x => x.name === name);
  if (!archetype) return;
  $('archTitle').textContent = name;
  $('archSelect').value = name;
  $('archSummary').innerHTML = `
    <div class="metric"><b>${archetype.players}</b><span>Players</span></div>
    <div class="metric"><b>${fmt(archetype.share)}</b><span>Meta share</span></div>
    <div class="metric"><b>${fmt(archetype.winRate)}</b><span>Win rate</span></div>
    <div class="metric"><b>${archetype.wins}-${archetype.losses}-${archetype.ties}</b><span>Record</span></div>`;

  const matchups = [...DATA.matchups.values()].filter(x => x.a === name).sort((a, b) => b.games - a.games).slice(0, 20);
  $('archMatchups').innerHTML = '<table><thead><tr><th>Opponent</th><th>Games</th><th>Record</th><th>Win %</th></tr></thead><tbody>' +
    matchups.map(m => `<tr><td>${escapeHtml(m.b)}</td><td>${m.games}</td><td>${m.wins}-${m.losses}-${m.ties}</td><td>${fmt(100 * m.wins / (m.wins + m.losses))}</td></tr>`).join('') + '</tbody></table>';

  const results = DATA.results.filter(x => x.archetype === name).sort((a, b) => a.placing - b.placing).slice(0, 20);
  $('archResults').innerHTML = '<table><thead><tr><th>Place</th><th>Player</th><th>Event</th><th>Record</th></tr></thead><tbody>' +
    results.map(r => `<tr><td>${r.placing}/${r.players}</td><td>${escapeHtml(r.player)}</td><td>${escapeHtml(r.tournament)}</td><td>${r.record?.wins || 0}-${r.record?.losses || 0}-${r.record?.ties || 0}</td></tr>`).join('') + '</tbody></table>';
}

function openArchetype(name) {
  document.querySelector('[data-tab="archetype"]').click();
  renderArchetype(name);
}

$('apply').onclick = load;
$('refresh').onclick = load;
setupTabs();
load();
