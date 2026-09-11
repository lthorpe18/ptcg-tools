const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('official TCGdex set abbreviation resolves MEP 073 to the Limitless artwork identity',async()=>{
  const catalogSource=read('v2-preview/apps/_shared/card-catalog.js');
  const imageSource=read('v2-preview/apps/_shared/card-images.js');
  const responses=new Map([
    ['https://api.tcgdex.net/v2/en/series/tcgp',{id:'tcgp',sets:[]}],
    ['https://api.tcgdex.net/v2/en/sets/mep',{
      id:'mep',
      name:'MEP Black Star Promos',
      abbreviations:{official:'MEP'},
      releaseDate:'2025-09-26'
    }]
  ]);
  const fetch=async url=>({
    ok:responses.has(String(url)),
    status:responses.has(String(url))?200:404,
    json:async()=>responses.get(String(url))
  });
  const window={};
  const context=vm.createContext({window,fetch,URLSearchParams,Map,Set,Promise,String,Number,Array,Object,console});
  vm.runInContext(catalogSource,context);
  vm.runInContext(imageSource,context);

  const card={
    id:'mep-073',
    name:'Mega Gengar ex',
    localId:'073',
    set:{id:'mep',name:'MEP Black Star Promos'},
    category:'Pokemon',
    regulationMark:'I',
    legal:{standard:true}
  };
  const identity=await window.PTCGCardCatalog.exactDeckIdentity(card);
  assert.equal(identity.set,'MEP');
  assert.equal(identity.number,'073');
  assert.match(window.PTCGCardImages.imageUrl(identity),/\/MEP\/MEP_073_R_EN\.png$/);
});
