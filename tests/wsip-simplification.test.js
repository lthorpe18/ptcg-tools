const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('WSIP collapses setup chrome while keeping the existing controls',()=>{
  const html=read('v2-preview/apps/meta/index.html');
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  assert.equal((html.match(/id="playFieldSource"/g)||[]).length,1);
  assert.equal((html.match(/id="playFieldFormat"/g)||[]).length,1);
  assert.equal((html.match(/id="playMatchupSource"/g)||[]).length,1);
  assert.match(polish,/id = 'wsipFieldEditor'/);
  assert.match(polish,/id = 'wsipAnalysisSettings'/);
  assert.match(polish,/appendChild\(controls\)/);
  assert.match(polish,/appendChild\(sourceContext\)/);
});

test('WSIP shows the next attending event as compact context',()=>{
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  assert.doesNotThrow(()=>new Function(polish));
  assert.match(polish,/function nextAttendingEvent\(\)/);
  assert.match(polish,/attendanceStatus === 'attending'/);
  assert.match(polish,/No upcoming attending event/);
  assert.match(polish,/Preparing for/);
  assert.doesNotMatch(polish,/updateParticipation|plannedDeckRef|usedDeckRef/);
});

test('recommendations remain primary and field detail is visually secondary',()=>{
  const css=read('v2-preview/apps/meta/wsip-polish.css');
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  assert.match(css,/\.wsip-field-editor/);
  assert.match(css,/\.wsip-analysis-settings/);
  assert.match(css,/#prep \.recommendations-section\{margin-top:14px\}/);
  assert.match(css,/#prep \.recommendations-section \.wsip-step\{display:none\}/);
  assert.match(polish,/Best choices for the field you expect\./);
  assert.match(polish,/fieldModeLabel\(\)/);
  assert.match(polish,/getOriginalCoverage/);
});

test('WSIP simplification assets are cache-busted',()=>{
  const html=read('v2-preview/apps/meta/index.html');
  assert.match(html,/wsip-polish\.css\?v=6/);
  assert.match(html,/wsip-polish\.js\?v=5/);
});
