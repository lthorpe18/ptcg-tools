const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(process.cwd(),'v2-preview','spinoffs','kanto-151');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function helpers(){
  const source=read('set-grouping.js');
  const window={};
  const document={getElementById:()=>null,querySelectorAll:()=>[]};
  const localStorage={getItem:()=>null};
  vm.runInNewContext(source,{window,document,localStorage,String,Number,Object,Set,JSON,MutationObserver:function(){}});
  return window.PTCGKantoSetGrouping;
}

test('set grouping keeps selected cards together by set then collector number',()=>{
  const api=helpers();
  const rows=[
    {number:25,saved:{card:{id:'a',localId:'10',set:{name:'Zulu Set'}}}},
    {number:4,saved:{card:{id:'b',localId:'2',set:{name:'Alpha Set'}}}},
    {number:7,saved:{card:{id:'c',localId:'11',set:{name:'Alpha Set'}}}},
    {number:1,saved:null}
  ].sort(api.compareEntries);
  assert.deepEqual(rows.map(row=>row.number),[4,7,25,1]);
});

test('set grouping creates named sections and a final Unselected section',()=>{
  const api=helpers();
  const groups=api.groupEntries([
    {number:25,saved:{card:{id:'a',localId:'10',set:{name:'Zulu Set'}}}},
    {number:4,saved:{card:{id:'b',localId:'2',set:{name:'Alpha Set'}}}},
    {number:7,saved:{card:{id:'c',localId:'11',set:{name:'Alpha Set'}}}},
    {number:1,saved:null}
  ]);
  assert.deepEqual(Array.from(groups,group=>group.label),['Alpha Set','Zulu Set','Unselected']);
  assert.deepEqual(Array.from(groups,group=>group.entries.length),[2,1,1]);
});

test('collector number sorting handles prefixed numbers numerically',()=>{
  const api=helpers();
  assert.ok(api.collectorKey({card:{localId:'TG2'}})<api.collectorKey({card:{localId:'TG10'}}));
  assert.ok(api.collectorKey({card:{localId:'9'}})<api.collectorKey({card:{localId:'10'}}));
});

test('main screen exposes Set sorting and visible full-width set headings',()=>{
  const html=read('index.html');
  const source=read('set-grouping.js');
  const css=read('collection-controls.css');
  assert.match(html,/<option value="set">Set<\/option>/);
  assert.ok(html.indexOf('./set-grouping.js')>html.indexOf('./collection-controls.js'));
  assert.match(source,/data-set-section-heading/);
  assert.match(source,/className='set-section-heading'/);
  assert.match(source,/group\.label/);
  assert.match(source,/filter\(entry=>!entry\.slot\.hidden\)/);
  assert.match(css,/\.set-section-heading\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
});
