const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('Training history is explicitly newest-first including same-day entries',()=>{
  const source=read('v2-preview/apps/decklists/training.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/Date\.parse\(b\.playedAt\)-Date\.parse\(a\.playedAt\)/);
  assert.match(source,/Date\.parse\(b\.createdAt\)-Date\.parse\(a\.createdAt\)/);
  assert.match(source,/PTCGPersonalResults\?\.compareRecent/);
});

test('Training history uses canonical deck sprites for both sides without regressing import flow',()=>{
  const html=read('v2-preview/apps/decklists/index.html');
  const source=read('v2-preview/apps/decklists/training.js');
  const css=read('v2-preview/apps/decklists/training-history-polish.css');
  assert.match(html,/training-history-polish\.css\?v=2/);
  assert.match(html,/training\.js\?v=6/);
  assert.match(html,/personal-results\.js\?v=2/);
  assert.match(source,/deckArchetypes=new Map/);
  assert.match(source,/window\.DeckSprites\?\.html/);
  assert.match(source,/training-matchup-side/);
  assert.match(source,/training-matchup-art/);
  assert.match(source,/deckVersionLabelSnapshot/);
  assert.match(css,/\.training-matchup\{/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(source,/navigator\.clipboard\?\.readText/);
  assert.match(source,/scheduleImportParse/);
});

test('Record tournament stacks Date and Type cleanly on narrow phones',()=>{
  const html=read('v2-preview/apps/events/index.html');
  const css=read('v2-preview/apps/events/record-tournament-mobile-polish.css');
  assert.match(html,/record-tournament-mobile-polish\.css\?v=1/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/\.record-quick-row\{grid-template-columns:1fr;gap:10px\}/);
  assert.match(css,/line-height:normal/);
  assert.match(css,/min-width:0/);
});
