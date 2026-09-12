(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let feed = null, pending = null, active = false, timer = null;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = new Intl.DateTimeFormat(undefined, { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  const time = new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit' });

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
  function render() {
    if (!active || !feed) return;
    const now = Date.now();
    const events = feed.events.filter(e => Date.parse(e.startAt) > now).sort((a,b) => Date.parse(a.startAt)-Date.parse(b.startAt));
    const age = Math.max(0, Math.floor((now-Date.parse(feed.generatedAt))/60000));
    $('onlineFreshness').textContent = `Updated ${age < 60 ? `${age} min` : age < 1440 ? `${Math.floor(age/60)} hr` : `${Math.floor(age/1440)} days`} ago${age > 360 ? ' · Updates may be delayed' : ''}`;
    $('onlineFreshness').title = new Date(feed.generatedAt).toLocaleString();
    $('onlineList').innerHTML = events.map(e => `<a class="online-card" href="${escape(e.url)}" target="_blank" rel="noopener noreferrer"><strong>${escape(e.name)}</strong><time datetime="${escape(e.startAt)}">${escape(date.format(new Date(e.startAt)))} · ${escape(time.format(new Date(e.startAt)))}</time></a>`).join('');
    $('onlineState').textContent = events.length ? '' : 'No upcoming online tournaments listed.';
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
    panel.innerHTML = '<div class="online-heading"><h2>Upcoming online tournaments</h2><small>Times shown in your local timezone</small><small id="onlineFreshness"></small></div><div id="onlineState" role="status"></div><button id="onlineRetry" type="button" hidden>Try again</button><div id="onlineList"></div>';
    document.querySelector('.event-view-tabs').insertAdjacentElement('afterend', panel);
    document.querySelector('.event-view-tabs').addEventListener('click', e => {
      const control = e.target.closest('button, a');
      if (control) select(control.dataset.view === 'online');
    });
    $('onlineRetry').addEventListener('click', load);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && active) render(); });
    window.addEventListener('pageshow', () => { if (active) render(); });
    if (new URLSearchParams(location.search).get('view') === 'online') document.querySelector('[data-view="online"]').click();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true}); else bind();
})();
