const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Kanto filters are collapsed and simplified',()=>{
  const html=read('index.html');
  const css=read('style.css');
  assert.match(html,/id="filters-panel"[^>]*hidden/);
  assert.match(css,/\.filters-panel\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(html,/id="filter-set"/);
  assert.doesNotMatch(html,/id="filter-set"[^>]*maxlength=/);
  assert.match(html,/<select id="filter-rarity">/);
  assert.doesNotMatch(html,/id="filter-type"|id="filter-stage"|id="filter-hp-min"|id="filter-hp-max"/);
});

test('Kanto set code accepts canonical deck identities of any length',()=>{
  const source=read('app.js');
  assert.match(source,/normaliseSetCode/);
  assert.doesNotMatch(source,/slice\(0,3\)/);
  assert.match(source,/catalog\.exactDeckIdentity\(card\)/);
  assert.match(source,/normaliseSetCode\(identity\?\.set\)===setCode/);
});
