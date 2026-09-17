(function(global){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }

  function setName(saved){
    const card=saved?.card;
    if(!card?.id)return 'Unselected';
    return String(card?.set?.name||card?.set?.id||'Unknown set').trim()||'Unknown set';
  }

  function setKey(saved){
    const card=saved?.card;
    if(!card?.id)return '\uffff';
    return setName(saved).toLocaleLowerCase('en');
  }

  function collectorKey(saved){
    const value=String(saved?.card?.localId||'').trim().toUpperCase();
    if(!value)return '\uffff';
    const match=value.match(/^([^0-9]*)(\d+)(.*)$/);
    if(!match)return value;
    return `${match[1]}${String(Number(match[2])||0).padStart(8,'0')}${match[3]}`;
  }

  function compareEntries(a,b){
    const aSelected=Boolean(a?.saved?.card?.id);
    const bSelected=Boolean(b?.saved?.card?.id);
    if(aSelected!==bSelected)return aSelected?-1:1;
    if(!aSelected)return (a.number||0)-(b.number||0);

    const bySet=setKey(a.saved).localeCompare(setKey(b.saved),'en',{sensitivity:'base'});
    if(bySet)return bySet;
    const byCollector=collectorKey(a.saved).localeCompare(collectorKey(b.saved),'en',{numeric:false,sensitivity:'base'});
    if(byCollector)return byCollector;
    return (a.number||0)-(b.number||0);
  }

  function sectionKey(saved){
    return saved?.card?.id?`set:${setKey(saved)}`:'unselected';
  }

  function groupEntries(entries=[]){
    const groups=[];
    let current=null;
    [...entries].sort(compareEntries).forEach(entry=>{
      const key=sectionKey(entry.saved);
      if(!current||current.key!==key){
        current={key,label:setName(entry.saved),entries:[]};
        groups.push(current);
      }
      current.entries.push(entry);
    });
    return groups;
  }

  global.PTCGKantoSetGrouping={setName,setKey,collectorKey,compareEntries,sectionKey,groupEntries};

  const grid=document.getElementById('pokedex-grid');
  const sortSelect=document.getElementById('collection-sort');
  if(!grid||!sortSelect)return;

  let applying=false;

  function clearHeadings(){
    grid.querySelectorAll('[data-set-section-heading]').forEach(node=>node.remove());
  }

  function createHeading(group,index,order){
    const heading=document.createElement('div');
    heading.className='set-section-heading';
    heading.dataset.setSectionHeading=group.key;
    heading.dataset.first=String(index===0);
    heading.style.order=String(order);
    heading.setAttribute('role','heading');
    heading.setAttribute('aria-level','2');

    const title=document.createElement('strong');
    title.textContent=group.label;
    const count=document.createElement('span');
    count.textContent=`${group.entries.length} card${group.entries.length===1?'':'s'}`;
    heading.append(title,count);
    return heading;
  }

  function applySetGrouping(){
    applying=true;
    try{
      clearHeadings();
      if(sortSelect.value!=='set')return;

      const state=loadState();
      const entries=[...grid.querySelectorAll('.dex-slot[data-number]')]
        .map(slot=>{
          const number=Number(slot.dataset.number)||0;
          return {number,saved:state[String(number)]||null,slot};
        })
        .filter(entry=>!entry.slot.hidden);

      const groups=groupEntries(entries);
      let order=0;
      groups.forEach((group,index)=>{
        grid.appendChild(createHeading(group,index,order++));
        group.entries.forEach(entry=>{entry.slot.style.order=String(order++);});
      });
    }finally{
      applying=false;
    }
  }

  sortSelect.addEventListener('change',applySetGrouping);
  document.querySelectorAll('[data-collection-filter]').forEach(button=>button.addEventListener('click',applySetGrouping));

  const observer=new MutationObserver(records=>{
    if(applying)return;
    const slotChanged=records.some(record=>[...record.addedNodes,...record.removedNodes]
      .some(node=>node?.classList?.contains('dex-slot')));
    if(slotChanged)applySetGrouping();
  });
  observer.observe(grid,{childList:true});
  applySetGrouping();
})(window);
