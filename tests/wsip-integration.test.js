const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Home, Meta and Event Prep load the shared field definitions before consumers', () => {
  const home=read('v2-preview/home-content.html');
  const meta=read('v2-preview/apps/meta/index.html');
  const prep=read('v2-preview/apps/events/prep.html');
  assert.ok(home.indexOf('_shared/meta-field.js') < home.indexOf('archetype-groups.js'));
  assert.ok(home.indexOf('_shared/meta-field.js') < home.indexOf('_shared/meta-blend.js'));
  assert.ok(meta.indexOf('_shared/meta-field.js') < meta.indexOf('archetype-groups.js'));
  assert.ok(meta.indexOf('_shared/recommendation-engine.js') < meta.indexOf('prep.js?v=8'));
  assert.ok(prep.indexOf('_shared/meta-field.js') < prep.indexOf('meta/saved-metas.js'));
  assert.ok(prep.indexOf('_shared/recommendation-engine.js') < prep.indexOf('./prep.js'));
  assert.ok(prep.indexOf('meta-release-loader.js') < prep.indexOf('./prep.js'));
});

test('WSIP owns one visible field source and one H2H source without mirror controls', () => {
  const html=read('v2-preview/apps/meta/index.html');
  assert.equal((html.match(/id="playFieldSource"/g)||[]).length,1);
  assert.equal((html.match(/id="playMatchupSource"/g)||[]).length,1);
  assert.doesNotMatch(html,/id="fieldSource"|id="matchupSource"|id="fieldBlend"/);
  assert.match(html,/<option value="blend" selected>Blended current field/);
  assert.match(html,/<option value="combined" selected>Online \+ IRL/);
});

test('Meta WSIP and Event Prep call the one recommendation engine', () => {
  const wsip=read('v2-preview/apps/meta/prep.js');
  const prep=read('v2-preview/apps/events/prep.js');
  assert.match(wsip,/PTCGRecommendation\?\.analyse/);
  assert.match(prep,/PTCGRecommendation\.analyse/);
  assert.doesNotMatch(prep,/function candidateScore|function matchupMap/);
});

test('Home continues to launch the Meta-owned WSIP route', () => {
  assert.match(read('v2-preview/home-content.html'),/apps\/meta\/#prep/);
  assert.match(read('v2-preview/apps/meta/meta-router.js'),/prep:\s*'prep'/);
});

test('WSIP never mutates planned or used deck state', () => {
  const wsip=read('v2-preview/apps/meta/prep.js');
  assert.doesNotMatch(wsip,/plannedDeckRef|usedDeckRef|updateParticipation/);
  assert.match(read('v2-preview/apps/events/prep.js'),/function savePlan/);
});

test('WSIP polish observers cannot self-trigger field-label mutation loops', () => {
  const polish=read('v2-preview/apps/meta/wsip-polish.js');
  const reset=read('v2-preview/apps/meta/wsip-reset-polish.js');
  const observerBody=polish.match(/const observer = new MutationObserver\(([\s\S]*?)\);\s*observer\.observe\(document\.body/);
  assert.ok(observerBody,'WSIP body observer contract is present');
  assert.doesNotMatch(observerBody[1],/syncTopFieldControl\s*\(/,'body mutation observer must not rewrite the field selector it observes');
  assert.match(polish,/node\.textContent !== text/,'field/compare text writes must be idempotent');
  assert.match(reset,/button\.textContent !== text/,'reset observer text writes must be idempotent');
  assert.match(reset,/button\.title !== title/,'reset observer title writes must be idempotent');
});
