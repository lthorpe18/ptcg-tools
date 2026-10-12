const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const matchStore=fs.readFileSync(path.join(root,'v2-preview/apps/_shared/match-store.js'),'utf8');
const training=fs.readFileSync(path.join(root,'v2-preview/apps/decklists/training.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'v2-preview/sw.js'),'utf8');

test('shared Match store notifies Game Log for same-document tournament writes',()=>{
  assert.match(matchStore,/addEventListener\('storage',onStorage\)/);
  assert.match(matchStore,/addEventListener\('ptcg:local-change',onLocalChange\)/);
  assert.match(matchStore,/event\.detail\.source==='root-state'/);
  assert.match(matchStore,/removeEventListener\('ptcg:local-change',onLocalChange\)/);
});

test('Game Log remains subscribed to canonical Match store changes',()=>{
  assert.match(training,/PTCGMatchStore\.subscribe\(\(\)=>\{loadDeckRefs\(\)\.then\(render\)/);
  assert.match(training,/PTCGMatchStore\.all\(\)/);
  assert.doesNotMatch(training,/\.filter\(match=>!match\.participationId/);
});

test('installed app refreshes canonical root and Match store scripts network-first',()=>{
  assert.match(sw,/networkFirstStateAsset/);
  assert.match(sw,/\(\?:storage\|match-store\)\\\.js/);
  assert.match(sw,/cache:'no-store'/);
  assert.match(sw,/ptcg-tools-v35/);
});
