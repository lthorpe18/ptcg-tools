const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Kanto quick filters keep set, illustrator and Filters side by side',()=>{
  const html=read('index.html');
  const css=read('style.css');
  assert.match(html,/class="quick-filter-row"[\s\S]*id="filter-set"[\s\S]*id="filter-illustrator"[\s\S]*id="filters-toggle"/);
  assert.match(css,/\.quick-filter-row\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s);
  const panel=html.match(/<section id="filters-panel"[\s\S]*?<\/section>/)?.[0]||'';
  assert.doesNotMatch(panel,/id="filter-set"|id="filter-illustrator"/);
});

test('Kanto picker hides duplicate Pokemon heading',()=>{
  const html=read('index.html');
  assert.match(html,/<header class="sheet-header">\s*<div hidden>[\s\S]*id="picker-number"[\s\S]*id="picker-title"/);
});

test('Kanto filters reset before each new Pokemon picker opens',()=>{
  const html=read('index.html');
  const source=read('search-filter-reset.js');
  assert.match(html,/\.\/app\.js<\/script>\s*<script src="\.\/search-filter-reset\.js"/);
  assert.match(source,/\[data-open-picker\]/);
  assert.match(source,/setFilter\.value=''/);
  assert.match(source,/illustrator\.value=''/);
  assert.match(source,/rarity\.innerHTML='<option value="">Any rarity<\/option>'/);
  assert.match(source,/regulation\.value=''/);
  assert.match(source,/standard\.checked=false/);
  assert.match(source,/panel\.hidden=true/);
});
