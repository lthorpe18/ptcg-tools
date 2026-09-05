(function(){
  'use strict';

  const frames=[...document.querySelectorAll('.shell-view')];
  const nav=[...document.querySelectorAll('.shell-nav-item')];
  const status=document.getElementById('shellStatus');
  const root=new URL('./',window.location.href);
  const frameBySection=new Map(frames.map(frame=>[frame.dataset.section,frame]));
  const loaded=new Set();
  const routes=new Map();
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

  function isCanonicalHome(input){
    try{
      const url=new URL(input,window.location.href);
      const base=root.pathname.replace(/\/$/,'');
      return url.origin===window.location.origin&&url.pathname===`${base}/home-content.html`;
    }catch{return false}
  }

  function validRoute(section,input){
    if(!input)return null;
    try{
      const url=new URL(input,window.location.href);
      return sectionForUrl(url.href)===section?url.href:null;
    }catch{return null}
  }

  function routeToken(input){
    try{
      const url=new URL(input,window.location.href);
      return `${url.pathname}${url.search}${url.hash}`;
    }catch{return ''}
  }

  function currentFrameUrl(section){
    const frame=frameBySection.get(section);
    if(!frame)return null;
    try{
      const current=frame.contentWindow?.location?.href;
      return validRoute(section,current);
    }catch{return validRoute(section,frame.src)}
  }

  function shellUrlFor(section,childUrl){
    const shellUrl=new URL(window.location.href);
    if(section==='home')shellUrl.searchParams.delete('section');else shellUrl.searchParams.set('section',section);
    const route=section==='home'?null:validRoute(section,childUrl);
    if(route)shellUrl.searchParams.set('route',routeToken(route));else shellUrl.searchParams.delete('route');
    shellUrl.hash='';
    return shellUrl;
  }

  function showStatus(text){
    if(!status)return;
    status.textContent=text;
    status.hidden=false;
  }
  function hideStatus(){if(status)status.hidden=true}

  function restoreHomeFrame(){
    const frame=frameBySection.get('home');
    if(!frame)return;
    let current='';
    try{current=frame.contentWindow?.location?.href||frame.src||''}catch{current=frame.src||''}
    if(isCanonicalHome(current))return;
    const target=frame.dataset.src||'./home-content.html?v=4';
    frame.dataset.loading='1';
    frame.src=target;
  }

  function sendFrameRoute(frame,url){
    const childUrl=validRoute(frame.dataset.section,url);
    if(!childUrl||!frame.contentWindow)return;
    try{frame.contentWindow.postMessage({type:'ptcg:shell-apply-route',url:childUrl},window.location.origin)}catch{}
  }

  function loadFrame(section,url){
    const frame=frameBySection.get(section);
    if(!frame)return;
    if(section==='home'&&!url){restoreHomeFrame();return}
    const requested=validRoute(section,url);
    if(requested)routes.set(section,requested);
    const target=requested||routes.get(section)||frame.dataset.src;
    if(target&&(!frame.src||frame.getAttribute('src')==='about:blank')){
      frame.dataset.loading='1';
      frame.src=target;
      return;
    }
    if(target&&section==='meta'&&loaded.has(section)){
      sendFrameRoute(frame,target);
      return;
    }
    if(requested){
      try{
        const current=frame.contentWindow?.location?.href;
        const requested=new URL(target,window.location.href).href;
        if(current&&current!==requested){
          frame.dataset.loading='1';
          frame.contentWindow.location.replace(requested);
        }
      }catch{
        frame.dataset.loading='1';
        frame.src=target;
      }
    }
  }

  function activate(section,url,historyMode='push'){
    if(!frameBySection.has(section))return;
    const requested=validRoute(section,url)||routes.get(section)||currentFrameUrl(section);
    if(requested)routes.set(section,requested);
    loadFrame(section,requested);
    active=section;
    for(const frame of frames)frame.classList.toggle('is-active',frame.dataset.section===section);
    for(const item of nav){
      const on=item.dataset.target===section;
      item.classList.toggle('is-active',on);
      if(on)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    }
    if(!loaded.has(section))showStatus(`Loading ${label(section)}…`);else hideStatus();
    if(historyMode!=='none'){
      const childUrl=requested||currentFrameUrl(section);
      const state={section,childUrl:childUrl||null};
      const shellUrl=shellUrlFor(section,childUrl);
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

      if(section===frame.dataset.section){
        if(section==='home'){
          event.preventDefault();
          activate('home',null,'push');
        }else if(section==='meta'){
          event.preventDefault();
          activate(section,url.href,'push');
        }
        return;
      }

      event.preventDefault();
      activate(section,url.href,'push');
    },true);
  }

  for(const frame of frames){
    frame.addEventListener('load',()=>{
      loaded.add(frame.dataset.section);
      delete frame.dataset.loading;
      installChildBridge(frame);
      if(frame.dataset.section==='meta'&&routes.has('meta'))sendFrameRoute(frame,routes.get('meta'));
      if(frame.dataset.section===active)hideStatus();
    });
  }

  for(const item of nav)item.addEventListener('click',()=>activate(item.dataset.target,null,'push'));

  window.addEventListener('message',event=>{
    if(event.origin!==window.location.origin||event.data?.type!=='ptcg:shell-navigate')return;
    const frame=frames.find(candidate=>candidate.contentWindow===event.source);
    if(!frame)return;
    const section=frame.dataset.section;
    const childUrl=validRoute(section,event.data.url);
    if(!childUrl||section!==active)return;
    routes.set(section,childUrl);
    const state={section,childUrl};
    const shellUrl=shellUrlFor(section,childUrl);
    if(event.data.mode==='replace')history.replaceState(state,'',shellUrl);
    else history.pushState(state,'',shellUrl);
  });

  window.addEventListener('popstate',event=>{
    const params=new URLSearchParams(location.search);
    const section=event.state?.section||params.get('section')||'home';
    const route=event.state?.childUrl||params.get('route');
    const requested=validRoute(section,route);
    if(requested)routes.set(section,requested);
    activate(section,requested,'none');
  });

  const params=new URLSearchParams(location.search);
  const initial=params.get('section')||'home';
  const initialRoute=validRoute(initial,params.get('route'));
  if(initial!=='home')activate(initial,initialRoute,'replace');else history.replaceState({section:'home',childUrl:null},'',shellUrlFor('home',null));
})();
