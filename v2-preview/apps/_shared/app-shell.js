(function(){
  'use strict';
  const body=document.body;
  if(!body)return;
  const root=(body.dataset.appRoot||'.').replace(/\/$/,'');
  const iconHref=new URL(`${root}/assets/apple-touch-icon.png`,window.location.href).href;
  document.querySelectorAll('link[rel~="icon"]').forEach(link=>link.remove());
  const icon=document.createElement('link');
  icon.rel='icon';
  icon.type='image/png';
  icon.href=iconHref;
  document.head.appendChild(icon);
  if(body.dataset.ptcgShellReady==='1')return;
  body.dataset.ptcgShellReady='1';
  body.classList.add('ptcg-v2');
  const embedded=window.top!==window;
  if(embedded){
    body.classList.add('ptcg-embedded');
    body.style.setProperty('padding-bottom','0','important');
  }
  const active=body.dataset.appSection||'home';
  const labels={home:['⌂','Home'],meta:['◈','Meta'],decks:['▤','Decks'],compete:['◇','Compete'],tools:['⊕','Tools']};
  const hrefs={home:`${root}/`,meta:`${root}/apps/meta/`,decks:`${root}/apps/decklists/`,compete:`${root}/apps/events/`,tools:`${root}/apps/tools/`};
  if(!embedded&&!document.querySelector('.app-bottom-nav')){
    const nav=document.createElement('nav');
    nav.className='app-bottom-nav';
    nav.setAttribute('aria-label','PTCG Tools');
    nav.innerHTML=Object.entries(labels).map(([key,[navIcon,label]])=>`<a class="app-nav-item" href="${hrefs[key]}" ${key===active?'aria-current="page"':''}><span class="app-nav-icon" aria-hidden="true">${navIcon}</span><span>${label}</span></a>`).join('');
    document.body.appendChild(nav);
  }

  function registerServiceWorker(){
    if(!('serviceWorker' in navigator))return;
    const swUrl=new URL(`${root}/sw.js`,window.location.href);
    navigator.serviceWorker.register(swUrl.href,{scope:new URL(`${root}/`,window.location.href).pathname}).catch(error=>console.warn('PTCG app cache unavailable',error));
  }
  function addStyle(path,key){
    const selector=`link[data-ptcg-style="${key}"]`;
    if(document.querySelector(selector))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=new URL(`${root}/${path}`,location.href).href;
    link.dataset.ptcgStyle=key;
    document.head.appendChild(link);
  }
  function addScript(path,key,onload){
    const selector=`script[data-ptcg-loader="${key}"]`;
    let existing=document.querySelector(selector);
    if(!existing&&key==='formatRuntime')existing=document.querySelector('script[data-format-runtime]');
    if(existing){
      if(onload){
        if(key==='formatRuntime'&&window.PTCGFormatRuntime)queueMicrotask(onload);
        else existing.addEventListener('load',onload,{once:true});
      }
      return existing;
    }
    const script=document.createElement('script');
    script.src=new URL(`${root}/${path}`,location.href).href;
    script.async=false;
    script.dataset.ptcgLoader=key;
    if(key==='formatRuntime')script.dataset.formatRuntime='1';
    if(onload)script.addEventListener('load',onload,{once:true});
    document.head.appendChild(script);
    return script;
  }
  function withFormatRuntime(callback){if(window.PTCGFormatRuntime){callback?.();return}addScript('apps/_shared/format-runtime.js?v=1','formatRuntime',callback)}

  if(embedded){
    try{window.parent.postMessage({type:'ptcg:shell-ready',section:active},window.location.origin)}catch{}
  }

  if(active==='home')withFormatRuntime(()=>addScript('scripts/home-format-tools.js?v=1','homeFormatTools'));
  if(active==='settings')withFormatRuntime(()=>{addStyle('apps/settings/format-admin.css?v=1','formatAdminStyle');addScript('apps/settings/format-admin.js?v=1','formatAdmin')});
  if(active==='compete'&&document.getElementById('eventMeta'))withFormatRuntime(()=>{addScript('apps/events/event-format-context.js?v=2','eventFormatContext');addScript('apps/events/prep-format-guard.js?v=1','prepFormatGuard')});

  // Authentication and cloud reconciliation are owned by the persistent
  // top-level shell. Child feature views must never start their own sync loop.
  registerServiceWorker();
})();