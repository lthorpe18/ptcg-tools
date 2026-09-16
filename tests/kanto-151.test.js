const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Kanto 151 spin-off is a standalone three-column mobile grid',()=>{
  const html=read('index.html');
  const css=read('style.css');
  assert.match(html,/\.\.\/\.\.\/apps\/_shared\/card-catalog\.js/);
  assert.match(html,/\.\.\/\.\.\/apps\/_shared\/card-images\.js/);
  assert.match(css,/grid-template-columns:\s*repeat\(3,/);
  assert.doesNotMatch(html,/bottom-nav|app-shell|main-navigation/i);
});

test('Kanto grid contains the complete original 151 in National Dex order',()=>{
  const source=read('app.js');
  const match=source.match(/const POKEMON=\[(.*?)\]\s*\.map/s);
  assert.ok(match,'POKEMON array is present');
  const names=Function(`return [${match[1]}]`)();
  assert.equal(names.length,151);
  assert.equal(new Set(names).size,151);
  assert.equal(names[0],'Bulbasaur');
  assert.equal(names[24],'Pikachu');
  assert.equal(names[149],'Mewtwo');
  assert.equal(names[150],'Mew');
});

test('selection and ownership are separately persisted',()=>{
  const source=read('app.js');
  assert.match(source,/ptcg-kanto-151-v1/);
  assert.match(source,/card:compactCard\(card\),owned:/);
  assert.match(source,/state\[number\]\.owned=!state\[number\]\.owned/);
  assert.match(source,/searchInput\.value=activePokemon\.name/);
  assert.match(source,/category:'Pokemon'/);
});
