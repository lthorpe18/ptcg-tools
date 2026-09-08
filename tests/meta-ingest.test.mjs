import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

test('actual daily ingestion closes outgoing boundary gap and preserves archives when the index rolls forward',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ptcg-synthetic-ingest-'));
 try {
  fs.mkdirSync(path.join(directory,'data/meta'),{recursive:true});
  fs.writeFileSync(path.join(directory,'data/meta/current-field.json'),JSON.stringify({format:'TEF-PBL',generatedAt:'2026-09-14T03:17:00Z',tournaments:[{id:'synthetic-older',date:'2026-09-08T12:00:00Z',players:50,archetypes:[{name:'Synthetic Deck',entries:50}]}]}));
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/update-online-formats.mjs',import.meta.url))],{cwd:directory,env:{...process.env,NODE_OPTIONS:'--import '+fileURLToPath(new URL('./fixtures/meta-ingest-network.mjs',import.meta.url))},timeout:15000,stdio:'pipe'});
  const read=relative=>JSON.parse(fs.readFileSync(path.join(directory,relative),'utf8'));
  const current=read('data/meta/current-field.json'),old=read('data/meta/online-fields/TEF-PBL.json');
  assert.equal(current.format,'TEF-30C');assert.deepEqual(current.tournaments.map(e=>e.id),['synthetic-new']);
  assert.deepEqual(old.tournaments.map(e=>e.id),['synthetic-outgoing-late','synthetic-older']);
  assert.equal(read('data/meta/online-events/TEF-PBL.json').events[0].id,'synthetic-outgoing-late');
  assert.equal(read('data/meta/online-results/TEF-PBL.json').events[0].id,'synthetic-outgoing-late');
  assert.equal(old.tournaments.some(e=>e.id==='synthetic-new'),false);
 } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
