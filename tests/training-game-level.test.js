const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'v2-preview/apps/decklists/training.js'),'utf8');
const html=fs.readFileSync(path.join(root,'v2-preview/apps/decklists/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'v2-preview/apps/decklists/training-history-polish.css'),'utf8');

test('Game Log script parses cleanly',()=>{
  assert.doesNotThrow(()=>new Function(source));
});

test('Game Log summary remains game-level rather than match-level',()=>{
  assert.match(source,/function gameStats\(rows\)/);
  assert.match(source,/\['Game record'/);
  assert.match(source,/\['Game win rate'/);
  assert.match(source,/\['Games',totals\.total\]/);
  assert.match(source,/trainingCount'\)\.textContent=`\$\{totals\.total\}/);
});

test('Game Log includes both training and Tournament Day evidence',()=>{
  assert.match(source,/const kind=match\.participationId\?'tournament':'training'/);
  assert.match(source,/type==='all'\|\|type===kind/);
  assert.doesNotMatch(source,/\.filter\(match=>!match\.participationId/);
  assert.match(html,/>Game Log</);
  assert.match(html,/<option value="training">Training<\/option>/);
  assert.match(html,/<option value="tournament">Tournaments<\/option>/);
});

test('tournament rows retain event context and open Tournament Day',()=>{
  assert.match(source,/PTCGStorage\?\.allParticipations/);
  assert.match(source,/snapshot\.scope==='online'/);
  assert.match(source,/platform\.toUpperCase\(\)\.includes\('PTCGL'\)/);
  assert.match(source,/tournament-day\.html\?participation=/);
  assert.match(source,/data-tournament="true"/);
});

test('Game Log makes the individual game outcomes visible',()=>{
  assert.match(source,/function gameBadges\(match\)/);
  assert.match(source,/training-game-results/);
  assert.match(source,/training-game-badge/);
  assert.match(css,/\.training-game-badge\.win/);
  assert.match(css,/\.training-game-badge\.loss/);
  assert.match(css,/\.training-game-badge\.draw/);
});

test('Game Log uses shared same-day newest-first ordering',()=>{
  assert.match(source,/PTCGPersonalResults\?\.compareRecent/);
  assert.match(source,/\.sort\(compareRecent\)/);
});