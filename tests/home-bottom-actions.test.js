const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Home exposes Tournament Manager as a fourth quick action',()=>{
  const html=read('v2-preview/home-content.html');
  const quick=html.match(/<nav class="home-quick-actions"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.equal((quick.match(/<a /g)||[]).length,4);
  assert.match(quick,/href="\.\/apps\/tools\/#tournament"/);
  assert.match(quick,/aria-label="Open Tournament Manager"/);
  assert.match(quick,/>Tournament<\/span>/);

  const tools=read('v2-preview/apps/tools/tools.js');
  assert.match(tools,/\['cut','tournament','odds'\]/);
  assert.match(tools,/#\$\{safe\}/);
});

test('Home WSIP CTA is compact and no longer carries the decorative chart',()=>{
  const html=read('v2-preview/home-content.html');
  const css=read('v2-preview/home-tweaks.css');
  assert.match(html,/home-play-card home-play-card-compact/);
  assert.match(html,/Recommendations for your next event/);
  assert.doesNotMatch(html,/home-play-graphic/);
  assert.match(css,/\.home-play-card\.home-play-card-compact\{/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/grid-template-rows:minmax\(0,2\.12fr\) minmax\(0,1\.05fr\) 62px 72px/);
});

test('Home action assets are cache-busted',()=>{
  const home=read('v2-preview/home-content.html');
  const shell=read('v2-preview/index.html');
  assert.match(home,/home-tweaks\.css\?v=9/);
  assert.match(shell,/home-content\.html\?v=24/);
});
