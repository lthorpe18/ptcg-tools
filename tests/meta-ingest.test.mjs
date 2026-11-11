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

test('delayed DLR rollover removes post-boundary events from 30C and ingests them as DLR',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ptcg-dlr-ingest-'));
 try {
  const write=(relative,data)=>{
   const filename=path.join(directory,relative);
   fs.mkdirSync(path.dirname(filename),{recursive:true});
   fs.writeFileSync(filename,JSON.stringify(data));
  };
  const read=relative=>JSON.parse(fs.readFileSync(path.join(directory,relative),'utf8'));
  const old={id:'synthetic-30c',name:'SYNTHETIC 30C tournament',date:'2026-11-04T19:00:00Z',
   players:50,archetypes:[{name:'Synthetic Deck',entries:50}],matchups:[],matchCount:0};
  const mislabelled={...old,id:'synthetic-dlr',name:'SYNTHETIC DLR tournament',date:'2026-11-06T19:00:00Z'};
  const prior={format:'TEF-30C',generatedAt:'2026-11-11T10:00:00Z',
   formatStart:'2026-09-15T00:00:00Z',tournaments:[mislabelled,old]};
  write('data/meta/current-field.json',prior);
  write('data/meta/online-fields/TEF-30C.json',prior);
  write('data/meta/online-events/TEF-30C.json',{
   format:'TEF-30C',generatedAt:prior.generatedAt,coverageStart:'2026-10-29T00:00:00Z',events:[mislabelled,old]});
  write('data/meta/online-results/TEF-30C.json',{
   format:'TEF-30C',generatedAt:prior.generatedAt,
   events:[mislabelled,old].map(({id,name,date,players})=>({id,name,date,players,results:[]}))});
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/update-online-formats.mjs',import.meta.url))],{
   cwd:directory,
   env:{...process.env,PTCG_FORMAT_SOURCE:'bootstrap',NODE_OPTIONS:'--import '+fileURLToPath(new URL('./fixtures/meta-dlr-ingest-network.mjs',import.meta.url))},
   timeout:15000,stdio:'pipe'
  });
  const current=read('data/meta/current-field.json');
  const outgoing=read('data/meta/online-fields/TEF-30C.json');
  const events=read('data/meta/online-events/TEF-30C.json');
  const results=read('data/meta/online-results/TEF-30C.json');
  assert.equal(current.format,'TEF-DLR');
  assert.deepEqual(current.tournaments.map(e=>e.id),['synthetic-dlr']);
  assert.deepEqual(outgoing.tournaments.map(e=>e.id),['synthetic-30c']);
  assert.deepEqual(events.events.map(e=>e.id),['synthetic-30c']);
  assert.deepEqual(results.events.map(e=>e.id),['synthetic-30c']);
  assert.equal(read('data/meta/online-fields/TEF-DLR.json').format,'TEF-DLR');
  assert.equal(read('data/meta/online-results/TEF-DLR.json').events[0].id,'synthetic-dlr');
 } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
