const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function harness() {
  const base = 'https://example.test/ptcg-tools/v2-preview/';
  let location = new URL(base);
  const listeners = {};
  const historyCalls = [];
  const replacements = [];
  const frames = ['home', 'meta', 'tools'].map(section => {
    const child = { href: 'about:blank', replace(url) { replacements.push(url); this.href = url; } };
    const frame = {
      dataset: { section, src: section === 'home' ? './home-content.html' : `./apps/${section}/` },
      classList: { toggle() {} },
      contentWindow: { location: child, postMessage() {} },
      contentDocument: null,
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      getAttribute() { return this.src; },
      get src() { return this._src || 'about:blank'; },
      set src(value) { this._src = new URL(value, base).href; child.href = this._src; },
    };
    return frame;
  });
  const nav = frames.map(frame => ({
    dataset: { target: frame.dataset.section }, classList: { toggle() {} },
    setAttribute() {}, removeAttribute() {}, addEventListener(type, fn) { this.click = fn; },
  }));
  const window = { get location() { return location; }, addEventListener(type, fn) { listeners[type] = fn; } };
  const context = vm.createContext({
    URL, URLSearchParams, window, get location() { return location; },
    document: { querySelectorAll: selector => selector === '.shell-view' ? frames : nav, getElementById: () => null },
    history: Object.fromEntries(['pushState', 'replaceState'].map(mode => [mode, (state, title, url) => {
      location = new URL(url, base); historyCalls.push({ mode, state });
    }])),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../v2-preview/scripts/persistent-shell.js'), 'utf8'), context);
  const tools = frames.find(frame => frame.dataset.section === 'tools');
  const click = section => nav.find(item => item.dataset.target === section).click();
  click('tools');
  tools.listeners.load();
  return { tools, click, listeners, replacements, historyCalls };
}

test('returning to mounted Tools retains each latest tab without navigation', () => {
  const h = harness();
  for (const tab of ['odds', 'tournament', 'cut', 'odds', 'tournament']) {
    // Tools replaces its child URL without sending a shell navigation message.
    h.tools.contentWindow.location.href = `https://example.test/ptcg-tools/v2-preview/apps/tools/#${tab}`;
    h.click('meta');
    h.click('tools');
    assert.equal(new URL(h.historyCalls.at(-1).state.childUrl).hash, `#${tab}`);
    assert.equal(h.tools.contentWindow.location.href.endsWith(`#${tab}`), true);
  }
  assert.deepEqual(h.replacements, []);
});

test('an explicit history route still overrides the current Tools tab', () => {
  const h = harness();
  h.tools.contentWindow.location.href += '#tournament';
  const childUrl = 'https://example.test/ptcg-tools/v2-preview/apps/tools/#odds';
  const count = h.historyCalls.length;
  h.listeners.popstate({ state: { section: 'tools', childUrl } });
  assert.deepEqual(h.replacements, [childUrl]);
  assert.equal(h.historyCalls.length, count);
});
