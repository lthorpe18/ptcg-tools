const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('v2-preview/apps/_shared/card-catalog.js','utf8');

function catalogHarness({runtime=true}={}){
  const urls=[],legalityCalls=[];
  const briefs=[
    {id:'test-h',name:'Test H',set:{id:'set-h'}},
    {id:'test-g',name:'Test G',set:{id:'set-g'}}
  ];
  const details={
    'test-h':{id:'test-h',name:'Test H',category:'Pokemon',regulationMark:'H',set:{id:'set-h'},legal:{standard:false}},
    'test-g':{id:'test-g',name:'Test G',category:'Pokemon',regulationMark:'G',set:{id:'set-g'},legal:{standard:true}}
  };
  const fetch=async url=>{
    const value=String(url);urls.push(value);
    if(value.endsWith('/series/tcgp'))return {ok:true,status:200,json:async()=>({id:'tcgp',sets:[]})};
    if(value.includes('/cards?'))return {ok:true,status:200,json:async()=>briefs};
    const id=decodeURIComponent(value.split('/cards/')[1]||'');
    if(details[id])return {ok:true,status:200,json:async()=>details[id]};
    return {ok:false,status:404,json:async()=>({})};
  };
  const window={};
  if(runtime){
    window.PTCGFormatRuntime={
      ready:async()=>({}),
      today:()=> '2026-09-15',
      resolveCardLegality:(card,event)=>{
        legalityCalls.push({card:card.id,event:{...event}});
        return {status:card.regulationMark==='H'?'legal':'illegal'};
      }
    };
  }
  const context=vm.createContext({window,fetch,URLSearchParams,Map,Set,Promise,String,Number,Array,Object,console});
  vm.runInContext(source,context);
  return {catalog:window.PTCGCardCatalog,urls,legalityCalls};
}

test('Standard Card Search delegates to the maintained current Online format, not TCGdex legal.standard',async()=>{
  const h=catalogHarness();
  const rows=await h.catalog.searchAdvanced({name:'Test',standardOnly:true});
  assert.deepEqual(rows.map(card=>card.id),['test-h']);
  assert.equal(h.urls.some(url=>url.includes('legal.standard')),false);
  assert.deepEqual(h.legalityCalls.map(call=>call.event),[
    {date:'2026-09-15',environment:'online'},
    {date:'2026-09-15',environment:'online'}
  ]);
});

test('Card legality can be resolved for an explicit IRL date without changing catalog authority',async()=>{
  const h=catalogHarness();
  await h.catalog.searchAdvanced({name:'Test',standardOnly:true,date:'2026-09-24',environment:'irl'});
  assert.ok(h.legalityCalls.length>0);
  assert.deepEqual(h.legalityCalls[0].event,{date:'2026-09-24',environment:'irl'});
  assert.equal(h.urls.some(url=>url.includes('legal.standard')),false);
});

test('standalone catalog consumers without the format runtime keep the legacy TCGdex compatibility filter',async()=>{
  const h=catalogHarness({runtime:false});
  const rows=await h.catalog.searchAdvanced({name:'Test',standardOnly:true});
  assert.equal(h.urls.some(url=>url.includes('legal.standard=true')),true);
  assert.deepEqual(rows.map(card=>card.id),['test-g']);
  assert.equal(h.legalityCalls.length,0);
});