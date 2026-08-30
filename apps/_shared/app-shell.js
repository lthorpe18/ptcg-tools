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
  if(!document.querySelector('.app-bottom-nav')){
    const nav=document.createElement('nav');
    nav.className='app-bottom-nav';
    nav.setAttribute('aria-label','PTCG Tools');
    nav.innerHTML=Object.entries(labels).map(([key,[icon,label]])=>`<a class="app-nav-item" href="${hrefs[key]}" ${key===active?'aria-current="page"':''}><span class="app-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('');
    document.body.appendChild(nav);
  }
})();
