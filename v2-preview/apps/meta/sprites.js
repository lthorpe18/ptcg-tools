(() => {
  'use strict';

  // Compatibility bridge for cached/older entrypoints only.
  // The one app-wide implementation now lives in ../_shared/deck-sprites.js.
  if (window.DeckSprites) return;
  const current = document.currentScript?.src || location.href;
  const shared = new URL('../_shared/deck-sprites.js?v=1', current).href;
  document.write(`<script src="${shared}"><\/script>`);
})();
