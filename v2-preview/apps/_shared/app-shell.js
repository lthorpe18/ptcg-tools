(function(){
  'use strict';
  const body=document.body;
  if(!body||body.dataset.ptcgShellReady==='1')return;
  body.dataset.ptcgShellReady='1';
  body.classList.add('ptcg-v2');
  const root=(body.dataset.appRoot||'.').replace(/\/$/,'');
  const active=body.dataset.appSection||'home';
  const labels={home:['⌂','Home'],meta:['◈','Meta'],decks:['▤','Decks'],compete:['◇','Compete'],tools:['⊕','Tools']};
  const hrefs={home:`${root}/`,meta:`${root}/apps/meta/`,decks:`${root}/apps/decklists/`,compete:`${root}/apps/events/`,tools:`${root}/apps/tools/`};
  if(!document.querySelector('link[rel~="icon"]')){
    const icon=document.createElement('link');
    icon.rel='icon';
    icon.type='image/png';
    icon.href=`${root}/assets/apple-touch-icon.png`;
    document.head.appendChild(icon);
  }
  if(!document.querySelector('.app-bottom-nav')){
    const nav=document.createElement('nav');
    nav.className='app-bottom-nav';
    nav.setAttribute('aria-label','PTCG Tools');
    nav.innerHTML=Object.entries(labels).map(([key,[icon,label]])=>`<a class="app-nav-item" href="${hrefs[key]}" ${key===active?'aria-current="page"':''}><span class="app-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('');
    document.body.appendChild(nav);
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
  loadSharedSync();
})();
