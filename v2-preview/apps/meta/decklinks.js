(() => {
  function recordsUrl(name) {
    return window.MetaData?.recordsUrl?.(name) || '';
  }

  function ensureRecommendationStyles() {
    if (document.getElementById('recommendation-record-link-styles')) return;
    const style = document.createElement('style');
    style.id = 'recommendation-record-link-styles';
    style.textContent = `
      .rec-record-link{display:inline-flex;align-items:center;min-height:24px;padding:2px 7px;border:1px solid #dbe4ee;border-radius:999px;background:#fff;color:#155eef!important;font-size:9px!important;font-weight:800!important;text-decoration:none;line-height:1;white-space:nowrap;transition:.14s ease}
      .rec-record-link:hover,.rec-record-link:focus{border-color:#84adff;background:#f5f8ff;color:#004eeb!important;outline:none}
      .winner .rec-record-link{border-color:#a6f4c5;background:#f6fef9;color:#067647!important}
      @media(max-width:760px){.rec-record-link{min-height:28px;padding:4px 8px;font-size:10px!important}}
    `;
    document.head.appendChild(style);
  }

  function addRecommendationRecordLinks(root = document) {
    ensureRecommendationStyles();
    root.querySelectorAll?.('.recommendation-card').forEach(card => {
      if (card.dataset.recordsLinked === '1') return;
      const name = card.querySelector('.rec-main h3')?.textContent?.trim();
      const meta = card.querySelector('.rec-meta');
      const url = name ? recordsUrl(name) : '';
      if (!name || !meta || !url) return;
      const link = document.createElement('a');
      link.className = 'rec-record-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Records ↗';
      link.setAttribute('aria-label', `View ${name} records on Limitless`);
      meta.appendChild(link);
      card.dataset.recordsLinked = '1';
    });
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.recommendation-card')) addRecommendationRecordLinks(node.parentElement || document);
        else if (node.querySelector?.('.recommendation-card')) addRecommendationRecordLinks(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('meta:data-changed', () => addRecommendationRecordLinks());
  window.addEventListener('field:updated', () => requestAnimationFrame(() => addRecommendationRecordLinks()));
  addRecommendationRecordLinks();
})();
