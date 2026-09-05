(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let names=[];

  function pokemonSlug(value){return window.DeckSprites?.normalizeSlug?.(value)||''}

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

  function rowHtml(name){
    const overrides=window.DeckSprites?.overrides?.()||{};
    const custom=Array.isArray(overrides[name])&&overrides[name].length;
    const values=custom?overrides[name]:(window.DeckSprites?.defaults?.[name]||window.DeckSprites?.slugs?.(name)||[]);
    return `<article class="deck-icon-row" data-deck-name="${esc(name)}"><div class="deck-icon-preview">${window.DeckSprites?.html?.(name,{size:38})||''}</div><div class="deck-icon-main"><div class="deck-icon-title"><b>${esc(name)}</b><small>${custom?'Custom':'Default'}</small></div><div class="deck-icon-fields"><label>Pokémon 1<input data-icon-one value="${esc(values[0]||'')}" placeholder="e.g. ogerpon"></label><label>Pokémon 2 (optional)<input data-icon-two value="${esc(values[1]||'')}" placeholder="e.g. dudunsparce"></label></div><div class="deck-icon-actions"><button class="primary" type="button" data-save-icon>Save</button><button type="button" data-reset-icon>Reset default</button></div></div></article>`;
  }

  function render(){
    const q=($('deckIconSearch')?.value||'').trim().toLowerCase();
    const overrides=window.DeckSprites?.overrides?.()||{};
    const filtered=q?names.filter(n=>n.toLowerCase().includes(q)):names.filter(n=>Array.isArray(overrides[n])&&overrides[n].length);
    $('deckIconList').innerHTML=filtered.length?filtered.map(rowHtml).join(''):`<div class="settings-empty">${q?'No archetypes match this search.':'No custom deck icons yet. Search for an archetype to customise its icon.'}</div>`;
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
