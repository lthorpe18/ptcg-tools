const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Kanto card number filter matches the printed local number exactly',async()=>{
  const source=read('card-number-filter.js');
  let value='009';
  const catalog={searchAdvanced:async()=>[
    {id:'set-009',localId:'009'},
    {id:'set-010',localId:'010'},
    {id:'promo-9A',localId:'9A'}
  ]};
  const window={PTCGCardCatalog:catalog};
  const document={getElementById:id=>id==='filter-card-number'?{value}:null};
  vm.runInNewContext(source,{window,document,String});

  let rows=await catalog.searchAdvanced({name:'Blastoise'});
  assert.deepEqual(rows.map(row=>row.id),['set-009']);
  assert.equal(window.PTCGKantoCardNumber.normaliseCardNumber('9'),'9');
  assert.equal(window.PTCGKantoCardNumber.normaliseCardNumber('#009'),'9');

  value='9A';
  rows=await catalog.searchAdvanced({name:'Blastoise'});
  assert.deepEqual(rows.map(row=>row.id),['promo-9A']);
});

test('Kanto loads card number filtering before app search logic',()=>{
  const html=read('index.html');
  const filterIndex=html.indexOf('<script src="./card-number-filter.js"></script>');
  const appIndex=html.indexOf('<script src="./app.js"></script>');
  assert.ok(filterIndex>=0&&appIndex>filterIndex);
  assert.match(read('search-filter-reset.js'),/cardNumber.*requestSubmit/s);
});
