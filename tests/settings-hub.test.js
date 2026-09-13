'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');

const hub=fs.readFileSync('v2-preview/apps/settings/index.html','utf8');
const icons=fs.readFileSync('v2-preview/apps/settings/deck-icons.html','utf8');
const data=fs.readFileSync('v2-preview/apps/settings/data.html','utf8');
const formats=fs.readFileSync('v2-preview/apps/settings/formats.html','utf8');
const js=fs.readFileSync('v2-preview/apps/settings/settings.js','utf8');

test('Settings landing page is a compact hub rather than one long editor',()=>{
  assert.match(hub,/class="app-shell-page settings-page settings-hub"/);
  assert.match(hub,/href="\.\/deck-icons\.html"/);
  assert.match(hub,/href="\.\/data\.html"/);
  assert.match(hub,/href="\.\/formats\.html"/);
  assert.doesNotMatch(hub,/id="deckIconList"|id="formatSetList"|id="exportAccountData"/);
});

test('Settings hub keeps compact account and sync state on the landing page',()=>{
  assert.match(hub,/settings-account-compact/);
  assert.match(hub,/data-ptcg-auth-name/);
  assert.match(hub,/data-ptcg-sync-status/);
  assert.match(hub,/data-ptcg-sync-detail/);
  assert.match(hub,/data-ptcg-auth-signout/);
});

test('Preferences data and maintenance each have focused drill-in pages',()=>{
  assert.match(icons,/id="deckIconSearch"/);
  assert.match(icons,/id="deckIconList"/);
  assert.match(data,/id="exportAccountData"/);
  assert.match(formats,/id="formatSetList"/);
  for(const page of [icons,data,formats])assert.match(page,/href="\.\/" aria-label="Back to Settings"/);
});

test('Maintenance link is admin-only and Settings runtime remains valid on every page',()=>{
  const parsed=spawnSync(process.execPath,['--check','v2-preview/apps/settings/settings.js'],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr||parsed.stdout);
  assert.match(hub,/id="maintenanceSection"[^>]*hidden/);
  assert.match(js,/async function renderMaintenanceAccess/);
  assert.match(js,/PTCGFormatCalendar\?\.isAdmin/);
  assert.match(js,/if\(!\$\('deckIconList'\)\)return/);
  assert.match(js,/if\(!button\|\|!message\|\|!window\.PTCGCloud\)return/);
});