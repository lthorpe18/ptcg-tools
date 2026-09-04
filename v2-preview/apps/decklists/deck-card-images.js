(function(){
  'use strict';

  const images=window.PTCGCardImages,parser=window.PTCGDeckParser,store=window.PTCGDeckStore;
  if(!images||!parser||!store)return;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const sections=[['pokemon','Pokémon'],['trainers','Trainers'],['energy','Energy'],['unknown','Other']];
  let scheduled=false;

  function enhanceWorkingList(){
    const root=$('parsedPreview'),text=$('deckText');
    if(!root||!text)return;
    const parsed=parser.parseDeck(text.value||'');
    for(const [key] of sections){
      const section=root.querySelector(`.parsed-section.${key}`),cards=parsed.sections[key]||[];
      if(!section)continue;
      [...section.querySelectorAll(':scope > .parsed-card')].forEach((row,index)=>{
        const card=cards[index];
        if(!card||row.classList.contains('has-card-image'))return;
        row.classList.add('has-card-image');
        row.insertAdjacentHTML('afterbegin',images.thumbnailMarkup(card,{loading:'lazy'}));
      });
    }
  }

  function readOnlyListMarkup(rawText){
    const parsed=parser.parseDeck(rawText||'');
    const visible=sections.filter(([key])=>parsed.sections[key]?.length);
    if(!visible.length)return '<div class="app-empty">No cards in this saved version.</div>';
    return `<div class="parsed-preview">${visible.map(([key,label])=>`
      <section class="parsed-section ${key}"><h3><span>${label}</span><span>${parsed.totals[key]||0}</span></h3>
        ${parsed.sections[key].map(card=>{
          const print=images.printLabel(card);
          return `<div class="parsed-card has-card-image">${images.thumbnailMarkup(card,{loading:'lazy'})}<span class="readonly-card-qty">${Number(card.count)||0}×</span><span class="readonly-card-copy"><b>${esc(card.name)}</b>${print?`<small>${esc(print)}</small>`:''}</span></div>`;
        }).join('')}
      </section>`).join('')}</div>`;
  }

  function enhanceVersionRows(){
    const root=$('versionList');
    if(!root)return;
    root.classList.add('enhanced');
    root.querySelectorAll('.version-row').forEach(row=>{
      const load=row.querySelector('[data-load-version]');
      if(!load||row.querySelector('[data-view-version]'))return;
      const versionId=load.dataset.loadVersion;
      const actions=document.createElement('span');
      actions.className='version-row-actions';
      load.parentNode.insertBefore(actions,load);
      actions.appendChild(load);
      const view=document.createElement('button');
      view.type='button';
      view.dataset.viewVersion=versionId;
      view.textContent='View list';
      view.setAttribute('aria-expanded','false');
      actions.appendChild(view);
    });
  }

  async function toggleVersion(versionId,button){
    const root=$('versionList');
    if(!root)return;
    const existing=root.querySelector(`.version-exact-list[data-version-panel="${CSS.escape(versionId)}"]`);
    if(existing){
      const next=existing.hidden=!existing.hidden;
      button.setAttribute('aria-expanded',String(!next));
      button.textContent=next?'View list':'Hide list';
      return;
    }
    const decks=await store.all(),deck=decks.find(item=>(item.versions||[]).some(version=>version.id===versionId));
    const version=deck?.versions?.find(item=>item.id===versionId);
    if(!version)return;
    const row=button.closest('.version-row');
    if(!row)return;
    const panel=document.createElement('section');
    panel.className='version-exact-list';
    panel.dataset.versionPanel=versionId;
    panel.innerHTML=`<div class="version-exact-list-head"><b>${esc(version.label||'Saved version')}${version.name?` · ${esc(version.name)}`:''}</b><span>${parser.parseDeck(version.rawText||'').totalCards} cards</span></div>${readOnlyListMarkup(version.rawText)}`;
    row.insertAdjacentElement('afterend',panel);
    button.setAttribute('aria-expanded','true');
    button.textContent='Hide list';
  }

  function enhance(){
    scheduled=false;
    enhanceWorkingList();
    enhanceVersionRows();
  }
  function queueEnhance(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(enhance);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-view-version]');
    if(button)toggleVersion(button.dataset.viewVersion,button);
  });
  images.bindFallback(document);
  [$('parsedPreview'),$('versionList')].filter(Boolean).forEach(root=>new MutationObserver(queueEnhance).observe(root,{childList:true,subtree:true}));
  enhance();
})();

(function loadCardSearch(){
  'use strict';
  if(document.querySelector('script[data-ptcg-card-search-loader]'))return;
  const style=document.createElement('link');
  style.rel='stylesheet';
  style.href='deck-card-search.css?v=2';
  document.head.appendChild(style);
  const catalog=document.createElement('script');
  catalog.src='../_shared/card-catalog.js?v=2';
  catalog.dataset.ptcgCardSearchLoader='true';
  catalog.onload=()=>{
    const ui=document.createElement('script');
    ui.src='deck-card-search.js?v=2';
    ui.dataset.ptcgCardSearchLoader='true';
    document.body.appendChild(ui);
  };
  document.body.appendChild(catalog);
})();
