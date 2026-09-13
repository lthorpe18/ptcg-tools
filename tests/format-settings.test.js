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
  assert.match(html,/Published changes are shared application data, not account preferences/);
  assert.match(html,/id="formatAccessMessage"/);
  assert.match(html,/id="formatAdminControls"[^>]*hidden/);
  assert.doesNotMatch(js,/PTCGStorage\.(?:save|update)|PTCGCloud\.localSnapshot|rootState/);
});

test('Formats and Sets editor covers release, Online, IRL, regulation marks and rotation metadata',()=>{
  for(const hook of [
    'data-set-id','data-set-name','data-release-status','data-release-date',
    'data-online-status','data-online-date','data-irl-status','data-irl-date',
    'data-marks-status','data-marks','data-rotation-enabled','data-rotation-lowest',
    'data-rotation-marks','data-rotation-earliest'
  ]) assert.match(js,new RegExp(hook));
  assert.match(html,/id="addFormatSet"/);
  assert.match(html,/id="formatPublishNotes"/);
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

test('maintenance validates registry semantics through the canonical format engine',()=>{
  assert.match(js,/PTCGFormatCalendar\.validateRegistry\(next,window\.PTCGFormat\)/);
  assert.match(js,/confirmed status needs a date/);
  assert.match(js,/confirmed regulation marks need at least one mark/);
  assert.match(js,/rotation lowest mark must be one letter/);
});

test('Formats and Sets controls are iPhone-safe and collapse on narrow screens',()=>{
  assert.match(css,/@media\(max-width:760px\)[^{]*\{[^}]*\.format-set-card input,[^}]*font-size:16px/s);
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/\.format-fact-row\{display:grid/);
});
