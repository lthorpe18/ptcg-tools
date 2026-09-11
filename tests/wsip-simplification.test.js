const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('WSIP keeps one compact setup surface while retaining the existing controls',()=>{
  const html=read('v2-preview/apps/meta/index.html');
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  assert.equal((html.match(/id="playFieldSource"/g)||[]).length,1);
  assert.equal((html.match(/id="playFieldFormat"/g)||[]).length,1);
  assert.equal((html.match(/id="playMatchupSource"/g)||[]).length,1);
  assert.match(polish,/id = 'wsipContextCard'/);
  assert.match(polish,/id = 'wsipFieldEditor'/);
  assert.doesNotMatch(polish,/id = 'wsipAnalysisSettings'/);
  assert.match(polish,/analysis\?\.appendChild\(controls\)/);
  assert.match(polish,/analysis\?\.appendChild\(sourceContext\)/);
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

test('field and H2H setup collapse into one summary above recommendations',()=>{
  const css=read('v2-preview/apps/meta/wsip-polish.css');
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  assert.match(polish,/function setupSummary\(\)/);
  assert.match(polish,/fieldSummary\(\), matchupLabel\(\)/);
  assert.match(polish,/id="wsipSetupSummary"/);
  assert.match(polish,/>Adjust</);
  assert.match(css,/\.wsip-context-card\{/);
  assert.match(css,/\.wsip-event-context\{[^}]*padding:9px 12px/);
  assert.match(css,/\.wsip-field-editor>summary\{[^}]*padding:8px 12px/);
  assert.match(css,/#prep \.recommendations-section\{margin-top:10px\}/);
  assert.match(polish,/Best choices for the field you expect\./);
});

test('saved Expected Field is chosen only from the saved-field picker',()=>{
  const html=read('v2-preview/apps/meta/index.html');
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  assert.match(html,/option value="expected">Saved Expected Field<\/option>/);
  assert.match(polish,/expected\.hidden = true/);
  assert.match(polish,/label\.hidden = active/);
  assert.match(polish,/select\.value === 'expected'/);
  assert.doesNotMatch(polish,/setText\(expected/);
});

test('WSIP compact context assets are cache-busted',()=>{
  const html=read('v2-preview/apps/meta/index.html');
  assert.match(html,/wsip-polish\.css\?v=7/);
  assert.match(html,/wsip-polish\.js\?v=7/);
});
