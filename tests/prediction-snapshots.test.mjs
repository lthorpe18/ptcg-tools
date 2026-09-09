import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildRelease } from '../scripts/build-meta-release.mjs';
import { archiveSnapshots, loadBlendEngine, makeSnapshots } from '../scripts/prediction-snapshots.mjs';

const root=path.resolve(import.meta.dirname,'..');
const data=async relative=>JSON.parse(await fs.readFile(path.join(root,relative),'utf8'));
const fixture=async()=>buildRelease({
  online:await data('data/meta/current-field.json'),irl:await data('data/meta/irl/TEF-PBL.json'),
  deckAggregate:await data('data/meta/decks/TEF-PBL.json'),onlineResults:await data('data/meta/online-results/TEF-PBL.json'),asOf:'2026-09-09',
});
const engine=()=>loadBlendEngine(path.join(root,'v2-preview/apps/_shared/meta-blend.js'));

test('committed snapshot reproduces the live release prediction and retains pre-blend inputs',async()=>{
  const index=await data('data/meta/prediction-snapshots/index.json');
  const generated=makeSnapshots(await fixture(),await engine())[0];
  const publication=index.publications.find(row=>row.snapshotId===generated.snapshotId);
  assert.ok(publication);
  const stored=await data(`data/meta/prediction-snapshots/snapshots/${publication.snapshotId}.json`);
  assert.deepEqual(stored,generated);
  assert.equal(stored.targetFormat,'TEF-PBL');
  assert.equal(stored.available,true);
  assert.ok(stored.inputs.online.rows.length>0);
  assert.ok(stored.inputs.irl.rows.length>0);
  assert.ok(Math.abs(stored.prediction.rows.reduce((sum,row)=>sum+row.share,0)-100)<1e-9);
  assert.equal(stored.formula.version,'blended-v2.1');
});

test('archive deduplicates identical content while retaining distinct publication times',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'prediction-snapshots-'));
  const built=await fixture(),blend=await engine();
  await archiveSnapshots({built,blend,directory,publishedAt:'2026-09-09T03:17:00Z'});
  await archiveSnapshots({built,blend,directory,publishedAt:'2026-09-09T03:17:00Z'});
  await archiveSnapshots({built,blend,directory,publishedAt:'2026-09-09T05:41:00Z'});
  const index=JSON.parse(await fs.readFile(path.join(directory,'index.json'),'utf8'));
  const files=await fs.readdir(path.join(directory,'snapshots'));
  assert.equal(files.length,1);
  assert.equal(index.publications.length,2);
  assert.equal(index.publications[0].snapshotId,index.publications[1].snapshotId);
});

test('archive refuses to rewrite an existing immutable snapshot',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'prediction-snapshots-'));
  const built=await fixture(),blend=await engine();
  const [snapshot]=await archiveSnapshots({built,blend,directory,publishedAt:'2026-09-09T03:17:00Z'});
  const file=path.join(directory,'snapshots',`${snapshot.snapshotId}.json`);
  const corrupted={...snapshot,available:false};
  await fs.writeFile(file,JSON.stringify(corrupted));
  await assert.rejects(()=>archiveSnapshots({built,blend,directory,publishedAt:'2026-09-09T05:41:00Z'}),/Refusing to rewrite immutable prediction snapshot/);
});
