(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let names=[];

  function pokemonSlug(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    const lower=raw.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
    const special={
      'green ogerpon':'ogerpon','teal mask ogerpon':'ogerpon','ogerpon teal mask':'ogerpon',
      'mega excadrill':'excadrill-mega','mega lucario':'lucario-mega','mega greninja':'greninja-mega',
      'mega chandelure':'chandelure-mega','mega venusaur':'venusaur-mega'
    };
    return special[lower]||lower.replace(/\s+/g,'-');
  }

  function collectFromData(data,set){
    (data?.tournaments||[]).forEach(event=>(event?.archetypes||[]).forEach(a=>{if(a?.name)set.add(a.name)}));
    Object.values(data?.matchupScopes||{}).forEach(scope=>{
      (scope?.decks||[]).forEach(d=>{if(d?.name)set.add(d.name)});
      (scope?.matchups||[]).forEach(m=>{if(m?.a)set.add(m.a);if(m?.b)set.add(m.b)});
    });
    (data?.decks||[]).forEach(d=>{if(d?.name)set.add(d.name)});
    (data?.events||[]).forEach(event=>{
      (event?.decks||event?.archetypes||[]).forEach(d=>{if(d?.name)set.add(d.name)});
      (event?.standings||[]).forEach(r=>{if(r?.archetype)set.add(r.archetype)});
    });
  }

  async function loadNames(){
    const set=new Set(Object.keys(window.DeckSprites?.defaults||{}));
    const urls=['../../data/meta/current-field.json','../../data/meta/irl/TEF-PBL.json'];
    await Promise.all(urls.map(async url=>{try{const r=await fetch(url,{cache:'no-store'});if(r.ok)collectFromData(await r.json(),set)}catch(_){}}));
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
    const filtered=q?names.filter(n=>n.toLowerCase().includes(q)):names;
    $('deckIconList').innerHTML=filtered.length?filtered.map(rowHtml).join(''):'<div class="settings-empty">No decks match this search.</div>';
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

  $('deckIconSearch')?.addEventListener('input',render);
  loadNames().then(render);
})();