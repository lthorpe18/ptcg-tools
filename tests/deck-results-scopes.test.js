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

test('exact version selector is only shown in Version scope',()=>{
  assert.match(js,/id="deckResultsVersion"/);
  assert.match(js,/if\(wrap\)wrap\.hidden=resultScope!==['"]version['"]/);
  assert.match(js,/select&&versionAvailable&&resultScope===['"]version['"]/);
  assert.match(css,/\.deck-results-version\[hidden\]\{display:none!important\}/);
});

test('Results summary is one compact record strip rather than a metric-card grid',()=>{
  assert.match(js,/function summaryStrip\(result\)/);
  assert.match(js,/deck-results-summary-stat/);
  assert.match(js,/Game record|Record/);
  assert.match(js,/Win rate/);
  assert.doesNotMatch(css,/\.deck-results-metric\{/);
  assert.match(css,/\.deck-results-summary-main\{display:flex/);
});

test('matchup and archetype deck rows use canonical deck sprites',()=>{
  assert.match(js,/window\.DeckSprites\?\.html/);
  assert.match(js,/function matchupRows\(rows\)/);
  assert.match(js,/function deckRows\(rows,deckById\)/);
  assert.match(js,/spriteHtml\(row\.label,32\)/);
  assert.match(js,/spriteHtml\(spriteLabel,32\)/);
  assert.match(css,/\.deck-results-row-sprite/);
});

test('matchups render as compact stats tables with record and win rate columns',()=>{
  assert.match(js,/tableHeader\('Opponent'\)/);
  assert.match(js,/tableHeader\('Deck'\)/);
  assert.match(js,/tableHeader\('Version'\)/);
  assert.match(css,/\.deck-results-table-head\{/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 82px 68px/);
});

test('archetype and deck scopes switch the secondary breakdown correctly',()=>{
  assert.match(js,/resultScope==='archetype'\?result\.decks:result\.versions/);
  assert.match(js,/resultScope==='archetype'\?deckRows\(rows\|\|\[\],deckById\):versionRows\(rows\|\|\[\]\)/);
  assert.match(js,/resultScope==='archetype'\?'Decks':'Versions'/);
});

test('recent evidence is game-level and shows both deck identities with sprites',()=>{
  assert.match(js,/recentGameRows\(result\.recentGames,resultScope,deckById\)/);
  assert.match(js,/spriteHtml\(ownLabel,27\)/);
  assert.match(js,/spriteHtml\(opponent,27\)/);
  assert.match(js,/row\.parentMatchId\|\|row\.id/);
  assert.match(css,/\.deck-results-recent-sprites/);
});

test('zero-value source boxes are omitted and tournament match record stays secondary',()=>{
  assert.match(js,/if\(result\.ptcgl\.total\)/);
  assert.match(js,/if\(result\.inPersonTraining\.total\)/);
  assert.match(js,/if\(result\.tournamentGames\.total\)/);
  assert.match(js,/result\.tournament\.total/);
  assert.match(css,/\.deck-results-tournament-record/);
});

test('hidden empty and source states cannot consume white space',()=>{
  assert.match(css,/\.deck-results-empty-action\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.deck-results-source-strip\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.deck-results-head-copy p\{display:none\}/);
});

test('scope and stats tables stay dense on mobile',()=>{
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/\.deck-results-version\{width:100%;flex:none\}/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 76px 58px/);
  assert.match(css,/@media\(max-width:390px\)/);
});