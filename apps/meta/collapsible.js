(() => {
  const mobile = () => window.matchMedia('(max-width: 760px)').matches;

  const selectors = [
    '.controls.panel',
    '.prep-hero.panel',
    '.field-builder-panel',
    '.prep-results-panel',
    '.prep-inspect-panel',
    '#comparisonPanel',
    '#overview > .panel',
    '#matchups .panel',
    '#archetype > .panel',
    '.trendpanel',
    '.detailpanel',
    '.note.panel',
    '.prep-callout',
    '.prep-field'
  ].join(',');

  function titleFor(el) {
    if (el.classList.contains('field-builder-panel')) return 'Field settings';
    if (el.classList.contains('controls')) return 'Meta filters';
    if (el.classList.contains('prep-callout')) return 'Top pick';
    if (el.classList.contains('prep-field')) return 'Your expected field';
    const heading = el.querySelector('h1,h2,h3');
    if (heading?.textContent?.trim()) return heading.textContent.trim();
    const strong = el.querySelector(':scope > strong');
    if (strong?.textContent?.trim()) return strong.textContent.trim().replace(/:$/, '');
    return 'Section';
  }

  function shouldStartCollapsed(el) {
    if (el.classList.contains('field-builder-panel')) return true;
    if (!mobile()) return false;
    return el.matches('.controls.panel,.prep-hero.panel,.prep-inspect-panel,#comparisonPanel,.trendpanel,.detailpanel,.note.panel');
  }

  function enhance(el) {
    if (!(el instanceof HTMLElement) || el.dataset.collapsibleReady === '1') return;
    el.dataset.collapsibleReady = '1';
    el.classList.add('collapsible-card');
    const label = titleFor(el);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'collapse-toggle';
    button.setAttribute('aria-expanded', 'true');
    button.innerHTML = `<span>${label}</span><b aria-hidden="true">−</b>`;
    el.prepend(button);

    const setCollapsed = collapsed => {
      el.classList.toggle('is-collapsed', collapsed);
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      button.querySelector('b').textContent = collapsed ? '+' : '−';
      button.classList.toggle('collapsed-label', collapsed);
    };
    button.addEventListener('click', () => setCollapsed(!el.classList.contains('is-collapsed')));
    setCollapsed(shouldStartCollapsed(el));
  }

  function scan(root = document) {
    root.querySelectorAll?.(selectors).forEach(enhance);
  }

  scan();
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.(selectors)) enhance(node);
        scan(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
