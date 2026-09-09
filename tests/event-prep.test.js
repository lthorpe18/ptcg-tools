const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))};
function element(id){
 const listeners=new Map(),classes=new Set();let html='';
 return {id,value:'',checked:false,disabled:false,textContent:'',dataset:{},inputs:[],
 classList:{add:key=>classes.add(key),remove:key=>classes.delete(key),contains:key=>classes.has(key),toggle(key,on){if(on===undefined)on=!classes.has(key);on?classes.add(key):classes.delete(key)}},
 get innerHTML(){return html},set innerHTML(value){html=value;this.inputs=[...value.matchAll(/data-field-index="(\d+)"[^>]*value="([^"]+)"/g)].map(m=>{const input=element('input');input.dataset.fieldIndex=m[1];input.value=m[2];return input})},
 querySelectorAll(selector){return selector==='input'?this.inputs:[]},addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn])},
 async fire(type){for(const fn of listeners.get(type)||[])await fn({target:this,currentTarget:this})},listeners};
}
function harness({storage=new Map(),date='2026-09-12',prep=null,loadOverride,coreMissing=false}={}){
 const ids=Object.fromEntries([...read('v2-preview/apps/events/prep.html').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element(m[1])]));
 ids.changePlan=element('changePlan');ids.workspace.classList.add('hidden');ids.fatal.classList.add('hidden');
 const listeners=new Map(),calls=[];
 const manifest=JSON.parse(read('v2-preview/data/meta/release/manifest.json'));
 const files=Object.fromEntries(Object.entries(manifest.files).map(([key,value])=>[key,JSON.parse(read('v2-preview/data/meta/release/'+value.path))]));
 let core=coreMissing?null:files.core;
 const decks=[{id:'deck-a',name:'My test deck',archetype:'Dragapult',currentVersionId:'v2',versions:[{id:'v1',label:'V1',listHash:'hash-one',cards:[{name:'Original card',count:4}]},{id:'v2',label:'V2',listHash:'hash-two',cards:[{name:'Later card',count:3}]}]}];
 const context={console,Date,Math,Map,Set,Promise,URL,URLSearchParams,AbortController,setTimeout:fn=>0,clearTimeout:()=>{},
 document:{getElementById:id=>ids[id]||null},location:{search:'?participation=p'},
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
 CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
 fetch:async()=>({ok:true,json:async()=>JSON.parse(read('data/formats/maintained-calendar.json'))})};
 context.window=context;context.globalThis=context;
 context.addEventListener=(type,fn)=>listeners.set(type,[...(listeners.get(type)||[]),fn]);context.dispatchEvent=event=>{for(const fn of listeners.get(event.type)||[])fn(event)};
 context.MetaRelease={ready:async()=>core,core:()=>core,load:async key=>{calls.push(key);return loadOverride?loadOverride(key,files[key]):files[key]}};
 context.PTCGDeckStore={open:async()=>{},all:async()=>decks,getVersion:(deck,id)=>deck.versions.find(v=>v.id===id)};
 const sandbox=vm.createContext(context);
 const run=file=>vm.runInContext(read('v2-preview/apps/'+file),sandbox);
 for(const file of ['_shared/storage.js','_shared/format-resolver.js','_shared/meta-field.js','_shared/meta-blend.js','_shared/recommendation-engine.js','meta/meta-core.js','meta/blended-field.js','meta/wsip-source.js','meta/saved-metas.js','events/prep-field.js'])run(file);
 if(!storage.has('ptcg-tools-v2'))context.PTCGStorage.save({schemaVersion:3,eventParticipations:[{id:'p',attendanceStatus:'attending',eventSnapshot:{id:'test-event',type:'League Cup',startDate:date,name:'Test Cup'},prep}],matches:[],favouriteVenues:[]});
 return {context,ids,calls,decks,storage,listeners,files,run:()=>run('events/prep.js'),get:()=>context.PTCGStorage.getParticipation('p'),replace(value){core=value;context.dispatchEvent({type:'meta:release-core',detail:{}})}};
}

test('Event Prep resolves the IRL date across a split, never today or a name-based guess',()=>{
 const h=harness(),F=h.context.EventPrepField,resolver=h.context.PTCGFormat.create(JSON.parse(read('data/formats/maintained-calendar.json')));
 const event=date=>F.eventContext({type:'League Cup',startDate:date},resolver);
 assert.equal(event('2026-09-23').format,'TEF-PBL');assert.equal(event('2026-09-24').format,'TEF-30C');
 const predictions=[{format:'TEF-PBL',available:true,rows:[{name:'Old',share:1}],asOf:'2026-09-23'},{format:'TEF-30C',available:true,rows:[{name:'New',share:1}],asOf:'2026-09-23'}];
 assert.equal(F.automatic(event('2026-09-23'),predictions).field[0].name,'Old');
 assert.equal(F.automatic(event('2026-09-24'),predictions).provenance.asOf,'2026-09-23');
 assert.equal(F.automatic(event('2026-09-24'),predictions.slice(0,1)).available,false);
 for(const date of [null,'2026-02-31','2020-01-01'])assert.equal(event(date).format,null);
 for(const e of [{name:'Major Local Regional'},{type:'Prerelease'},{type:'League Cup',format:'GLC'},{type:'League Cup',environment:'online'}])assert.equal(F.eventContext({...e,startDate:'2026-09-12'},resolver).format,null);
 const incomplete=JSON.parse(read('data/formats/maintained-calendar.json'));incomplete.sets[0].legality.irl={value:null,status:'unknown',sources:[],convention:'calendar-day-inclusive'};
 assert.equal(F.eventContext({type:'League Cup',startDate:'2026-09-24'},h.context.PTCGFormat.create(incomplete)).format,null);
});

test('Prep defaults match the canonical release and ignore saved-field names',async()=>{
 const h=harness();h.context.SavedMetas.save('Local Regional Major',[{name:'Wrong',share:1}],'TEF-PBL');h.run();await tick();
 assert.equal(h.ids.fatal.classList.contains('hidden'),true);assert.equal(h.ids.workspace.classList.contains('hidden'),false);
 const prediction=h.context.MetaBlendedField.predictions().find(x=>x.format==='TEF-PBL');
 assert.match(h.ids.fieldEvidence.textContent,new RegExp(`${Math.round(prediction.weights.irl*100)}% IRL`));assert.doesNotMatch(h.ids.fieldSummary.innerHTML,/Wrong/);
 await h.ids.looksRight.fire('click');const snap=h.get().prep.expectedFieldSnapshot;
 assert.equal(snap.format,'TEF-PBL');assert.equal(snap.provenance.revision,prediction.revision);assert.equal(snap.provenance.asOf,prediction.asOf);
 assert.deepEqual(clone(snap.provenance.evidence),clone(prediction.evidence));
 assert.equal(h.context.SavedMetas.list().length,1,'Automatic event save must not create or overwrite global saved fields');
});

test('unavailable future prediction and failed Meta startup preserve personal deck planning',async()=>{
 for(const options of [{date:'2026-09-24'},{coreMissing:true}]){
 const h=harness(options);h.run();await tick();assert.equal(h.ids.workspace.classList.contains('hidden'),false);
 assert.equal(h.ids.fieldSummary.innerHTML,'');assert.equal(h.ids.looksRight.disabled,true);
 h.ids.deckSelect.value='deck-a';await h.ids.deckSelect.fire('change');h.ids.versionSelect.value='v1';await h.ids.savePlan.fire('click');
 assert.equal(h.get().plannedDeckRef.deckVersionId,'v1');assert.equal(h.get().usedDeckRef,null);assert.equal(h.ids.lockPrep.disabled,true);
 }
});

test('mismatched and unknown saved fields require explicit overrides, retained on reload and lock',async()=>{
 const h=harness({date:'2026-09-24'}),saved=h.context.SavedMetas.save('Old field',[{name:'Dragapult',share:1}],'TEF-PBL',{targetFormat:'TEF-PBL',revision:'kept'});
 h.run();await tick();h.ids.savedFieldSelect.value=saved.id;await h.ids.savedFieldSelect.fire('change');await tick();
 assert.equal(h.ids.fieldOverride.checked,false);assert.equal(h.ids.looksRight.disabled,true);
 await h.ids.looksRight.fire('click');assert.equal(h.get().prep,null);
 h.ids.fieldOverride.checked=true;await h.ids.fieldOverride.fire('change');await h.ids.looksRight.fire('click');
 let snap=h.get().prep.expectedFieldSnapshot;assert.equal(snap.override.eventFormat,'TEF-30C');assert.equal(snap.override.fieldFormat,'TEF-PBL');assert.equal(snap.format,'TEF-PBL');
 const reopened=harness({storage:h.storage});reopened.run();await tick();assert.equal(reopened.ids.fieldOverride.checked,true);assert.match(reopened.ids.candidateEvidence.textContent,/not validated/);
 reopened.ids.fieldOverride.checked=false;await reopened.ids.fieldOverride.fire('change');await reopened.ids.looksRight.fire('click');assert.match(reopened.ids.toast.textContent,/Confirm/);
 const F=h.context.EventPrepField,unknown={field:saved.field,name:'Legacy',format:null};assert.equal(F.compatibility(unknown,snap.eventContext).mismatch,true);
 assert.throws(()=>F.snapshot(unknown,unknown.field,unknown.field,snap.eventContext),/override/);
 assert.equal(F.overrideValid(snap,{...snap.eventContext,date:'2026-09-25'}),false);
});

test('field adjustments and exact version lock round-trip; later saved/deck/evidence changes cannot mutate the lock',async()=>{
 const h=harness(),saved=h.context.SavedMetas.save('Event field',[{name:'Dragapult',share:.6},{name:'Gholdengo',share:.4}],'TEF-PBL',{targetFormat:'TEF-PBL',revision:'r-original'});
 h.run();await tick();h.ids.savedFieldSelect.value=saved.id;await h.ids.savedFieldSelect.fire('change');await tick();
 const input=h.ids.fieldAdjustRows.inputs[0];input.value='20';await input.fire('change');h.ids.fieldNote.value='Local testing note';
 h.ids.deckSelect.value='deck-a';await h.ids.deckSelect.fire('change');h.ids.versionSelect.value='v1';await h.ids.savePlan.fire('click');await h.ids.lockPrep.fire('click');
 const locked=clone(h.get().prep.lockedSnapshot);assert.ok(locked);assert.equal(locked.plannedDeckRef.deckVersionId,'v1');assert.equal(locked.plannedDeckRef.listHash,'hash-one');
 assert.equal(locked.fieldSnapshot.provenance.edited,true);assert.ok(Math.abs(locked.fieldSnapshot.field.find(x=>x.name==='Dragapult').share-1/3)<1e-9);assert.equal(locked.fieldSnapshot.note,'Local testing note');
 h.context.SavedMetas.save('Event field',[{name:'Other deck',share:1}],'TEF-PBL');h.decks[0].versions[0].cards[0].name='Changed';
 h.ids.versionSelect.value='v2';await h.ids.savePlan.fire('click');h.ids.savedFieldSelect.value='';await h.ids.savedFieldSelect.fire('change');await h.ids.looksRight.fire('click');
 assert.deepEqual(clone(h.get().prep.lockedSnapshot),locked);assert.equal(h.get().usedDeckRef,null);
 const restored=harness({storage:h.storage});restored.decks.length=0;restored.run();await tick();
 assert.match(restored.ids.plannedSummary.innerHTML,/V1/);assert.equal(restored.ids.savedFieldSelect.disabled,true);assert.equal(restored.ids.fieldNote.disabled,true);
 assert.deepEqual(clone(restored.get().prep.lockedSnapshot),locked);
 await restored.ids.unlockPrep.fire('click');assert.equal(restored.get().prep.lockedSnapshot,null);assert.deepEqual(clone(restored.get().prep.lockHistory[0]),locked);assert.equal(restored.ids.savedFieldSelect.disabled,false);
});

test('lock rejects a changed version hash and never guesses the current deck version',()=>{
 const h=harness(),F=h.context.EventPrepField,context={status:'known',format:'TEF-PBL',date:'2026-09-12'};
 const field={field:[{name:'A',share:1}],format:'TEF-PBL'},deck=h.decks[0],version=deck.versions[0];
 assert.throws(()=>F.lock({plannedDeckRef:{deckId:deck.id,deckVersionId:'v2',listHash:'hash-two'}},field,deck,version,context),/DeckVersion/);
 assert.throws(()=>F.lock({plannedDeckRef:{deckId:deck.id,deckVersionId:'v1',listHash:'changed'}},field,deck,version,context),/DeckVersion/);
});

test('failed compatible H2H retries with bounded handlers; delayed old requests do not replace a new field',async()=>{
 let fail=true;
 const h=harness({loadOverride:async(key,value)=>{if(fail && key==='onlineMatchups')throw new Error('offline');return value}});h.run();await tick();
 assert.match(h.ids.candidateEvidence.textContent,/could not load/);assert.equal(h.ids.candidateRows.innerHTML.includes('candidate-card'),false);
 const count=h.ids.retryEvidence.listeners.get('click').length;fail=false;await h.ids.retryEvidence.fire('click');await tick();assert.doesNotMatch(h.ids.candidateEvidence.textContent,/could not load/);assert.equal(h.ids.retryEvidence.listeners.get('click').length,count);
 let rejectOld;const delayed=harness({loadOverride:(key,value)=>key==='onlineMatchups'?new Promise((_,reject)=>{rejectOld=reject}):Promise.resolve(value)});
 const next=delayed.context.SavedMetas.save('Future',[{name:'Future deck',share:1}],'TEF-30C');delayed.run();await tick();
 delayed.ids.savedFieldSelect.value=next.id;await delayed.ids.savedFieldSelect.fire('change');await tick();rejectOld(new Error('late old failure'));await tick();
 assert.match(delayed.ids.fieldEvidence.textContent,/TEF-30C/);assert.doesNotMatch(delayed.ids.candidateEvidence.textContent,/could not load/);
});

test('a missing explicit saved field stays unavailable and unsaved edits survive release refresh',async()=>{
 const missing=harness({prep:{expectedFieldId:'deleted-field'}});missing.run();await tick();assert.match(missing.ids.fieldEvidence.textContent,/unavailable/);assert.equal(missing.ids.fieldSummary.innerHTML,'');
 const h=harness();h.run();await tick();const input=h.ids.fieldAdjustRows.inputs[0];input.value='1';await input.fire('change');const before=h.ids.fieldSummary.innerHTML;
 const changed=clone(h.files.core);changed.release+='-next';h.replace(changed);await tick();assert.equal(h.ids.fieldSummary.innerHTML,before);
});
