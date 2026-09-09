import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildAccuracyArchive, majorType, makeActual, scorePrediction, selectPrediction } from '../scripts/prediction-accuracy.mjs';

const root=path.resolve(import.meta.dirname,'..');
const stable=value=>Array.isArray(value)?Array.from(value,stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const event=(overrides={})=>({id:'major-1',name:'Bristol Regional Championship',date:'2030-02-10',format:'FMT',players:100,decks:[{name:'A',entries:40},{name:'B',entries:40},{name:'D',entries:20}],...overrides});
const dataset=(events=[event()])=>({source:'synthetic-irl',sourceUrl:'https://example.test',format:'FMT',events});
const actual=overrides=>makeActual(event(overrides),dataset());
const snapshot=(overrides={})=>{
  const content={schemaVersion:1,calculationDate:'2030-02-09',targetFormat:'FMT',available:true,reason:null,prediction:{rows:[{name:'A',share:60},{name:'B',share:30},{name:'C',share:10}]},inputs:{online:{rows:[]},irl:{rows:[]}},formula:{version:'test-v1'},provenance:{release:'r',revision:'x',calendarRevision:'c'},...overrides};
  const contentHash=digest(content);return stable({...content,snapshotId:`prediction-${contentHash.slice(0,20)}`,contentHash});
};
const archiveFixture=async({events=[event()],publications=[]}={})=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'accuracy-')),snapshotDirectory=path.join(base,'snapshots-source'),outputDirectory=path.join(base,'output');
  await fs.mkdir(path.join(snapshotDirectory,'snapshots'),{recursive:true});
  const snapshots=[];
  for(const row of publications){const item=row.snapshot||snapshot();snapshots.push(item);await fs.writeFile(path.join(snapshotDirectory,'snapshots',`${item.snapshotId}.json`),JSON.stringify(stable(item)));row.snapshotId=item.snapshotId;row.contentHash=item.contentHash;delete row.snapshot;}
  await fs.writeFile(path.join(snapshotDirectory,'index.json'),JSON.stringify({schemaVersion:1,publications}));
  return {snapshotDirectory,outputDirectory,datasets:[dataset(events)],snapshots};
};

test('only named IRL major classes are eligible event types',()=>{
  assert.equal(majorType({name:'World Championship London'}),'worlds');
  assert.equal(majorType({name:'North America International Championship'}),'international');
  assert.equal(majorType({name:'Sydney Special Championship'}),'special');
  assert.equal(majorType({name:'Bristol Regional Championship'}),'regional');
  assert.equal(majorType({name:'Large League Cup Regional Warm-up'}),null);
});

test('actual field uses exact Day 1 variants and enforces 95 percent coverage',()=>{
  const good=actual();assert.equal(good.eligible,true);assert.equal(good.coverage,1);assert.equal(good.variants.length,3);
  const low=actual({players:101,decks:[{name:'A',entries:95}]});assert.equal(low.eligible,false);assert.match(low.unavailableReason,/95%/);
  const invalid=actual({players:90});assert.equal(invalid.eligible,false);assert.match(invalid.unavailableReason,/Invalid/);
});

test('selection uses the latest available exact-format publication strictly before Day 1',()=>{
  const rows=[
    {snapshotId:'old',targetFormat:'FMT',available:true,publishedAt:'2030-02-08T23:00:00Z'},
    {snapshotId:'wrong',targetFormat:'OTHER',available:true,publishedAt:'2030-02-09T23:00:00Z'},
    {snapshotId:'unavailable',targetFormat:'FMT',available:false,publishedAt:'2030-02-09T20:00:00Z'},
    {snapshotId:'same-day',targetFormat:'FMT',available:true,publishedAt:'2030-02-10T00:00:01Z'},
    {snapshotId:'latest',targetFormat:'FMT',available:true,publishedAt:'2030-02-09T23:59:59Z'},
  ];
  assert.equal(selectPrediction(actual(),rows).snapshotId,'latest');
});

test('scoring calculates overlap, MAE and ranked exact-variant misses',()=>{
  const result=scorePrediction(actual(),snapshot(),{publishedAt:'2030-02-09T12:00:00Z'});
  assert.equal(result.metrics.fieldAccuracy,70);
  assert.equal(result.metrics.mae,15);
  assert.equal(result.topOver[0].name,'A');assert.equal(result.topOver[0].variance,20);
  assert.equal(result.topUnder[0].name,'D');assert.equal(result.topUnder[0].variance,-20);
});

test('archive records Worlds as unscored when no pre-Day-1 snapshot exists',async()=>{
  const irl=JSON.parse(await fs.readFile(path.join(root,'data/meta/irl/TEF-PBL.json'),'utf8'));
  const outputDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'accuracy-'));
  const result=await buildAccuracyArchive({datasets:[irl],snapshotDirectory:path.join(root,'data/meta/prediction-snapshots'),outputDirectory});
  assert.equal(result.events.length,1);assert.equal(result.events[0].type,'worlds');assert.equal(result.events[0].status,'unscored');assert.match(result.events[0].reason,/strictly before Day 1/);
});

test('archive scores eligible events, retains revisions and rejects immutable-record changes',async()=>{
  const item=snapshot(),fixture=await archiveFixture({publications:[{snapshot:item,targetFormat:'FMT',available:true,publishedAt:'2030-02-09T12:00:00Z',release:'r'}]});
  let index=await buildAccuracyArchive(fixture);assert.equal(index.events[0].status,'scored');assert.equal(index.events[0].actualRevisions.length,1);assert.equal(index.events[0].evaluationRevisions.length,1);
  fixture.datasets=[dataset([event({decks:[{name:'A',entries:50},{name:'B',entries:30},{name:'D',entries:20}]})])];
  index=await buildAccuracyArchive(fixture);assert.equal(index.events[0].actualRevisions.length,2);assert.equal(index.events[0].evaluationRevisions.length,2);
  const current=index.events[0].currentActualId,file=path.join(fixture.outputDirectory,'actuals',`${current}.json`);
  await fs.writeFile(file,'{}');
  await assert.rejects(()=>buildAccuracyArchive(fixture),/Refusing to rewrite immutable actual record/);
});
