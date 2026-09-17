const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function helpers(){
  const source=read('card-info.js');
  const window={PTCGCardCatalog:null};
  const document={getElementById:()=>null};
  const localStorage={getItem:()=>null};
  vm.runInNewContext(source,{window,document,localStorage,String,Number,Object,Array,JSON});
  return window.PTCGKantoCardInfo;
}

test('Kanto card info exposes useful selected-card metadata',()=>{
  const api=helpers();
  const rows=api.cardInfoRows({
    name:'Parasect',localId:'TG01',rarity:'Rare',illustrator:'Oswaldo KATO',
    regulationMark:'F',hp:120,types:['Grass'],stage:'Stage1',legal:{standard:false},
    set:{id:'swsh11tg',name:'Lost Origin Trainer Gallery'}
  },{
    set:'LOR:TG',number:'TG01',setName:'Lost Origin Trainer Gallery'
  },{
    name:'Lost Origin Trainer Gallery',releaseDate:'2022-09-09',abbreviations:{official:'LOR:TG'}
  },'Wanted');

  assert.deepEqual(Array.from(rows,([label,value])=>[label,value]),[
    ['Status','Wanted'],
    ['Set','Lost Origin Trainer Gallery (LOR:TG)'],
    ['Collector number','TG01'],
    ['Rarity','Rare'],
    ['Illustrator','Oswaldo KATO'],
    ['Release date','2022-09-09'],
    ['Regulation mark','F'],
    ['HP','120'],
    ['Type','Grass'],
    ['Stage','Stage 1'],
    ['Standard legality','Not legal']
  ]);
});

test('Kanto card info keeps optional metadata optional',()=>{
  const api=helpers();
  const rows=api.cardInfoRows({name:'Nidorina',localId:'101',set:{name:'MEP Black Star Promos'}},{set:'MEP',number:'101'},null,'Owned');
  assert.deepEqual(Array.from(rows,([label,value])=>[label,value]),[
    ['Status','Owned'],
    ['Set','MEP Black Star Promos (MEP)'],
    ['Collector number','101']
  ]);
});

test('Kanto main screen loads info UI and makes wanted art substantially clearer',()=>{
  const html=read('index.html');
  const css=read('card-info.css');
  const source=read('card-info.js');
  assert.match(html,/card-info\.css/);
  assert.match(html,/card-info\.js/);
  assert.ok(html.indexOf('./card-info.js')>html.indexOf('./app.js'));
  assert.match(css,/\.dex-slot:not\(\.owned\) \.slot-art\s*\{[\s\S]*opacity:\s*\.78/);
  assert.match(source,/data-card-info/);
  assert.match(source,/catalog\?\.card/);
  assert.match(source,/catalog\?\.exactDeckIdentity/);
  assert.match(source,/catalog\?\.set/);
});
