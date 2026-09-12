(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let feed = null, pending = null, active = false, timer = null;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = new Intl.DateTimeFormat(undefined, { timeZone:'Europe/London', weekday:'short', day:'numeric', month:'short', year:'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { timeZone:'Europe/London', hourCycle:'h23', hour:'2-digit', minute:'2-digit' });

  function validate(data) {
    if (data?.schemaVersion !== 1 || data.source?.provider !== 'limitless' || !Number.isFinite(Date.parse(data.generatedAt)) || !Array.isArray(data.events)) throw new Error('Invalid feed');
    const ids = new Set();
    for (const e of data.events) {
      if (!e || typeof e.name !== 'string' || !e.name.trim() || !Number.isFinite(Date.parse(e.startAt)) ||
          !/^https:\/\/play\.limitlesstcg\.com\/tournament\/[a-z0-9]+(?:-[a-z0-9]+)*\/details$/.test(e.url) || !e.id || ids.has(e.id)) throw new Error('Invalid tournament');
      ids.add(e.id);
    }
    return data;
  }
  function formatGroup(e) {
    return /^Standard(?:$|[ (])/i.test(e.format || '') ? 'standard' : /^Expanded/i.test(e.format || '') ? 'expanded' : /GLC|Gym Leader Challenge/i.test(e.format || '') ? 'glc' : 'other';
  }
  function matches(e) {
    const clock = time.format(new Date(e.startAt));
    const from = $('onlineFrom').value, to = $('onlineTo').value;
    const inTime = $('onlineAllTimes').checked || !from || !to || (from <= to ? clock >= from && clock <= to : clock >= from || clock <= to);
    return inTime && ($('onlineFormat').value === 'all' || formatGroup(e) === $('onlineFormat').value) && ($('onlinePlatform').value === 'all' || e.platform === $('onlinePlatform').value);
  }
  function saveEvent(e) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(e.startAt)).map(p => [p.type,p.value]));
    return window.PTCGStorage.setEventStatus({...e, scope:'online', type:'Online Tournament', environment:'online', venue:'Online', officialUrl:e.url,
      startDate:`${parts.year}-${parts.month}-${parts.day}`, startTime:time.format(new Date(e.startAt))}, 'attending');
  }
  function render() {
    if (!active || !feed) return;
    const now = Date.now();
    const events = feed.events.filter(e => Date.parse(e.startAt) > now && matches(e)).sort((a,b) => Date.parse(a.startAt)-Date.parse(b.startAt));
    const age = Math.max(0, Math.floor((now-Date.parse(feed.generatedAt))/60000));
    $('onlineFreshness').textContent = `Updated ${age < 60 ? `${age} min` : age < 1440 ? `${Math.floor(age/60)} hr` : `${Math.floor(age/1440)} days`} ago${age > 360 ? ' · Updates may be delayed' : ''}`;
    $('onlineFreshness').title = new Date(feed.generatedAt).toLocaleString();
    $('onlineList').innerHTML = events.map(e => {
      const saved = window.PTCGStorage?.getParticipation?.(e.id);
      const attending = saved && saved.attendanceStatus !== 'skipped';
      return `<article class="online-card format-${formatGroup(e)}"><a href="${escape(e.url)}" target="_blank" rel="noopener noreferrer"><strong>${escape(e.name)}</strong></a><time datetime="${escape(e.startAt)}">${escape(date.format(new Date(e.startAt)))} · ${escape(time.format(new Date(e.startAt)))} UK</time><small>${escape(e.format || 'Unknown format')} · ${escape(e.platform || 'Unknown platform')}</small><div class="online-actions"><button type="button" data-attend="${escape(e.id)}" ${attending?'disabled':''}>${attending?'Attending ✓':"I’m attending"}</button>${attending?`<a href="./tournament-day.html?participation=${encodeURIComponent(saved.id)}">Record results</a>`:''}</div></article>`;
    }).join('');
    $('onlineState').textContent = events.length ? '' : 'No upcoming online tournaments match these filters.';
    clearTimeout(timer);
    if (events.length) timer = setTimeout(render, Math.min(60000, Math.max(1, Date.parse(events[0].startAt)-now)));
  }
  async function load() {
    if (pending) return pending;
    $('onlineState').textContent = 'Loading online tournaments…';
    $('onlineRetry').hidden = true;
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 15000);
    pending = (async () => {
      try {
        const response = await fetch(new URL('../../data/online-events.json', location.href), { signal:controller.signal, cache:'no-cache' });
        if (!response.ok) throw new Error('Unavailable');
        feed = validate(await response.json());
        render();
      } catch {
        $('onlineState').textContent = 'Online tournaments could not be loaded. Please try again.';
        $('onlineRetry').hidden = false;
      } finally { clearTimeout(deadline); pending = null; }
    })();
    return pending;
  }
  function select(show) {
    active = show;
    document.body.classList.toggle('show-online', show);
    $('onlinePanel').hidden = !show;
    clearTimeout(timer);
    if (show) { if (feed) render(); else load(); }
  }
  function bind() {
    const panel = document.createElement('section');
    panel.id = 'onlinePanel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Upcoming online tournaments');
    panel.innerHTML = '<div class="online-heading"><h2>Upcoming online tournaments</h2><small>UK time · GMT/BST automatically</small><small id="onlineFreshness"></small></div><div class="online-filters"><label>Format<select id="onlineFormat"><option value="standard">Standard</option><option value="glc">GLC</option><option value="expanded">Expanded</option><option value="all">All formats</option></select></label><label>Platform<select id="onlinePlatform"><option value="PTCGL">PTCGL</option><option value="all">All platforms</option></select></label><label>From<input id="onlineFrom" type="time" value="17:00"></label><label>To<input id="onlineTo" type="time" value="22:00"></label><label class="online-all"><input id="onlineAllTimes" type="checkbox"> All times</label></div><div id="onlineState" role="status"></div><button id="onlineRetry" type="button" hidden>Try again</button><div id="onlineList"></div>';
    document.querySelector('.event-view-tabs').insertAdjacentElement('afterend', panel);
    document.querySelector('.event-view-tabs').addEventListener('click', e => {
      const control = e.target.closest('button, a');
      if (control) select(control.dataset.view === 'online');
    });
    for (const id of ['onlineFormat','onlinePlatform','onlineFrom','onlineTo','onlineAllTimes']) $(id).addEventListener('change', render);
    $('onlineList').addEventListener('click', event => {
      const button = event.target.closest('[data-attend]');
      const item = feed?.events.find(e => e.id === button?.dataset.attend);
      if (!item) return;
      const row = saveEvent(item);
      if (row && !row.plannedDeckRef) window.PTCGStorage.updateParticipation(row.id, p => { p.plannedDeckRef = {}; return p; });
      render();
    });
    window.addEventListener('ptcg:local-change', render);
    $('onlineRetry').addEventListener('click', load);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && active) render(); });
    window.addEventListener('pageshow', () => { if (active) render(); });
    if (new URLSearchParams(location.search).get('view') === 'online') document.querySelector('[data-view="online"]').click();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true}); else bind();
})();
