const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function helpers(){
  const source=read('collection-controls.js');
  const window={PTCGCardCatalog:null,PTCGCardImages:null};
  const document={getElementById:()=>null,querySelectorAll:()=>[]};
  const localStorage={getItem:()=>null};
  vm.runInNewContext(source,{window,document,localStorage,String,Number,Object,Set,JSON});
  return window.PTCGKantoCollectionControls;
}

test('Kanto main collection controls distinguish wanted and owned cards',()=>{
  const api=helpers();
  assert.equal(api.classify(null),'unselected');
  assert.equal(api.classify({card:{id:'a'},owned:false}),'wanted');
  assert.equal(api.classify({card:{id:'a'},owned:true}),'owned');

  const state={
    '1':{card:{id:'a'},owned:false},
    '2':{card:{id:'b'},owned:true},
    '3':{}
  };
  assert.deepEqual(Array.from(api.wantedEntries(state),entry=>entry.number),[1]);
  assert.equal(api.visibleFor('wanted','wanted'),true);
  assert.equal(api.visibleFor('owned','wanted'),false);
});

test('Kanto main sorting supports Pokedex, wanted-first and owned-first',()=>{
  const api=helpers();
  assert.equal(api.sortOrder(25,'unselected','dex'),25);
  assert.ok(api.sortOrder(25,'wanted','wanted')<api.sortOrder(1,'owned','wanted'));
  assert.ok(api.sortOrder(25,'owned','owned')<api.sortOrder(1,'wanted','owned'));
});

test('Cardmarket copy format uses Pokemon name, abilities, attacks and expansion',()=>{
  const api=helpers();
  const line=api.formatCardmarketLine({
    name:'Parasect',
    abilities:[{name:'Lethargy Spores'}],
    attacks:[{name:'X-Scissor'}],
    set:{name:'Lost Origin Trainer Gallery'}
  });
  assert.equal(line,'1x Parasect Lethargy Spores X-Scissor (Lost Origin Trainer Gallery)');

  const nidorina=api.formatCardmarketLine({
    name:'Nidorina',
    abilities:[{name:'Share Happiness'}],
    attacks:[{name:'Bite'}],
    set:{name:'MEP Black Star Promos'}
  });
  assert.equal(nidorina,'1x Nidorina Share Happiness Bite (MEP Black Star Promos)');
});

test('wanted image layout remains exportable even for all 151 cards',()=>{
  const api=helpers();
  const small=api.wantedImageLayout(3);
  assert.equal(small.columns,3);
  assert.equal(small.rows,1);
  const full=api.wantedImageLayout(151);
  assert.equal(full.columns,5);
  assert.equal(full.rows,31);
  assert.ok(full.width<2048);
  assert.ok(full.height<12000);
});

test('Kanto main screen exposes collection filters, sorting, Cardmarket copy and wanted image generation',()=>{
  const html=read('index.html');
  const css=read('collection-controls.css');
  const source=read('collection-controls.js');
  assert.match(html,/data-collection-filter="all"[\s\S]*data-collection-filter="wanted"[\s\S]*data-collection-filter="owned"/);
  assert.match(html,/id="collection-sort"[\s\S]*Wanted first[\s\S]*Owned first/);
  assert.match(html,/id="copy-wanted"[^>]*>Copy wanted for Cardmarket/);
  assert.match(css,/\.dex-slot\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css,/grid-template-columns:\s*minmax\(0,\s*\.78fr\)\s*repeat\(2,/);
  assert.match(source,/generate-wanted-image/);
  assert.match(source,/Generate wanted image/);
  assert.match(source,/wanted-image-dialog/);
  assert.match(source,/images\?\.resolve/);
  assert.match(source,/canvas\.toBlob/);
  assert.match(source,/ClipboardItem/);
  assert.match(source,/kanto-151-wanted\.png/);
  assert.match(source,/navigator\.clipboard\?\.writeText/);
  assert.ok(html.indexOf('./collection-controls.js')>html.indexOf('./app.js'));
});

test('release-day Nidorina includes importer terms',()=>{
  const source=read('recent-release-cards.js');
  assert.match(source,/id:'mep-101'[\s\S]*abilities:\[\{name:'Share Happiness'\}\],attacks:\[\{name:'Bite'\}\]/);
});
