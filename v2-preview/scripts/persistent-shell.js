(function(){
  'use strict';

  const frames=[...document.querySelectorAll('.shell-view')];
  const nav=[...document.querySelectorAll('.shell-nav-item')];
  const status=document.getElementById('shellStatus');
  const root=new URL('./',window.location.href);
  const frameBySection=new Map(frames.map(frame=>[frame.dataset.section,frame]));
  const loaded=new Set();
  let active='home';

  function label(section){return ({home:'Home',meta:'Meta',decks:'Decks',compete:'Compete',tools:'Tools'})[section]||section}

  function sectionForUrl(input){
    let url;
    try{url=new URL(input,window.location.href)}catch{return null}
    if(url.origin!==window.location.origin)return null;
    const path=url.pathname.replace(/\/+/g,'/');
    const base=root.pathname.replace(/\/$/,'');
    if(path===base||path===`${base}/`||path===`${base}/index.html`||path===`${base}/home-content.html`)return 'home';
    if(path.startsWith(`${base}/apps/meta`))return 'meta';
    if(path.startsWith(`${base}/apps/decklists`))return 'decks';
    if(path.startsWith(`${base}/apps/events`)||path.startsWith(`${base}/apps/swiss`))return 'compete';
    if(path.startsWith(`${base}/apps/tools`))return 'tools';
    return null;
  }

  function showStatus(text){
    if(!status)return;
    status.textContent=text;
    status.hidden=false;
  }
  function hideStatus(){if(status)status.hidden=true}

  function loadFrame(section,url){
    const frame=frameBySection.get(section);
    if(!frame)return;
    const target=url||frame.dataset.src;
    if(target&&(!frame.src||frame.getAttribute('src')==='about:blank')){
      frame.dataset.loading='1';
      frame.src=target;
      return;
    }
    if(url){
      try{
        const current=frame.contentWindow?.location?.href;
        const requested=new URL(url,window.location.href).href;
        if(current&&current!==requested){frame.dataset.loading='1';frame.src=requested}
      }catch{frame.dataset.loading='1';frame.src=url}
    }
  }

  function activate(section,url,historyMode='push'){
    if(!frameBySection.has(section))return;
    loadFrame(section,url);
    active=section;
    for(const frame of frames)frame.classList.toggle('is-active',frame.dataset.section===section);
    for(const item of nav){
      const on=item.dataset.target===section;
      item.classList.toggle('is-active',on);
      if(on)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    }
    if(!loaded.has(section))showStatus(`Loading ${label(section)}…`);else hideStatus();
    if(historyMode!=='none'){
      const shellUrl=new URL(window.location.href);
      if(section==='home')shellUrl.searchParams.delete('section');else shellUrl.searchParams.set('section',section);
      const state={section};
      if(historyMode==='replace')history.replaceState(state,'',shellUrl);else history.pushState(state,'',shellUrl);
    }
  }

  function installChildBridge(frame){
    let doc;
    try{doc=frame.contentDocument}catch{return}
    if(!doc||doc.documentElement.dataset.ptcgPersistentShell==='1')return;
    doc.documentElement.dataset.ptcgPersistentShell='1';

    const style=doc.createElement('style');
    style.textContent='.app-bottom-nav{display:none!important} body{padding-bottom:0!important} .app-shell-page,.wrap{padding-bottom:max(18px,env(safe-area-inset-bottom))!important}';
    doc.head.appendChild(style);

    doc.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button&&event.button!==0)return;
      const anchor=event.target.closest?.('a[href]');
      if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
      let url;
      try{url=new URL(anchor.href,frame.contentWindow.location.href)}catch{return}
      const section=sectionForUrl(url.href);
      if(!section)return;
      if(section===frame.dataset.section)return;
      event.preventDefault();
      activate(section,url.href,'push');
    },true);
  }

  for(const frame of frames){
    frame.addEventListener('load',()=>{
      loaded.add(frame.dataset.section);
      delete frame.dataset.loading;
      installChildBridge(frame);
      if(frame.dataset.section===active)hideStatus();
    });
  }

  for(const item of nav)item.addEventListener('click',()=>activate(item.dataset.target,null,'push'));

  window.addEventListener('popstate',event=>{
    const params=new URLSearchParams(location.search);
    const section=event.state?.section||params.get('section')||'home';
    activate(section,null,'none');
  });

  function warm(section,delay){
    setTimeout(()=>{
      if(!loaded.has(section))loadFrame(section);
    },delay);
  }

  const initial=new URLSearchParams(location.search).get('section')||'home';
  if(initial!=='home')activate(initial,null,'replace');else history.replaceState({section:'home'},'',location.href);

  warm('meta',250);
  warm('decks',900);
  warm('compete',1550);
  warm('tools',2200);
})();
