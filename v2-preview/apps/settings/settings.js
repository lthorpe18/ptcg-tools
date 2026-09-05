(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  let names=[];

  function pokemonSlug(value){return window.DeckSprites?.normalizeSlug?.(value)||''}
  function spriteOptions(){return window.DeckSprites?.knownSlugs?.()||[]}

  function collectFromData(data,set){
    (data?.tournaments||[]).forEach(event=>(event?.archetypes||[]).forEach(a=>{if(a?.name)set.add(a.name)}));
    Object.values(data?.matchupScopes||{}).forEach(scope=>{
      (scope?.decks||[]).forEach(d=>{if(d?.name)set.add(d.name)});
      (scope?.matchups||[]).forEach(m=>{if(m?.a)set.add(m.a);if(m?.b)set.add(m.b)});
    });
    Object.values(data?.scopes||{}).forEach(scope=>(scope?.decks||[]).forEach(d=>{if(d?.name)set.add(d.name)}));
    (data?.decks||[]).forEach(d=>{if(d?.name)set.add(d.name)});
    (data?.events||[]).forEach(event=>{
      (event?.decks||event?.archetypes||[]).forEach(d=>{if(d?.name)set.add(d.name)});
      (event?.standings||[]).forEach(r=>{if(r?.archetype)set.add(r.archetype)});
    });
  }

  async function loadNames(){
    const set=new Set(Object.keys(window.DeckSprites?.defaults||{}));
    try{
      const base=new URL('../../data/meta/release/',location.href);
      const manifestResponse=await fetch(new URL('manifest.json',base),{cache:'no-store'});
      if(manifestResponse.ok){
        const manifest=await manifestResponse.json();
        const coreUrl=new URL(manifest.files.core.path,base);coreUrl.searchParams.set('release',manifest.release);
        const coreResponse=await fetch(coreUrl);
        if(coreResponse.ok)collectFromData(await coreResponse.json(),set);
      }
    }catch(_){}
    names=[...set].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }

  function inputHtml(attr,value,placeholder){
    return `<div class="sprite-input-wrap"><input ${attr} value="${esc(value||'')}" placeholder="${esc(placeholder)}" autocomplete="off"><span class="sprite-field-preview" data-icon-preview aria-hidden="true"></span><div class="sprite-suggestions" data-icon-suggestions hidden></div></div>`;
  }

  function rowHtml(name){
    const overrides=window.DeckSprites?.overrides?.()||{};
    const custom=Array.isArray(overrides[name])&&overrides[name].length;
    const values=custom?overrides[name]:(window.DeckSprites?.defaults?.[name]||window.DeckSprites?.slugs?.(name)||[]);
    return `<article class="deck-icon-row" data-deck-name="${esc(name)}"><div class="deck-icon-preview">${window.DeckSprites?.html?.(name,{size:38})||''}</div><div class="deck-icon-main"><div class="deck-icon-title"><b>${esc(name)}</b><small>${custom?'Custom':'Default'}</small></div><div class="deck-icon-fields"><label>Pokémon 1${inputHtml('data-icon-one',values[0],'e.g. ogerpon')}</label><label>Pokémon 2 (optional)${inputHtml('data-icon-two',values[1],'e.g. dudunsparce')}</label></div><div class="deck-icon-actions"><button class="primary" type="button" data-save-icon>Save</button><button type="button" data-reset-icon>Reset default</button></div></div></article>`;
  }

  function previewFor(input,slug){
    const wrap=input?.closest('.sprite-input-wrap');
    const preview=wrap?.querySelector('[data-icon-preview]');
    if(!preview)return;
    preview.innerHTML=slug?`<img src="${esc(window.DeckSprites?.url?.(slug)||'')}" alt="" onerror="this.style.display='none'">`:'';
  }

  function matchingSlugs(value){
    const q=pokemonSlug(value);
    if(!q)return [];
    return spriteOptions().filter(slug=>slug.startsWith(q)).concat(spriteOptions().filter(slug=>!slug.startsWith(q)&&slug.includes(q))).slice(0,5);
  }

  function updateSpriteField(input){
    const wrap=input?.closest('.sprite-input-wrap');
    const suggestions=wrap?.querySelector('[data-icon-suggestions]');
    if(!wrap||!suggestions)return;
    const matches=matchingSlugs(input.value);
    const exact=pokemonSlug(input.value);
    const previewSlug=matches[0]||exact;
    previewFor(input,previewSlug);
    suggestions.innerHTML=matches.map(slug=>`<button type="button" data-sprite-choice="${esc(slug)}"><img src="${esc(window.DeckSprites?.url?.(slug)||'')}" alt=""><span>${esc(slug.replace(/-/g,' '))}</span></button>`).join('');
    suggestions.hidden=!matches.length||document.activeElement!==input;
  }

  function bindSpriteFields(){
    document.querySelectorAll('[data-icon-one],[data-icon-two]').forEach(input=>{
      updateSpriteField(input);
      input.addEventListener('focus',()=>updateSpriteField(input));
      input.addEventListener('input',()=>updateSpriteField(input));
      input.addEventListener('blur',()=>setTimeout(()=>{const box=input.closest('.sprite-input-wrap')?.querySelector('[data-icon-suggestions]');if(box)box.hidden=true;},120));
    });
    document.querySelectorAll('[data-sprite-choice]').forEach(button=>button.addEventListener('pointerdown',event=>{
      event.preventDefault();
      const input=button.closest('.sprite-input-wrap')?.querySelector('input');
      if(!input)return;
      input.value=button.dataset.spriteChoice||'';
      updateSpriteField(input);
      input.focus();
    }));
  }

  function render(){
    const q=($('deckIconSearch')?.value||'').trim().toLowerCase();
    const overrides=window.DeckSprites?.overrides?.()||{};
    const filtered=q?names.filter(n=>n.toLowerCase().includes(q)):names.filter(n=>Array.isArray(overrides[n])&&overrides[n].length);
    $('deckIconList').innerHTML=filtered.length?filtered.map(rowHtml).join(''):`<div class="settings-empty">${q?'No archetypes match this search.':'No custom deck icons yet. Search for an archetype to customise its icon.'}</div>`;
    bindSpriteFields();
    document.querySelectorAll('[data-save-icon]').forEach(btn=>btn.addEventListener('click',()=>{
      const row=btn.closest('.deck-icon-row'); const name=row?.dataset.deckName;if(!name)return;
      const first=pokemonSlug(row.querySelector('[data-icon-one]')?.value);
      const second=pokemonSlug(row.querySelector('[data-icon-two]')?.value);
      window.DeckSprites?.setOverride?.(name,[first,second].filter(Boolean));
      render();
    }));
    document.querySelectorAll('[data-reset-icon]').forEach(btn=>btn.addEventListener('click',()=>{
      const name=btn.closest('.deck-icon-row')?.dataset.deckName;if(!name)return;
      window.DeckSprites?.clearOverride?.(name);render();
    }));
  }

  function formatTime(ms){
    if(!ms)return 'Not synced on this device yet';
    const date=new Date(ms);
    return `Last synced ${date.toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}`;
  }

  async function renderSyncStatus(){
    const statusEl=document.querySelector('[data-ptcg-sync-status]');
    const detailEl=document.querySelector('[data-ptcg-sync-detail]');
    if(!statusEl||!detailEl||!window.PTCGCloud)return;
    try{
      const status=await window.PTCGCloud.status();
      statusEl.classList.remove('is-pending','is-offline');
      if(!status.signedIn){statusEl.textContent='Local only';statusEl.classList.add('is-offline');detailEl.textContent='Sign in to sync across devices';return;}
      if(!status.online){statusEl.textContent='Offline';statusEl.classList.add('is-offline');detailEl.textContent=status.lastSyncAt?formatTime(status.lastSyncAt):'Changes will sync when you reconnect';return;}
      if(status.dirtyAt){statusEl.textContent='Syncing';statusEl.classList.add('is-pending');detailEl.textContent='Local changes are waiting to upload';return;}
      statusEl.textContent='Up to date';detailEl.textContent=formatTime(status.lastSyncAt);
    }catch(_){statusEl.textContent='Unavailable';statusEl.classList.add('is-offline');detailEl.textContent='Sync status could not be checked';}
  }

  async function exportAccountData(){
    const button=$('exportAccountData'),message=$('dataMessage');
    if(!button||!window.PTCGCloud)return;
    button.disabled=true;message.textContent='Preparing backup…';message.classList.remove('is-error');
    try{
      const snapshot=await window.PTCGCloud.localSnapshot();
      const payload={exportFormat:'ptcg-tools-account-backup',exportVersion:1,exportedAt:new Date().toISOString(),snapshot};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`ptcg-tools-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
      message.textContent='Backup exported. Keep the JSON file somewhere safe.';
    }catch(error){message.textContent=error?.message||'Could not export app data.';message.classList.add('is-error');}
    finally{button.disabled=false;}
  }

  $('deckIconSearch')?.addEventListener('input',render);
  $('exportAccountData')?.addEventListener('click',exportAccountData);
  ['ptcg:cloud-sync','ptcg:local-change','ptcg:auth-change'].forEach(name=>window.addEventListener(name,renderSyncStatus));
  window.addEventListener('storage',()=>{render();renderSyncStatus();});
  window.addEventListener('online',renderSyncStatus);window.addEventListener('offline',renderSyncStatus);
  loadNames().then(render);
  renderSyncStatus();
})();