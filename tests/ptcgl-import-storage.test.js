const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'v2-preview/apps/_shared/match-store.js'),'utf8');

function loadMatchStore(initialState){
  let state=structuredClone(initialState);
  const window={
    crypto:{randomUUID:()=>`id-${Math.random().toString(36).slice(2)}`},
    console,
    addEventListener(){},
    removeEventListener(){},
    PTCGStorage:{
      ROOT_KEY:'ptcg-tools-v2',
      load:()=>structuredClone(state),
      save:value=>{state=structuredClone(value);return structuredClone(state)},
      update:mutator=>{const current=structuredClone(state);state=structuredClone(mutator(current)||current);return structuredClone(state)}
    }
  };
  const context=vm.createContext({window,console,Date,Object,Array,Number,String,Set,Math});
  vm.runInContext(source,context);
  return {store:window.PTCGMatchStore,state:()=>structuredClone(state)};
}

test('Match store removes legacy raw PTCGL logs while keeping duplicate hashes',()=>{
  const fixture=loadMatchStore({
    matches:[{
      id:'legacy-match',
      source:'ptcgl',
      playedAt:'2026-10-01T12:00:00.000Z',
      result:'win',
      import:{kind:'ptcgl-battle-log',hash:'legacy-hash',parserVersion:1,rawLog:'x'.repeat(20000),importedAt:'2026-10-01T12:00:00.000Z'}
    }]
  });

  const compacted=fixture.state().matches[0].import;
  assert.equal(compacted.rawLog,undefined);
  assert.equal(compacted.hash,'legacy-hash');
});

test('new PTCGL imports persist metadata but never the full raw battle log',()=>{
  const fixture=loadMatchStore({matches:[]});
  const saved=fixture.store.put({
    source:'ptcgl',
    playedAt:'2026-10-12T12:00:00.000Z',
    result:'loss',
    opponentArchetype:"Cynthia's Garchomp",
    import:{kind:'ptcgl-battle-log',hash:'battle-hash',parserVersion:1,rawLog:'battle line\n'.repeat(5000),importedAt:'2026-10-12T12:00:00.000Z'}
  });

  assert.equal(saved.duplicate,false);
  const stored=fixture.state().matches[0];
  assert.equal(stored.import.rawLog,undefined);
  assert.equal(stored.import.hash,'battle-hash');
  assert.equal(stored.import.kind,'ptcgl-battle-log');

  const duplicate=fixture.store.put({source:'ptcgl',result:'loss',import:{kind:'ptcgl-battle-log',hash:'battle-hash',rawLog:'another large log'}});
  assert.equal(duplicate.duplicate,true);
  assert.equal(fixture.state().matches.length,1);
});
