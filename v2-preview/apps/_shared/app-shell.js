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
  const active=body.dataset.appSection||'home';
  const labels={home:['⌂','Home'],meta:['◈','Meta'],decks:['▤','Decks'],compete:['◇','Compete'],tools:['⊕','Tools']};
  const hrefs={home:`${root}/`,meta:`${root}/apps/meta/`,decks:`${root}/apps/decklists/`,compete:`${root}/apps/events/`,tools:`${root}/apps/tools/`};
  if(!document.querySelector('.app-bottom-nav')){
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

  function loadSharedSync(){
    if(window.PTCGSharedSync)return;
    const sharedSrc=`${root}/apps/_shared/shared-sync.js?v=1`;
    const startShared=()=>{
      if(window.PTCGSharedSync||document.querySelector('script[data-ptcg-shared-sync]'))return;
      const s=document.createElement('script');
      s.src=sharedSrc;
      s.dataset.ptcgSharedSync='1';
      document.body.appendChild(s);
    };
    if(window.PTCGCloud){startShared();return;}
    if(document.querySelector('script[data-ptcg-cloud-bootstrap]'))return;
    const cloud=document.createElement('script');
    cloud.src=`${root}/apps/_shared/cloud-sync.js?v=1`;
    cloud.dataset.ptcgCloudBootstrap='1';
    cloud.onload=startShared;
    document.body.appendChild(cloud);
  }
  registerServiceWorker();
  loadSharedSync();
})();
