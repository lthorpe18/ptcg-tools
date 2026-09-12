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

test('Game Log summary is one game-level total record win-rate row with no entry count',()=>{
  assert.match(source,/function gameStats\(rows\)/);
  assert.match(source,/\$\{totals\.total\} \$\{totals\.total===1\?'game':'games'\}/);
  assert.match(source,/\$\{totals\.wins\}–\$\{totals\.losses\}–\$\{totals\.draws\}/);
  assert.match(source,/Math\.round\(totals\.winRate\*100\)/);
  assert.doesNotMatch(source,/\['Entries'/);
  assert.match(css,/\.training-metrics\{display:flex/);
});

test('Game Log includes training and every event-linked Tournament Day game',()=>{
  assert.match(source,/if\(!match\?\.participationId\)return \{kind:'training'/);
  assert.match(source,/filter==='tournament'\|\|filter==='tournament:all'/);
  assert.doesNotMatch(source,/\.filter\(match=>!match\.participationId/);
  assert.match(html,/>Game Log</);
  assert.match(html,/<option value="training">Training<\/option>/);
  assert.match(html,/<option value="tournament:all">Tournaments — all<\/option>/);
});

test('Tournament filter hierarchy supports online local league cups challenges and majors',()=>{
  for(const value of ['tournament:online','tournament:local','tournament:challenge','tournament:cup','tournament:majors','tournament:regional','tournament:special','tournament:international','tournament:worlds'])assert.match(html,new RegExp(`value="${value}"`));
  assert.doesNotMatch(html,/value="tournament:prerelease"/);
  assert.doesNotMatch(html,/value="tournament:other"/);
  assert.match(source,/type==='League Challenge'/);
  assert.match(source,/type==='League Cup'/);
  assert.match(source,/type==='Regional'/);
  assert.match(source,/type==='Special Championship'\|\|type==='Special Event'/);
  assert.match(source,/type==='International'/);
  assert.match(source,/type==='World Championships'\|\|type==='Worlds'/);
  assert.match(source,/filter==='tournament:majors'\)return category\.major/);
});

test('Online tournament classification uses participation metadata rather than match source',()=>{
  assert.match(source,/PTCGStorage\?\.allParticipations/);
  assert.match(source,/scope==='online'/);
  assert.match(source,/environment==='online'/);
  assert.match(source,/platform\.includes\('PTCGL'\)/);
});

test('Game Log renders one compact sprite-led row per individual game grouped by date',()=>{
  assert.match(source,/gamesFor\(match\)\.forEach\(\(game,index\)=>out\.push\(\{match,game,index\}\)\)/);
  assert.match(source,/training-day-group/);
  assert.match(source,/training-day-heading/);
  assert.match(source,/training-sprite-matchup/);
  assert.match(source,/training-result/);
  assert.doesNotMatch(source,/function gameBadges/);
  assert.match(css,/\.training-day-heading\{/);
  assert.match(css,/\.training-row\{display:grid/);
});

test('Tournament game rows open Tournament Day while training rows remain editable',()=>{
  assert.match(source,/tournament-day\.html\?participation=/);
  assert.match(source,/data-tournament="true"/);
  assert.match(source,/if\(row&&!row\.dataset\.tournament\)openMatch/);
});

test('Game Log uses shared same-day newest-first ordering',()=>{
  assert.match(source,/PTCGPersonalResults\?\.compareRecent/);
  assert.match(source,/\.sort\(compareRecent\)/);
});