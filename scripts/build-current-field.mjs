import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceFile = path.join(root, 'data', 'meta', 'formats', 'TEF-PBL.json');
const outputFile = path.join(root, 'data', 'meta', 'current-field.json');

const source = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
const tournaments = [];

for (const tournament of source.tournaments || []) {
  const archetypes = new Map();
  for (const standing of tournament.standings || []) {
    const name = standing?.deck?.name;
    if (!name || name === 'Other' || name === 'Unknown') continue;
    const row = archetypes.get(name) || { name, entries: 0, wins: 0, losses: 0, ties: 0 };
    row.entries += 1;
    row.wins += Number(standing.record?.wins || 0);
    row.losses += Number(standing.record?.losses || 0);
    row.ties += Number(standing.record?.ties || 0);
    archetypes.set(name, row);
  }

  if (!archetypes.size) continue;
  tournaments.push({
    id: String(tournament.id),
    name: tournament.name || '',
    date: tournament.date,
    players: Number(tournament.players || 0),
    archetypes: [...archetypes.values()].sort((a, b) => b.entries - a.entries),
  });
}

const payload = {
  schemaVersion: 1,
  generatedAt: source.generatedAt || new Date().toISOString(),
  format: source.format || 'TEF-PBL',
  label: source.label || 'TEF–PBL',
  formatStart: source.formatStart || '2026-07-17T00:00:00Z',
  minTournamentSize: Number(source.minTournamentSize || 50),
  tournamentCount: tournaments.length,
  tournaments,
};

await fs.writeFile(outputFile, JSON.stringify(payload));
const dates = tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
console.log(`Wrote ${outputFile}: ${tournaments.length} tournaments; ${dates.length ? new Date(Math.min(...dates)).toISOString().slice(0,10) : 'n/a'} to ${dates.length ? new Date(Math.max(...dates)).toISOString().slice(0,10) : 'n/a'}`);
