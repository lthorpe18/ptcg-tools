const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');

const html=fs.readFileSync('v2-preview/apps/settings/index.html','utf8');
const js=fs.readFileSync('v2-preview/apps/settings/format-settings.js','utf8');
const css=fs.readFileSync('v2-preview/apps/settings/format-settings.css','utf8');

test('Formats and Sets settings scripts parse cleanly and load shared format dependencies in order',()=>{
  const parsed=spawnSync(process.execPath,['--check','v2-preview/apps/settings/format-settings.js'],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr||parsed.stdout);
  const resolver=html.indexOf('../_shared/format-resolver.js');
  const cloud=html.indexOf('../_shared/cloud-sync.js');
  const store=html.indexOf('../_shared/format-calendar-store.js');
  const settings=html.indexOf('./format-settings.js');
  assert.ok(resolver>=0&&cloud>resolver&&store>cloud&&settings>store,'shared format resolver/cloud/store must load before the maintenance UI');
});

test('Settings exposes Formats and Sets as shared application data rather than an account preference',()=>{
  assert.match(html,/id="formatsHeading">Formats &amp; Sets/);
  assert.match(html,/Card legality always uses each printing's regulation mark/);
  assert.match(html,/id="formatAccessMessage"/);
  assert.match(html,/id="formatAdminControls"[^>]*hidden/);
  assert.doesNotMatch(js,/PTCGStorage\.(?:save|update)|PTCGCloud\.localSnapshot|rootState/);
});

test('Formats and Sets editor uses dates directly and does not expose fact-status or whole-set regulation-mark controls',()=>{
  for(const hook of ['data-set-id','data-set-name','data-release-date','data-online-date','data-irl-date','data-rotation-enabled','data-rotation-marks','data-rotation-earliest']){
    assert.match(js,new RegExp(hook));
  }
  for(const retired of ['data-release-status','data-online-status','data-irl-status','data-marks-status','data-marks','data-rotation-lowest']){
    assert.doesNotMatch(js,new RegExp(retired));
  }
  assert.match(js,/Card-level rotation/);
  assert.match(html,/id="addFormatSet"/);
  assert.match(html,/id="formatPublishNotes"/);
});

test('blank dates map to internal unknown facts while a listed undated set remains announced internally',()=>{
  assert.match(js,/dateFact\(original\?\.release,releaseDate,source,'announced'/);
  assert.match(js,/dateFact\(original\?\.legality\?\.online,onlineDate,source,'unknown'/);
  assert.match(js,/dateFact\(original\?\.legality\?\.irl,irlDate,source,'unknown'/);
  assert.match(js,/clean\?'confirmed':blankStatus/);
  assert.doesNotMatch(js,/statusOptions|factStatus|validateStatusDate/);
});

test('maintenance is admin-gated and exposes one Save changes action instead of draft and publish workflow',()=>{
  assert.match(js,/PTCGFormatCalendar/);
  assert.match(js,/api\.isAdmin\(\)/);
  assert.match(js,/async function saveChanges/);
  assert.match(js,/PTCGFormatCalendar\.createDraft\(registry,note\)/);
  assert.match(js,/PTCGFormatCalendar\.publish\(draft\.id\)/);
  assert.match(js,/setMessage\('Saved\.'\)/);
  assert.match(html,/id="saveFormatCalendar"[^>]*>Save changes</);
  assert.doesNotMatch(html,/id="saveFormatDraft"|id="publishFormatDraft"/);
  assert.doesNotMatch(js,/draftRow|saveDraft|publishDraft|Update draft|Published data is unchanged/);
});

test('maintenance keeps set marks unknown and derives a rotation boundary only from legal card regulation marks',()=>{
  assert.match(js,/marks:\{value:null,status:'unknown',sources:\[\]\}/);
  assert.match(js,/legal regulation marks are required for a rotation/);
  assert.match(js,/regulation marks must be single letters/);
  assert.match(js,/rotation=\{lowestMark:legal\[0\],regulationMarks:legal\}/);
  assert.match(js,/PTCGFormatCalendar\.validateRegistry\(next,window\.PTCGFormat\)/);
});

test('date fields are visibly editable without adding another row of controls',()=>{
  assert.match(js,/class="format-date-control"/);
  assert.match(js,/title="Tap to edit release date"/);
  assert.match(js,/title="Tap to edit Online legality date"/);
  assert.match(js,/title="Tap to edit IRL legality date"/);
  assert.match(css,/\.format-date-control\{position:relative;min-width:0;overflow:hidden\}/);
  assert.match(css,/\.format-date-control>span::after\{content:'✎'/);
  assert.match(css,/\.format-date-fields input\{[^}]*cursor:pointer/s);
});

test('Formats and Sets keeps all three date controls side by side on iPhone widths',()=>{
  assert.match(js,/format-set-identity/);
  assert.match(js,/format-date-fields/);
  assert.doesNotMatch(js,/format-helper/);
  assert.match(js,/<details class="format-rotation">/);
  assert.doesNotMatch(js,/<details class="format-rotation"\$\{rotation\?' open'/);
  assert.match(js,/format-summary-meta/);
  assert.match(html,/class="format-notes-disclosure"/);
  assert.match(html,/class="format-maintenance-bar"/);
  assert.match(html,/format-settings\.css\?v=6/);
  assert.match(css,/\.format-summary-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css,/\.format-set-identity\{[^}]*grid-template-columns:76px minmax\(0,1fr\)/s);
  assert.match(css,/\.format-date-fields\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)[^}]*column-gap:4px/s);
  assert.doesNotMatch(css,/@media\(max-width:350px\)[\s\S]*?\.format-date-fields\{grid-template-columns:1fr\}/);
});

test('native iOS date inputs are forced to shrink inside their grid tracks',()=>{
  assert.match(css,/\.format-date-fields input\{[^}]*min-inline-size:0[^}]*max-inline-size:100%[^}]*-webkit-appearance:none[^}]*appearance:none/s);
  assert.match(css,/\.format-date-fields input::-webkit-date-and-time-value\{min-width:0;text-align:center\}/);
  assert.match(css,/box-sizing:border-box/);
  assert.match(css,/max-width:100%/);
  assert.match(css,/\.format-set-card\{[^}]*overflow:hidden/s);
});