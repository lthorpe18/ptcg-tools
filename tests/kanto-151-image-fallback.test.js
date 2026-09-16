const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Kanto 151 loads dedicated image fallback hydration after the app',()=>{
  const html=read('index.html');
  const appIndex=html.indexOf('<script src="./app.js"></script>');
  const fallbackIndex=html.indexOf('<script src="./image-fallback.js"></script>');
  assert.ok(appIndex>=0,'app script is present');
  assert.ok(fallbackIndex>appIndex,'image fallback loads after app rendering');
});

test('Kanto 151 images use the canonical shared resolver instead of direct TCGdex URLs alone',()=>{
  const source=read('image-fallback.js');
  assert.match(source,/window\.PTCGCardImages/);
  assert.match(source,/images\.resolve\(card,\{catalog,quality\}\)/);
  assert.match(source,/catalog\.card\(id\)/);
  assert.match(source,/\.search-card\[data-card-id\]/);
  assert.match(source,/\.dex-slot\[data-number\]/);
  assert.match(source,/zoom-image/);
});

test('image hydration can create an image when the initial provider supplied no image',()=>{
  const source=read('image-fallback.js');
  assert.match(source,/document\.createElement\('img'\)/);
  assert.match(source,/dataset\.kantoCreated='1'/);
  assert.match(source,/fallbackNode\?\.remove/);
});

test('image hydration preserves a working rendered source instead of swapping providers',()=>{
  const source=read('image-fallback.js');
  assert.match(source,/const currentSrc=String\(img\.getAttribute\('src'\)\|\|''\)\.trim\(\)/);
  assert.match(source,/brokenExisting=Boolean\(currentSrc&&img\.complete&&img\.naturalWidth===0\)/);
  assert.match(source,/needsResolvedSource=img\.dataset\.kantoCreated==='1'\|\|!currentSrc\|\|brokenExisting/);
  assert.match(source,/if\(needsResolvedSource\)img\.src=resolved\.primary/);
});

test('grid art is eager and resolver work is cached across rerenders',()=>{
  const source=read('image-fallback.js');
  assert.match(source,/resolvedByCard=new Map\(\)/);
  assert.match(source,/resolvedByCard\.has\(key\)/);
  assert.match(source,/if\(className==='slot-art'\)img\.loading='eager'/);
  assert.match(source,/img\.loading=className==='slot-art'\?'eager':'lazy'/);
});
