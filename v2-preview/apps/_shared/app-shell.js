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

  // Authentication and cloud reconciliation are owned by the persistent
  // top-level shell. Child feature views must never start their own sync loop.
  registerServiceWorker();
})();
