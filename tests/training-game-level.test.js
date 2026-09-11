const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'v2-preview/apps/decklists/training.js'),'utf8');
const css=fs.readFileSync(path.join(root,'v2-preview/apps/decklists/training-history-polish.css'),'utf8');

test('Training Log script parses cleanly',()=>{
  assert.doesNotThrow(()=>new Function(source));
});

test('Training Log summary is game-level rather than match-level',()=>{
  assert.match(source,/function gameStats\(rows\)/);
  assert.match(source,/\['Game record'/);
  assert.match(source,/\['Game win rate'/);
  assert.match(source,/\['Games',totals\.total\]/);
  assert.match(source,/trainingCount'\)\.textContent=`\$\{totals\.total\}/);
});

test('Training Log excludes Tournament Day matches while retaining their shared store',()=>{
  assert.match(source,/\.filter\(match=>!match\.participationId/);
});

test('Training history makes the individual game outcomes visible',()=>{
  assert.match(source,/function gameBadges\(match\)/);
  assert.match(source,/training-game-results/);
  assert.match(source,/training-game-badge/);
  assert.match(css,/\.training-game-badge\.win/);
  assert.match(css,/\.training-game-badge\.loss/);
  assert.match(css,/\.training-game-badge\.draw/);
});

test('Training history uses shared same-day newest-first ordering',()=>{
  assert.match(source,/PTCGPersonalResults\?\.compareRecent/);
  assert.match(source,/\.sort\(compareRecent\)/);
});