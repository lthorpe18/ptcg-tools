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
  assert.match(html,/id="formatsHeading">Formats &amp; Sets</);
  assert.match(html,/Card legality is checked from each printing's regulation mark/);
  assert.match(html,/set boundaries are used only for format labels and meta grouping/);
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
  assert.match(js,/Leave a date blank when it is not yet known/);
  assert.match(js,/Rotation is card-level/);
  assert.match(js,/set boundaries are labels only/);
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

test('maintenance flow is admin-gated and explicitly uses draft then publish operations',()=>{
  assert.match(js,/PTCGFormatCalendar/);
  assert.match(js,/api\.isAdmin\(\)/);
  assert.match(js,/PTCGFormatCalendar\.createDraft/);
  assert.match(js,/PTCGFormatCalendar\.updateDraft/);
  assert.match(js,/PTCGFormatCalendar\.publish/);
  assert.match(js,/Published data is unchanged until you publish/);
  assert.match(html,/id="saveFormatDraft"/);
  assert.match(html,/id="publishFormatDraft"/);
});

test('maintenance keeps set marks unknown and derives a rotation boundary only from legal card regulation marks',()=>{
  assert.match(js,/marks:\{value:null,status:'unknown',sources:\[\]\}/);
  assert.match(js,/legal regulation marks are required for a rotation/);
  assert.match(js,/regulation marks must be single letters/);
  assert.match(js,/rotation=\{lowestMark:legal\[0\],regulationMarks:legal\}/);
  assert.match(js,/PTCGFormatCalendar\.validateRegistry\(next,window\.PTCGFormat\)/);
});

test('Formats and Sets controls are iPhone-safe and cannot overflow their cards',()=>{
  assert.match(css,/@media\(max-width:760px\)[^{]*\{[^}]*\.format-set-card input,[^}]*font-size:16px/s);
  assert.match(css,/box-sizing:border-box/);
  assert.match(css,/max-width:100%/);
  assert.match(css,/\.format-set-card\{[^}]*overflow:hidden/s);
  assert.match(css,/@media\(max-width:520px\)[\s\S]*?\.format-date-fields\{grid-template-columns:1fr\}/);
  assert.match(css,/\.format-actions\{[^}]*margin-bottom:10px/s);
});