const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const home=fs.readFileSync('v2-preview/scripts/home.js','utf8');
const html=fs.readFileSync('v2-preview/home-content.html','utf8');
const shell=fs.readFileSync('v2-preview/index.html','utf8');

test('Home deck preview and Meta chart share one sprite visual renderer',()=>{
  assert.match(home,/function spriteVisual\(name\)/);
  assert.match(home,/function compactSprite\(name\)[\s\S]*spriteVisual\(name\)/);
  assert.match(home,/function heroSprite\(name\)[\s\S]*spriteVisual\(name\)/);
  assert.match(home,/home-meta-hero-secondary-badge/);
  assert.doesNotMatch(home,/DeckSprites\?\.html\?\.\(name,\{size:24\}\)/);
});

test('Home sprite renderer changes are cache busted through the persistent shell',()=>{
  assert.match(html,/scripts\/home\.js\?v=20/);
  assert.match(shell,/home-content\.html\?v=25/);
});
