const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('Kanto set-code resolver handles TCGdex CardBrief search results',async()=>{
  const catalogSource=read('v2-preview/apps/_shared/card-catalog.js');
  const shimSource=read('v2-preview/spinoffs/kanto-151/set-code-identity.js');
  const responses=new Map([
    ['https://api.tcgdex.net/v2/en/series/tcgp',{id:'tcgp',sets:[]}],
    ['https://api.tcgdex.net/v2/en/sets/svp',{
      id:'svp',
      name:'SVP Black Star Promos',
      abbreviations:{official:'SVP'},
      releaseDate:'2023-03-31'
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
  vm.runInContext(shimSource,context);

  const brief={id:'svp-044',localId:'044',name:'Charmander',image:'https://assets.tcgdex.net/en/sv/svp/044'};
  const identity=await window.PTCGCardCatalog.exactDeckIdentity(brief);

  assert.equal(identity.set,'SVP');
  assert.equal(identity.number,'044');
});

test('Kanto loads the CardBrief identity shim before app search logic',()=>{
  const html=read('v2-preview/spinoffs/kanto-151/index.html');
  const shim=html.indexOf('<script src="./set-code-identity.js"></script>');
  const app=html.indexOf('<script src="./app.js"></script>');
  assert.ok(shim>=0);
  assert.ok(app>shim);
});
