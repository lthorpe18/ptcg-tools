// Hand / Outs Calculator
// Reads decklists from Decklist Manager via IndexedDB:
// DB: "ptcg-tools-db" store: "decks" objects: { id, name, rawText, ... }

const DB_NAME = "ptcg-tools-db";
const DB_VERSION = 2; // ok if higher than actual; IDB will just open at current version
const STORE_DECKS = "decks";

let db = null;

let currentDeck = null;      // {id, name, rawText}
let currentCards = [];       // [{name, count}]
let selectedCardName = null; // string

const $ = (id) => document.getElementById(id);

const deckSelectEl = $("deckSelect");
const btnRefreshEl = $("btnRefresh");
const cardSearchEl = $("cardSearch");
const handSizeEl = $("handSize");
const deckSizeEl = $("deckSize");

const cardsListEl = $("cardsList");
const deckMetaEl = $("deckMeta");
const selMetaEl = $("selMeta");

const emptyStateEl = $("emptyState");
const statsEl = $("stats");

const copiesEl = $("copies");
const pAtLeast1El = $("pAtLeast1");
const p0El = $("p0");
const expEl = $("exp");
const distEl = $("dist");

const toastEl = $("toast");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function getAllDecks() {
  return new Promise((resolve, reject) => {
    try {
      const store = tx(STORE_DECKS, "readonly");
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    } catch (e) {
      // store may not exist yet
      resolve([]);
    }
  });
}

async function getDeck(id) {
  return new Promise((resolve, reject) => {
    try {
      const store = tx(STORE_DECKS, "readonly");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    } catch (e) {
      resolve(null);
    }
  });
}

// --- Decklist parsing (PTCGL or Limitless-ish) ---
// Supports:
// 4 Card Name (SET 123)
// 4 Card Name SET 123
// ignores headers like Pokémon:, Trainer:, Energy:
const RE_PTCGL = /^(\d+)\s+(.+?)\s+\(([\w-]+)\s+([0-9]+[a-zA-Z]?)\)\s*$/;
const RE_LIMITLESS = /^(\d+)\s+(.+?)\s+([\w-]+)\s+([0-9]+[a-zA-Z]?)\s*$/;

function isHeaderLine(line) {
  const s = line.trim();
  if (!s) return true;
  const low = s.toLowerCase();
  return (
    low === "pokémon:" ||
    low === "pokemon:" ||
    low === "trainer:" ||
    low === "trainers:" ||
    low === "energy:" ||
    low.startsWith("total cards")
  );
}

function parseDeckToCardCounts(rawText) {
  const lines = String(rawText || "").replace(/\r\n/g, "\n").split("\n");
  const map = new Map(); // name -> count

  for (const line0 of lines) {
    const line = line0.trim();
    if (isHeaderLine(line)) continue;
    if (!line) continue;

    let m = line.match(RE_PTCGL);
    if (!m) m = line.match(RE_LIMITLESS);

    if (m) {
      const count = Number(m[1]);
      const name = m[2].trim();
      if (!Number.isFinite(count) || count <= 0) continue;
      map.set(name, (map.get(name) || 0) + count);
      continue;
    }

    // Support "4x Card Name"
    const m2 = line.match(/^(\d+)\s*x\s+(.+)$/i);
    if (m2) {
      const count = Number(m2[1]);
      const name = m2[2].trim();
      if (!Number.isFinite(count) || count <= 0) continue;
      map.set(name, (map.get(name) || 0) + count);
      continue;
    }
  }

  const cards = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  cards.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return cards;
}

// --- Hypergeometric maths ---
// Probability of drawing exactly k successes:
// C(K, k) * C(N-K, n-k) / C(N, n)

function logFactorial(n) {
  // simple cache for speed
  if (!logFactorial.cache) logFactorial.cache = [0];
  const c = logFactorial.cache;
  for (let i = c.length; i <= n; i++) c[i] = c[i - 1] + Math.log(i);
  return c[n];
}

function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

function hypergeomPMF(N, K, n, k) {
  if (k < 0 || k > K) return 0;
  if (k > n) return 0;
  if (n - k > N - K) return 0;
  const logP = logChoose(K, k) + logChoose(N - K, n - k) - logChoose(N, n);
  return Math.exp(logP);
}

function clampInt(x, lo, hi) {
  const n = Math.floor(Number(x));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function fmtPct(p) {
  if (!Number.isFinite(p)) return "—";
  return (p * 100).toFixed(2) + "%";
}

function fmtNum(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(3);
}

// --- UI ---
function renderDeckDropdown(decks) {
  deckSelectEl.innerHTML = "";
  if (!decks.length) {
    deckSelectEl.innerHTML = `<option value="">No saved decks found</option>`;
    return;
  }
  deckSelectEl.innerHTML = `<option value="">Select a deck…</option>`;
  for (const d of decks) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name || "Untitled deck";
    deckSelectEl.appendChild(opt);
  }
}

function renderCardsList() {
  const q = (cardSearchEl.value || "").trim().toLowerCase();
  const filtered = q
    ? currentCards.filter(c => c.name.toLowerCase().includes(q))
    : currentCards;

  cardsListEl.innerHTML = "";

  const total = currentCards.reduce((a, c) => a + c.count, 0);
  deckMetaEl.textContent = currentDeck ? `${currentDeck.name || "Deck"} • ${total} parsed cards` : "—";

  if (!currentDeck) {
    cardsListEl.innerHTML = `<div class="empty">Choose a deck above.</div>`;
    return;
  }

  if (!filtered.length) {
    cardsListEl.innerHTML = `<div class="empty">No cards match that search.</div>`;
    return;
  }

  for (const c of filtered) {
    const div = document.createElement("div");
    div.className = "carditem" + (c.name === selectedCardName ? " active" : "");
    div.innerHTML = `
      <div class="name">${escapeHtml(c.name)}</div>
      <div class="meta">${c.count} copies</div>
    `;
    div.addEventListener("click", () => {
      selectedCardName = c.name;
      renderCardsList();
      renderStats();
    });
    cardsListEl.appendChild(div);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStats() {
  if (!currentDeck || !selectedCardName) {
    selMetaEl.textContent = "—";
    statsEl.classList.add("hidden");
    emptyStateEl.classList.remove("hidden");
    return;
  }

  const card = currentCards.find(c => c.name === selectedCardName);
  if (!card) return;

  const N = clampInt(deckSizeEl.value, 1, 60);
  const n = clampInt(handSizeEl.value, 1, N);
  const K = clampInt(card.count, 0, N);

  selMetaEl.textContent = `${selectedCardName}`;

  const p0 = hypergeomPMF(N, K, n, 0);
  const pAtLeast1 = 1 - p0;
  const expected = n * (K / N);

  copiesEl.textContent = String(K);
  pAtLeast1El.textContent = fmtPct(pAtLeast1);
  p0El.textContent = fmtPct(p0);
  expEl.textContent = fmtNum(expected);

  // distribution up to min(K, n)
  distEl.innerHTML = "";
  const maxK = Math.min(K, n);
  for (let k = 0; k <= maxK; k++) {
    const pk = hypergeomPMF(N, K, n, k);
    const line = document.createElement("div");
    line.className = "distline";
    line.innerHTML = `<span>Exactly ${k}</span><strong>${fmtPct(pk)}</strong>`;
    distEl.appendChild(line);
  }

  emptyStateEl.classList.add("hidden");
  statsEl.classList.remove("hidden");
}

// --- Navigation integration ---
// Deep link support: /apps/outs/?deckId=...
function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

// --- Events ---
deckSelectEl.addEventListener("change", async () => {
  const id = deckSelectEl.value;
  selectedCardName = null;

  if (!id) {
    currentDeck = null;
    currentCards = [];
    renderCardsList();
    renderStats();
    return;
  }

  const d = await getDeck(id);
  if (!d) {
    toast("Deck not found");
    return;
  }
  currentDeck = d;
  currentCards = parseDeckToCardCounts(d.rawText || "");
  renderCardsList();
  renderStats();
});

btnRefreshEl.addEventListener("click", async () => {
  await loadDecks();
  toast("Refreshed");
});

cardSearchEl.addEventListener("input", () => renderCardsList());
handSizeEl.addEventListener("input", () => renderStats());
deckSizeEl.addEventListener("input", () => renderStats());

// --- Init ---
async function loadDecks() {
  const decks = await getAllDecks();
  renderDeckDropdown(decks);

  // preselect via query param
  const qp = getQueryParam("deckId");
  if (qp) {
    deckSelectEl.value = qp;
    // trigger load
    const d = await getDeck(qp);
    if (d) {
      currentDeck = d;
      currentCards = parseDeckToCardCounts(d.rawText || "");
      renderCardsList();
      renderStats();
      return;
    }
  }

  // otherwise do nothing
  currentDeck = null;
  currentCards = [];
  renderCardsList();
  renderStats();
}

(async function init() {
  db = await openDB();
  await loadDecks();
})().catch((e) => {
  console.error(e);
  toast("Failed to load database (open Decklist Manager once first).");
});

