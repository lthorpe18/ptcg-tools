const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','v2-preview','apps','decklists');
const js=fs.readFileSync(path.join(root,'deck-results.js'),'utf8');
const css=fs.readFileSync(path.join(root,'deck-results.css'),'utf8');

test('deck Results browser script parses cleanly',()=>{
  assert.doesNotThrow(()=>new Function(js));
});

test('deck Results replaces Odds as the visible third deck tab at runtime',()=>{
  assert.match(js,/oddsTab\.dataset\.tab='results'/);
  assert.match(js,/oddsTab\.textContent='Results'/);
  assert.match(js,/resultsTab\.id='tab-results'/);
  assert.match(js,/resultsTab\.appendChild\(panel\)/);
});

test('deck Results exposes archetype deck and version analysis levels with Deck as default',()=>{
  assert.match(js,/let resultScope='deck'/);
  assert.match(js,/data-results-scope="archetype"/);
  assert.match(js,/data-results-scope="deck" aria-selected="true"/);
  assert.match(js,/data-results-scope="version"/);
  assert.match(js,/aggregateArchetype/);
  assert.match(js,/aggregateVersion/);
});

test('version scope provides an exact saved version selector',()=>{
  assert.match(js,/id="deckResultsVersion"/);
  assert.match(js,/Exact version/);
  assert.match(js,/engine\.versionLabel/);
});

test('archetype and deck scopes switch the secondary breakdown correctly',()=>{
  assert.match(js,/resultScope==='archetype'\?'By deck':'By version'/);
  assert.match(js,/resultScope==='archetype'\?result\.decks:result\.versions/);
});

test('scope controls retain mobile-first layout support',()=>{
  assert.match(css,/\.deck-results-scope-bar/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/\.deck-results-version select\{width:100%\}/);
});