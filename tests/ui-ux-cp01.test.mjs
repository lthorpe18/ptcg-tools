import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseRoute,
  legacyUrl,
  cleanState,
  destinations,
} from "../v3-preview/shared/routes.mjs";
import { attachArtwork } from "../v3-preview/shared/artwork.mjs";
import { cards } from "../v3-preview/fixtures.mjs";
test("registry allows only exact routes, rejects injected URLs and future Collection", () => {
  for (const item of destinations)
    assert.equal(parseRoute("#/" + item.id).kind, "legacy");
  for (const bad of [
    "#/collection",
    "#/decks?id=1",
    "#//evil.example",
    "#/../../meta",
    "#/%73pecimen",
  ])
    assert.equal(parseRoute(bad).kind, "invalid");
  assert.equal(parseRoute("").id, "specimen");
  assert.equal(parseRoute("#/specimen/states").id, "states");
});
test("legacy routes preserve repository subpath and use V2 shell contracts", () => {
  const base =
    "https://example.test/ptcg-tools/v3-preview/index.html#/specimen";
  assert.equal(
    legacyUrl("meta", base),
    "https://example.test/ptcg-tools/v2-preview/?section=meta",
  );
  assert.equal(
    legacyUrl("utilities", base),
    "https://example.test/ptcg-tools/v2-preview/?section=tools",
  );
  assert.equal(
    legacyUrl("settings", base),
    "https://example.test/ptcg-tools/v2-preview/apps/settings/",
  );
  assert.equal(legacyUrl("unknown", base), null);
});
test("history state accepts presentation fields only", () => {
  assert.deepEqual(
    cleanState({
      view: "gallery",
      filter: "Energy",
      scroll: 800,
      details: ["example", 5],
      deckId: "do not persist",
    }),
    {
      v3: true,
      view: "gallery",
      filter: "Energy",
      scroll: 800,
      details: ["example"],
    },
  );
  assert.equal(cleanState(null).view, "list");
  assert.equal(cleanState({ scroll: Infinity }).scroll, 0);
  assert.equal(cleanState(null).details, null);
  assert.equal(cleanState({ scroll: -4, view: "x", filter: "x" }).scroll, 0);
});
test("fixture is complete and isolated from current legality claims", () => {
  assert.equal(
    cards.reduce((n, c) => n + c.quantity, 0),
    60,
  );
  assert.ok(cards.length > 20);
});
function host() {
  return {
    dataset: {},
    style: { setProperty() {} },
    querySelector() {
      return null;
    },
    append(node) {
      this.image = node;
    },
  };
}
globalThis.document = {
  createElement() {
    return {
      remove() {
        this.removed = true;
      },
    };
  },
};
test("art adapter uses resolver ordering, retains identity and stabilises exhausted fallback", async () => {
  const card = Object.freeze({ name: "Exact card", set: "TEF", number: "208" }),
    node = host();
  let seen;
  await attachArtwork(node, card, {
    api: {
      resolve: async (input) => {
        seen = input;
        return { candidates: ["canonical-first", "canonical-second"] };
      },
    },
  });
  assert.equal(seen, card);
  assert.equal(node.image.src, "canonical-first");
  node.image.onerror();
  assert.equal(node.image.src, "canonical-second");
  node.image.onerror();
  assert.equal(node.dataset.art, "missing");
  assert.ok(node.image.removed);
});
test("late artwork resolution cannot replace newer representative selection", async () => {
  const node = host();
  let resolve;
  const first = attachArtwork(
    node,
    {},
    { api: { resolve: () => new Promise((r) => (resolve = r)) } },
  );
  await attachArtwork(
    node,
    {},
    { api: { resolve: async () => ({ candidates: ["new"] }) } },
  );
  resolve({ candidates: ["old"] });
  await first;
  assert.equal(node.image.src, "new");
});
test("missing or rejected artwork resolves to reserved fallback", async () => {
  for (const api of [
    { resolve: async () => ({ candidates: [] }) },
    {
      resolve: async () => {
        throw Error("offline");
      },
    },
  ]) {
    const node = host();
    await attachArtwork(node, {}, { api });
    assert.equal(node.dataset.art, "missing");
  }
});
test("art replacement cannot remove canonical fallback sprite images", async () => {
  const node = host();
  let selector;
  node.querySelector = (value) => {
    selector = value;
    return null;
  };
  await attachArtwork(
    node,
    {},
    { api: { resolve: async () => ({ candidates: [] }) } },
  );
  assert.equal(selector, ":scope > .art-image");
});
test("preview entry imports canonical providers and no sync, worker or embedded shell", () => {
  const html = fs.readFileSync(
    new URL("../v3-preview/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /v2-preview\/apps\/_shared\/card-images.js/);
  assert.match(html, /v2-preview\/apps\/_shared\/deck-sprites.js/);
  assert.doesNotMatch(html, /iframe|serviceWorker|account-sync|manifest/i);
});
