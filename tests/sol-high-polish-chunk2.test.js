const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('shared archetype catalog owns the reusable list and search widget',()=>{
  const source=read('v2-preview/apps/_shared/archetype-catalog.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/function all\(\)/);
  assert.match(source,/function bindSearch\(input,list,options=\{\}\)/);
  assert.match(source,/global\.PTCGArchetypes=\{load,mergeSaved,all,search,bindSearch\}/);
  assert.match(source,/data-archetype=/);
});

test('Settings uses the canonical archetype catalog instead of rebuilding Meta names',()=>{
  const html=read('v2-preview/apps/settings/index.html');
  const source=read('v2-preview/apps/settings/settings.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.ok(html.indexOf('archetype-catalog.js?v=3')<html.indexOf('settings.js?v=5'));
  assert.match(source,/PTCGArchetypes\?\.load/);
  assert.match(source,/PTCGArchetypes\?\.mergeSaved/);
  assert.match(source,/PTCGArchetypes\?\.all/);
  assert.match(source,/PTCGArchetypes\?\.search/);
  assert.doesNotMatch(source,/collectFromData/);
  assert.doesNotMatch(source,/manifest\.json/);
  assert.doesNotMatch(source,/matchupScopes/);
});

test('Training opponent uses archetype search and PTCGL never auto-fills it',()=>{
  const html=read('v2-preview/apps/decklists/index.html');
  const source=read('v2-preview/apps/decklists/training.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(html,/id="matchOpponent" type="search"[^>]*placeholder="Search current archetypes…"/);
  assert.match(html,/id="matchOpponentSuggestions" class="archetype-suggestions"/);
  assert.match(html,/archetype-catalog\.js\?v=3/);
  assert.match(html,/training\.js\?v=3/);
  assert.match(source,/PTCGArchetypes\?\.bindSearch\?\.\(\$\('matchOpponent'\),\$\('matchOpponentSuggestions'\)\)/);
  assert.match(source,/PTCGArchetypes\?\.mergeSaved/);
  assert.doesNotMatch(source,/suggestedArchetype/);
  assert.doesNotMatch(source,/matchOpponent'\)\.value=view\.opponent/);
  assert.match(source,/matchOpponent'\)\.value=match\.opponentArchetype\|\|''/);
});
