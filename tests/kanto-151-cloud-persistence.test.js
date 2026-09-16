const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const readRepo=name=>fs.readFileSync(path.join(process.cwd(),name),'utf8');

test('Kanto collector loads dedicated cloud persistence before the app',()=>{
  const html=read('index.html');
  const cloudIndex=html.indexOf('<script src="./cloud-persistence.js"></script>');
  const appIndex=html.indexOf('<script src="./app.js"></script>');
  assert.ok(cloudIndex>=0,'cloud persistence script is loaded');
  assert.ok(appIndex>cloudIndex,'cloud persistence observes local saves before app bootstrap');
  assert.match(html,/id="cloud-status"/);
  assert.match(html,/id="cloud-sign-in"/);
});

test('Kanto cloud persistence uses authenticated Supabase storage without a secret key',()=>{
  const source=read('cloud-persistence.js');
  assert.match(source,/kanto_151_collections/);
  assert.match(source,/@supabase\/supabase-js@2\.116\.0/);
  assert.match(source,/auth\.getUser\(\)/);
  assert.match(source,/signInWithOAuth\(\{provider:'google'/);
  assert.match(source,/\.upsert\(\{user_id:user\.id,payload,updated_at:now\}/);
  assert.match(source,/\.select\('payload,updated_at'\)\.eq\('user_id',user\.id\)\.maybeSingle\(\)/);
  assert.match(source,/STORAGE_KEY='ptcg-kanto-151-v1'/);
  assert.match(source,/global\.location\.reload\(\)/);
  assert.doesNotMatch(source,/service[_-]?role|sb_secret_/i);
});

test('Kanto cloud table is owner-scoped and grants only CRUD to authenticated users',()=>{
  const create=readRepo('supabase/migrations/20260916144043_add_kanto_151_collection_persistence.sql');
  const harden=readRepo('supabase/migrations/20260916144141_harden_kanto_151_collection_grants.sql');
  assert.match(create,/alter table public\.kanto_151_collections enable row level security/i);
  assert.match(create,/to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(create,/for update[\s\S]*using[\s\S]*with check/i);
  assert.match(harden,/revoke all on table public\.kanto_151_collections from anon, authenticated/i);
  assert.match(harden,/grant select, insert, update, delete on table public\.kanto_151_collections to authenticated/i);
});
