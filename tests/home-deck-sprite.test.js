const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const home=fs.readFileSync('v2-preview/scripts/home.js','utf8');
const sprites=fs.readFileSync('v2-preview/apps/meta/sprites.js','utf8');
const results=fs.readFileSync('v2-preview/apps/decklists/deck-results.js','utf8');
const training=fs.readFileSync('v2-preview/apps/decklists/training.js','utf8');
const canonical=fs.readFileSync('v2-preview/apps/decklists/deck-sprites-canonical.js','utf8');
const deckHtml=fs.readFileSync('v2-preview/apps/decklists/index.html','utf8');
const homeHtml=fs.readFileSync('v2-preview/home-content.html','utf8');
const shell=fs.readFileSync('v2-preview/index.html','utf8');

test('DeckSprites owns the Home-style primary plus circular secondary visual',()=>{
  assert.match(sprites,/function html\(name, options = \{\}\)/);
  assert.match(sprites,/deck-sprite-primary/);
  assert.match(sprites,/deck-sprite-secondary-badge/);
  assert.match(sprites,/border-radius:50%/);
  assert.match(sprites,/background:#dff8e8/);
  assert.doesNotMatch(sprites,/display:inline-flex!important;align-items:center;gap:/);
});

test('Home delegates deck identity rendering to the same canonical DeckSprites renderer',()=>{
  assert.match(home,/function spriteVisual\(name\)/);
  assert.match(home,/sprites\?\.html/);
  assert.match(home,/sprites\.html\(name,\{size:48,className:'home-meta-hero-sprite'\}\)/);
  assert.match(home,/function compactSprite\(name\)[\s\S]*spriteVisual\(name\)/);
  assert.match(home,/function heroSprite\(name\)[\s\S]*spriteVisual\(name\)/);
  assert.doesNotMatch(home,/home-meta-hero-secondary-badge/);
});

test('Deck library, Results and Training all consume canonical DeckSprites.html',()=>{
  assert.match(canonical,/window\.DeckSprites\.html\(label\|\|'',\{size\}\)/);
  assert.match(results,/window\.DeckSprites\?\.html/);
  assert.match(training,/window\.DeckSprites\?\.html/);
});

test('Home and Decks cache bust the canonical sprite renderer',()=>{
  assert.match(deckHtml,/\.\.\/meta\/sprites\.js\?v=6/);
  assert.match(deckHtml,/deck-results\.css\?v=4/);
  assert.match(homeHtml,/apps\/meta\/sprites\.js\?v=6/);
  assert.match(homeHtml,/scripts\/home\.js\?v=21/);
  assert.match(shell,/home-content\.html\?v=26/);
});