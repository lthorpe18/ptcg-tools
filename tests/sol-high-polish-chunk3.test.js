const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('PTCGL import attempts clipboard paste and parses without a Review gate',()=>{
  const html=read('v2-preview/apps/decklists/index.html');
  const source=read('v2-preview/apps/decklists/training.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.doesNotMatch(html,/id="reviewImport"/);
  assert.doesNotMatch(html,/>Review log</);
  assert.match(html,/id="importStatus"/);
  assert.match(html,/training\.js\?v=4/);
  assert.match(source,/async function openImportFromClipboard\(\)/);
  assert.match(source,/navigator\.clipboard\?\.readText/);
  assert.match(source,/input\.value=text/);
  assert.match(source,/function parseImport\(/);
  assert.match(source,/importLog'\)\.addEventListener\('input',scheduleImportParse\)/);
  assert.match(source,/importMatch'\)\.addEventListener\('click',\(\)=>openImportFromClipboard\(\)\)/);
  assert.doesNotMatch(source,/Review a PTCGL log first/);
});

test('PTCGL import keeps a manual-paste fallback and reveals fields after parsing',()=>{
  const source=read('v2-preview/apps/decklists/training.js');
  assert.match(source,/input\.focus\(\)/);
  assert.match(source,/if\(!navigator\.clipboard\?\.readText\)return/);
  assert.match(source,/\$\('matchFields'\)\.hidden=false;\$\('matchPlayerRow'\)\.hidden=false/);
  assert.match(source,/setImportState\('parsed','Log detected/);
  assert.match(source,/if\(!parsedImport&&!parseImport\(\{quiet:true\}\)\)throw new Error\('Paste a valid PTCGL battle log first'\)/);
});

test('Training import sheet is width-bounded and vertically scrollable on mobile',()=>{
  const html=read('v2-preview/apps/decklists/index.html');
  const css=read('v2-preview/apps/decklists/training-import-polish.css');
  assert.match(html,/training-import-polish\.css\?v=1/);
  assert.match(css,/width:min\(calc\(100% - 16px\),680px\)/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/overflow-x:hidden/);
  assert.match(css,/overscroll-behavior:contain/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/\.match-sheet-card\{width:100%;max-width:none/);
});
