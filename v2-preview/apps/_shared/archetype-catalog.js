(function(global){
  'use strict';
  let rows=[],loadPromise=null;
  const ignored=new Set(['','other','unknown','rogue','no deck']);

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}

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
      const base=new URL('../../data/meta/release/',document.baseURI),target=new Map();
      const manifest=await json(new URL('manifest.json',base));
      const coreUrl=new URL(manifest.files.core.path,base);coreUrl.searchParams.set('release',manifest.release);
      const core=await json(coreUrl);
      collect(core?.online,target,'Online');
      collect(core?.irl,target,'IRL');
      rows=[...target.values()].map(item=>({...item,sources:[...item.sources]})).sort((a,b)=>b.mentions-a.mentions||a.name.localeCompare(b.name));
      return all();
    })().catch(error=>{loadPromise=null;throw error;});
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
  function all(){return rows.map(item=>({...item,sources:[...(item.sources||[])]}))}
  function search(query,limit=12){
    const q=String(query||'').trim().toLocaleLowerCase('en');
    return rows.filter(item=>!q||item.name.toLocaleLowerCase('en').includes(q)).sort((a,b)=>{
      const an=a.name.toLocaleLowerCase('en'),bn=b.name.toLocaleLowerCase('en');
      const ar=an===q?0:an.startsWith(q)?1:2,br=bn===q?0:bn.startsWith(q)?1:2;
      return ar-br||b.mentions-a.mentions||a.name.localeCompare(b.name);
    }).slice(0,limit).map(item=>({...item,sources:[...(item.sources||[])]}));
  }
  function bindSearch(input,list,options={}){
    if(!input||!list)return ()=>{};
    const limit=Math.max(1,Number(options.limit)||12);
    const render=()=>{
      const matches=search(input.value,limit);
      list.innerHTML=matches.map(row=>`<button type="button" data-archetype="${esc(row.name)}">${esc(row.name)}<small>${esc((row.sources||[]).join(' + '))}</small></button>`).join('');
    };
    const choose=async event=>{
      const button=event.target.closest?.('[data-archetype]');
      if(!button)return;
      event.preventDefault();
      const name=button.dataset.archetype||'';
      const row=search(name,limit).find(item=>item.name===name)||{name,sources:[]};
      input.value=name;
      list.innerHTML='';
      if(typeof options.onSelect==='function')await options.onSelect(name,row);
    };
    const clear=()=>{if(!input.value.trim())render()};
    input.addEventListener('focus',render);
    input.addEventListener('input',render);
    input.addEventListener('search',clear);
    list.addEventListener('pointerdown',choose);
    return ()=>{
      input.removeEventListener('focus',render);
      input.removeEventListener('input',render);
      input.removeEventListener('search',clear);
      list.removeEventListener('pointerdown',choose);
    };
  }
  global.PTCGArchetypes={load,mergeSaved,all,search,bindSearch};
})(window);
