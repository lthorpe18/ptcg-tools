(function(global){
  'use strict';
  let rows=[],loadPromise=null;
  const ignored=new Set(['','other','unknown','rogue','no deck']);

  function add(target,name,source){
    const clean=String(name||'').replace(/\s+/g,' ').trim();
    const key=clean.toLocaleLowerCase('en');
    if(ignored.has(key)||clean.length>80)return;
    const current=target.get(key)||{name:clean,mentions:0,sources:new Set()};
    current.mentions++;
    current.sources.add(source);
    target.set(key,current);
  }
  function collect(value,target,source){
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){value.forEach(item=>collect(item,target,source));return}
    for(const [key,child] of Object.entries(value)){
      if((key==='archetypes'||key==='decks')&&Array.isArray(child)){
        child.forEach(item=>{
          if(typeof item==='string')add(target,item,source);
          else if(item&&typeof item==='object')add(target,item.name||item.archetype||item.deck,source);
        });
      }
      collect(child,target,source);
    }
  }
  async function json(url){
    const response=await fetch(url,{cache:'no-cache'});
    if(!response.ok)throw new Error(`Archetype source unavailable (${response.status})`);
    return response.json();
  }
  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=(async()=>{
      const base=new URL('../../data/meta/',document.baseURI),target=new Map();
      const sources=await Promise.allSettled([json(new URL('current-field.json',base)),json(new URL('irl/TEF-PBL.json',base))]);
      if(sources[0].status==='fulfilled')collect(sources[0].value,target,'Online');
      if(sources[1].status==='fulfilled')collect(sources[1].value,target,'IRL');
      rows=[...target.values()].map(item=>({...item,sources:[...item.sources]})).sort((a,b)=>b.mentions-a.mentions||a.name.localeCompare(b.name));
      return rows;
    })();
    return loadPromise;
  }
  function mergeSaved(names){
    const target=new Map(rows.map(item=>[item.name.toLocaleLowerCase('en'),item]));
    (names||[]).forEach(name=>{
      const clean=String(name||'').trim(),key=clean.toLocaleLowerCase('en');
      if(clean&&!target.has(key))target.set(key,{name:clean,mentions:0,sources:['My Decks']});
    });
    rows=[...target.values()];
  }
  function search(query,limit=12){
    const q=String(query||'').trim().toLocaleLowerCase('en');
    return rows.filter(item=>!q||item.name.toLocaleLowerCase('en').includes(q)).sort((a,b)=>{
      const an=a.name.toLocaleLowerCase('en'),bn=b.name.toLocaleLowerCase('en');
      const ar=an===q?0:an.startsWith(q)?1:2,br=bn===q?0:bn.startsWith(q)?1:2;
      return ar-br||b.mentions-a.mentions||a.name.localeCompare(b.name);
    }).slice(0,limit);
  }
  global.PTCGArchetypes={load,mergeSaved,search};
})(window);
