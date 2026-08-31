(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let scope = 'latest-weekend';
  const rawGetData = window.IRLLabs?.getData?.bind(window.IRLLabs);
  if (!rawGetData) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validEvents = raw => [...(raw?.events || [])]
    .filter(e => Array.isArray(e.decks) && e.decks.length && Number.isFinite(new Date(e.date).getTime()))
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  function isoWeekKey(value) {
    const d = new Date(value);
    const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - day);
    const year = u.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year,0,1));
    const week = Math.ceil((((u - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2,'0')}`;
  }

  function options(raw = rawGetData()) {
    return [
      { value:'latest-weekend', label:'Latest IRL majors weekend' },
      { value:'all-irl', label:'All IRL majors this format' },
      ...validEvents(raw).map(e => ({ value:`event:${e.id}`, label:`${e.name || 'IRL tournament'} · ${new Date(e.date).toLocaleDateString([], {day:'numeric',month:'short'})}`, event:true }))
    ];
  }

  function selectedEvents(raw = rawGetData()) {
    const events = validEvents(raw);
    if (!events.length) return [];
    if (scope === 'all-irl') return events;
    if (scope.startsWith('event:')) return events.filter(e => String(e.id) === scope.slice(6));
    const latestWeek = isoWeekKey(events[0].date);
    return events.filter(e => isoWeekKey(e.date) === latestWeek);
  }

  function selectedDecks(raw = rawGetData()) {
    const map = new Map();
    for (const event of selectedEvents(raw)) for (const d of event.decks || []) {
      if (!d?.name || d.name === 'Other' || d.name === 'Unknown') continue;
      const row = map.get(d.name) || { name:d.name, entries:0, wins:0, losses:0, ties:0, url:d.url || '' };
      row.entries += Number(d.entries || 0);
      row.wins += Number(d.wins || 0);
      row.losses += Number(d.losses || 0);
      row.ties += Number(d.ties || 0);
      if (!row.url && d.url) row.url = d.url;
      map.set(d.name,row);
    }
    return [...map.values()].sort((a,b)=>b.entries-a.entries);
  }

  function selectedMatchups(raw = rawGetData()) {
    const map = new Map();
    let foundEventRows = false;
    for (const event of selectedEvents(raw)) for (const m of event.matchups || []) {
      if (!m?.a || !m?.b) continue;
      foundEventRows = true;
      const key = `${m.a}|||${m.b}`;
      const row = map.get(key) || { a:m.a, b:m.b, games:0, wins:0, losses:0, ties:0 };
      row.games += Number(m.games || 0);
      row.wins += Number(m.wins || 0);
      row.losses += Number(m.losses || 0);
      row.ties += Number(m.ties || 0);
      map.set(key,row);
    }
    if (foundEventRows) return [...map.values()];
    const rawEvents = validEvents(raw);
    if (scope === 'all-irl' || rawEvents.length === 1) return raw?.matchups || [];
    return [];
  }

  function setScope(value, syncLanding = true) {
    const allowed = new Set(options().map(x=>x.value));
    scope = allowed.has(value) ? value : 'latest-weekend';
    if (syncLanding && document.querySelector('[data-current-source="irl"]')?.classList.contains('active')) {
      const select = $('currentWindow');
      if (select && [...select.options].some(o=>o.value===scope) && select.value !== scope) {
        select.value = scope;
        select.dispatchEvent(new Event('change', { bubbles:true }));
      }
    }
    window.dispatchEvent(new CustomEvent('meta-irl-scope:changed', { detail:{ scope } }));
  }

  window.MetaIRLScope = { get:()=>scope, set:setScope, options, selectedEvents, selectedDecks, selectedMatchups, raw:rawGetData };
  window.IRLLabs.getRawData = rawGetData;
  window.IRLLabs.getData = () => {
    const raw = rawGetData() || { events:[], decks:[], matchups:[] };
    return { ...raw, events:raw.events || [], decks:selectedDecks(raw), matchups:selectedMatchups(raw), scope };
  };

  function optionHtml() {
    const opts=options();
    const base=opts.filter(x=>!x.event).map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    const events=opts.filter(x=>x.event).map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    return base + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
  }

  function ensureScopeControl(container,id) {
    if (!container) return null;
    let wrap=$(id+'Wrap');
    if (!wrap) {
      wrap=document.createElement('label');
      wrap.id=id+'Wrap'; wrap.className='meta-shared-scope';
      wrap.innerHTML=`<span>IRL scope</span><select id="${id}"></select>`;
      container.appendChild(wrap);
      $(id).addEventListener('change', e => setScope(e.currentTarget.value));
    }
    const select=$(id);
    const html=optionHtml();
    if (select.dataset.options !== html) { select.innerHTML=html; select.dataset.options=html; }
    select.value=scope;
    return wrap;
  }

  function syncUi() {
    document.querySelectorAll('#playFieldSource option[value="custom"],#fieldSource option[value="custom"]').forEach(o => o.textContent='Custom / saved meta');

    const matchupSource=$('matchupPageSource')?.value || 'online';
    const deckSource=$('deckPageSource')?.value || 'online';
    const fieldSource=$('playFieldSource')?.value || 'online';
    const playMatchups=$('playMatchupSource')?.value || 'online';

    const matchupScope=ensureScopeControl($('matchupPageSource')?.closest('.single-source-control'),'matchupIrlScope');
    if (matchupScope) matchupScope.hidden=matchupSource!=='irl';
    const deckScope=ensureScopeControl($('deckPageSource')?.closest('.single-source-control'),'deckIrlScope');
    if (deckScope) deckScope.hidden=deckSource!=='irl';

    let playWrap=$('playIrlScopeWrap');
    if (!playWrap) {
      playWrap=document.createElement('div'); playWrap.id='playIrlScopeWrap'; playWrap.className='play-shared-scope';
      $('playFieldSource')?.closest('.meta-child-header')?.appendChild(playWrap);
    }
    const needsIrl = fieldSource==='irl' || fieldSource==='blend' || playMatchups==='irl' || playMatchups==='combined';
    playWrap.hidden=!needsIrl;
    if (needsIrl) {
      playWrap.innerHTML=`<label><span>IRL scope</span><select id="playIrlScope">${optionHtml()}</select></label><small>Used by every IRL component of this analysis.</small>`;
      $('playIrlScope').value=scope;
      $('playIrlScope').addEventListener('change',e=>setScope(e.currentTarget.value));
    }

    let customNote=$('customFieldMeaning');
    if (!customNote) {
      customNote=document.createElement('p'); customNote.id='customFieldMeaning'; customNote.className='custom-field-meaning';
      $('playFieldSource')?.closest('.child-source-row')?.after(customNote);
    }
    customNote.hidden=fieldSource!=='custom';
    customNote.textContent='Custom is your editable field. Saved metas are named presets of this same field: load one below, or edit the field and save it as a preset.';

    document.querySelectorAll('.saved-meta-select span').forEach(el=>{ if (el.textContent !== 'Saved custom metas') el.textContent='Saved custom metas'; });
    document.querySelectorAll('#matchupIrlScope,#deckIrlScope').forEach(el=>el.value=scope);
  }

  const style=document.createElement('style');
  style.textContent='.meta-shared-scope,.play-shared-scope label{display:grid;gap:4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#667085}.meta-shared-scope{flex:1}.meta-shared-scope select,.play-shared-scope select{width:100%;min-width:0;min-height:42px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 10px;color:#101828;font:inherit;font-size:13px;font-weight:700}.play-shared-scope{display:grid;gap:4px}.play-shared-scope small,.custom-field-meaning{margin:0;color:#667085;font-size:10px;line-height:1.35}.custom-field-meaning{padding:8px 10px;border:1px solid #e4e7ec;border-radius:10px;background:#fff}.single-source-control{flex-wrap:wrap;min-width:0}.single-source-control>*{min-width:0}@media(max-width:600px){.single-source-control{display:grid!important;grid-template-columns:1fr}.meta-shared-scope,.play-shared-scope{width:100%}}';
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const summary=event.target.closest('.rec-why > summary,.check-details > summary,.full-calculation > summary');
    if (!summary) return;
    event.preventDefault(); event.stopPropagation();
    const details=summary.parentElement;
    if (details?.tagName === 'DETAILS') details.open=!details.open;
  }, true);

  $('currentWindow')?.addEventListener('change', e => {
    if (document.querySelector('[data-current-source="irl"]')?.classList.contains('active') && String(e.currentTarget.value).startsWith('event:') || ['latest-weekend','all-irl'].includes(e.currentTarget.value)) {
      if (['latest-weekend','all-irl'].includes(e.currentTarget.value) || String(e.currentTarget.value).startsWith('event:')) setScope(e.currentTarget.value,false);
    }
  });
  document.querySelector('[data-current-source="irl"]')?.addEventListener('click',()=>setScope('latest-weekend',false));
  ['matchupPageSource','deckPageSource','playFieldSource','playMatchupSource'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(syncUi,0)));
  window.addEventListener('irl:updated',()=>setTimeout(syncUi,0));
  window.addEventListener('meta-irl-scope:changed',()=>setTimeout(()=>{
    syncUi();
    window.dispatchEvent(new CustomEvent('irl:updated'));
  },0));

  const observer=new MutationObserver(()=>{
    document.querySelectorAll('.saved-meta-select span').forEach(el=>{ if (el.textContent !== 'Saved custom metas') el.textContent='Saved custom metas'; });
  });
  if ($('prep')) observer.observe($('prep'),{subtree:true,childList:true});
  setTimeout(syncUi,0);
})();
