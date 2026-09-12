const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const home=fs.readFileSync('v2-preview/scripts/home.js','utf8');
const sprites=fs.readFileSync('v2-preview/apps/_shared/deck-sprites.js','utf8');
const legacySprites=fs.readFileSync('v2-preview/apps/meta/sprites.js','utf8');
const spritePolish=fs.readFileSync('v2-preview/apps/meta/sprite-polish.css','utf8');
const metaHtml=fs.readFileSync('v2-preview/apps/meta/index.html','utf8');
const results=fs.readFileSync('v2-preview/apps/decklists/deck-results.js','utf8');
const training=fs.readFileSync('v2-preview/apps/decklists/training.js','utf8');
const canonical=fs.readFileSync('v2-preview/apps/decklists/deck-sprites-canonical.js','utf8');
const tournaments=fs.readFileSync('v2-preview/apps/events/tournaments-inline.js','utf8');
const tournamentHistory=fs.readFileSync('v2-preview/apps/events/tournament-day-history-v2.js','utf8');
const tournamentDeck=fs.readFileSync('v2-preview/apps/events/tournament-day-optional-deck.js','utf8');
const deckHtml=fs.readFileSync('v2-preview/apps/decklists/index.html','utf8');
const homeHtml=fs.readFileSync('v2-preview/home-content.html','utf8');
const homeTweaks=fs.readFileSync('v2-preview/home-tweaks.css','utf8');
const shell=fs.readFileSync('v2-preview/index.html','utf8');

test('shared DeckSprites is the one owner of primary plus circular secondary deck identity',()=>{
  assert.match(sprites,/function html\(name, options = \{\}\)/);
  assert.match(sprites,/deck-sprite-primary/);
  assert.match(sprites,/deck-sprite-secondary-badge/);
  assert.match(sprites,/border-radius:50%/);
  assert.match(sprites,/background:#dff8e8/);
  assert.match(sprites,/THE single deck\/archetype identity renderer/);
  assert.match(sprites,/image-rendering:pixelated!important/);
  assert.doesNotMatch(sprites,/display:inline-flex!important;align-items:center;gap:/);
});

test('legacy Meta sprite entrypoint is only a compatibility bridge to shared renderer',()=>{
  assert.match(legacySprites,/\.\.\/_shared\/deck-sprites\.js\?v=2/);
  assert.doesNotMatch(legacySprites,/function html\(/);
  assert.doesNotMatch(legacySprites,/const EXACT/);
});

test('Current Meta reserves only the canonical single-stack footprint',()=>{
  assert.match(spritePolish,/\.current-sprites\{[^}]*flex:0 0 38px!important/);
  assert.match(spritePolish,/width:38px!important/);
  assert.match(metaHtml,/sprite-polish\.css\?v=4/);
  assert.match(metaHtml,/sprites\.js\?v=5/);
});

test('Home delegates deck identity rendering to canonical DeckSprites renderer',()=>{
  assert.match(home,/function spriteVisual\(name\)/);
  assert.match(home,/sprites\?\.html/);
  assert.match(home,/sprites\.html\(name,\{size:48,className:'home-meta-hero-sprite'\}\)/);
  assert.match(home,/function compactSprite\(name\)[\s\S]*spriteVisual\(name\)/);
  assert.match(home,/function heroSprite\(name\)[\s\S]*spriteVisual\(name\)/);
  assert.doesNotMatch(home,/home-meta-hero-secondary-badge/);
});

test('Home pins canonical children to accepted primary plus circular badge geometry',()=>{
  assert.match(homeTweaks,/\.home-meta-sprite-placeholder \.home-meta-hero-sprite \.deck-sprite-primary/);
  assert.match(homeTweaks,/\.home-preview-sprite \.home-meta-hero-sprite \.deck-sprite-primary/);
  assert.match(homeTweaks,/\.deck-sprite-secondary-badge \.deck-sprite-secondary\{position:static!important/);
  assert.match(homeTweaks,/right:-2px!important;bottom:-1px!important/);
  assert.match(homeTweaks,/width:25px!important;height:25px!important/);
});

test('Deck library, Results and Training all consume DeckSprites.html',()=>{
  assert.match(canonical,/window\.DeckSprites\.html\(label\|\|'',\{size\}\)/);
  assert.match(results,/window\.DeckSprites\?\.html/);
  assert.match(training,/window\.DeckSprites\?\.html/);
});

test('Compete deck identities consume DeckSprites.html instead of composing sprite images locally',()=>{
  for(const source of [tournaments,tournamentHistory,tournamentDeck]){
    assert.match(source,/(?:DeckSprites\?\.html|DeckSprites\.html)/);
    assert.doesNotMatch(source,/DeckSprites\?\.slugs/);
    assert.doesNotMatch(source,/DeckSprites\.url\(/);
  }
  assert.doesNotMatch(tournamentHistory,/PTCGSprites/);
});

test('cached entrypoints still reach shared renderer while canonical visuals remain cache-busted',()=>{
  assert.match(deckHtml,/\.\.\/meta\/sprites\.js\?v=6/);
  assert.match(deckHtml,/deck-results\.css\?v=4/);
  assert.match(homeHtml,/apps\/meta\/sprites\.js\?v=6/);
  assert.match(homeHtml,/home-tweaks\.css\?v=10/);
  assert.match(homeHtml,/scripts\/home\.js\?v=21/);
  assert.match(shell,/home-content\.html\?v=27/);
});
