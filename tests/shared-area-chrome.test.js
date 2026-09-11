const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('top-level area selectors share one shell visual contract',()=>{
  const css=read('v2-preview/apps/_shared/app-shell.css');
  for(const selector of ['.workspace-tabs','.event-view-tabs','.tools-segment','.source-segment']){
    assert.match(css,new RegExp(selector.replace('.','\\.')));
  }
  assert.match(css,/min-height:40px!important/);
  assert.match(css,/background:#eef1f5!important/);
  assert.match(css,/border-radius:12px!important/);
  assert.match(css,/button\[aria-selected="true"\]/);
  assert.match(css,/button\.active/);
});

test('shared shell normalises the visible identity of each primary area',()=>{
  const source=read('v2-preview/apps/_shared/app-shell.js');
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/meta:\['Meta','Current field & competitive analysis'\]/);
  assert.match(source,/decks:\['Decks','Build, train and playtest'\]/);
  assert.match(source,/compete:\['Compete','Events, tournaments and season'\]/);
  assert.match(source,/tools:\['Tools','Fast competitive utilities'\]/);
  assert.match(source,/title\.textContent=areaHeader\[0\]/);
  assert.match(source,/subtitle\.textContent=areaHeader\[1\]/);
});

test('Compete removes its duplicated area title and leads with the common selector',()=>{
  const css=read('v2-preview/apps/_shared/app-shell.css');
  assert.match(css,/body\[data-app-section="compete"\] \.event-view-tabs\{order:-2!important\}/);
  assert.match(css,/body\[data-app-section="compete"\] \.events-page-head\{order:-1!important/);
  assert.match(css,/\.events-page-head>div:first-child\{display:none!important\}/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 44px!important/);
});

test('Compete keeps its four-way selector readable on mobile',()=>{
  const html=read('v2-preview/apps/events/index.html');
  assert.match(html,/id="myTournamentsTab"[^>]*>My Events<\/button>/);
  assert.doesNotMatch(html,/>My Tournaments<\/button>/);
});
