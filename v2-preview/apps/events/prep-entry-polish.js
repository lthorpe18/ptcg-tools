(() => {
  'use strict';

  function participationFor(card) {
    const id = card?.dataset?.eventId;
    if (!id || !window.PTCGStorage) return null;
    const direct = window.PTCGStorage.getParticipation?.(id);
    if (direct) return direct;
    const rows = window.PTCGStorage.load?.().eventParticipations || [];
    return rows.find(row => row?.eventId === id || row?.eventSnapshot?.id === id || `${row?.source || ''}:${row?.sourceId || ''}` === id) || null;
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement) || !card.classList.contains('event-card')) return;
    const participation = participationFor(card);
    const attending = participation?.attendanceStatus === 'attending';
    const actions = card.querySelector('.event-actions');
    if (!actions) return;

    let link = actions.querySelector('[data-prep-link]');
    if (!attending) {
      link?.remove();
      actions.classList.remove('has-prep');
      return;
    }

    if (!link) {
      link = document.createElement('a');
      link.dataset.prepLink = 'true';
      const more = actions.querySelector('.more-button');
      actions.insertBefore(link, more || null);
    }
    link.className = 'primary-link prep-entry-link prep-entry-prominent';
    link.href = `./prep.html?participation=${encodeURIComponent(participation.id)}`;
    link.textContent = 'Event Prep';
    link.setAttribute('aria-label', `Open Event Prep for ${card.querySelector('h2')?.textContent?.trim() || 'this event'}`);
    actions.classList.add('has-prep');
  }

  function enhanceAll() {
    document.querySelectorAll('.event-card').forEach(enhanceCard);
  }

  const style = document.createElement('style');
  style.textContent = '.prep-entry-prominent{font-weight:800!important;padding-inline:12px!important;border-radius:10px!important;background:#155eef!important;color:#fff!important;border-color:#155eef!important}.event-actions.has-prep .prep-entry-prominent{order:-1}';
  document.head.appendChild(style);

  new MutationObserver(() => requestAnimationFrame(enhanceAll)).observe(document.body, { childList:true, subtree:true });
  window.addEventListener('ptcg:local-change', () => requestAnimationFrame(enhanceAll));
  window.addEventListener('storage', () => requestAnimationFrame(enhanceAll));
  window.addEventListener('pageshow', enhanceAll);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(enhanceAll, 0), { once:true });
  else setTimeout(enhanceAll, 0);
})();