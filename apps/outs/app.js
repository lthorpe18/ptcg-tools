// Hand / Outs Calculator
// Reads decklists from Decklist Manager via IndexedDB:
// DB: "ptcg-tools-db" store: "decks" objects: { id, name, rawText, ... }

const DB_NAME = "ptcg-tools-db";
const STORE_DECKS = "decks";

let db = null;

let currentDeck = null; // {id, name, rawText}
let currentCards = [];  // [{key, name, setCode, number, count, type}]
let selectedCardKey = null; // string (unique per printing)

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
  return new Promise((resolve) => {
    try {
      const store = tx(STORE_DECKS, "readonly");
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function getDeck(id) {
  return new Promise((resolve) => {
    try {
      const store = tx(STORE_DECKS, "readonly");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// --- Decklist parsing (PTCGL or Limitless-ish) ---
// Supports:
// 4 Card Name (SET 123)
// 4 Card Name SET 123
// Tracks section headers to set type.

const RE_PTCGL = /^(\d+)\s+(.+?)\s+\(([\w-]+)\s+([0-9]+[a-zA-Z]?)\)\s*$/;
const RE_LIMITLESS = /^(\d+)\s+(.+?)\s+([\w-]+)\s+([0-9]+[a-zA-Z]?)\s*$/;

function detectHeaderType(line) {
  const low = line.trim().toLowerCase();

  // Match common variants like:
  // "Pokémon:", "Pokémon: 17", "Pokemon (17)", "Trainers: 33", "Energy: 10"
  if (/^pok(?:é|e)mon\b/.test(low)) return "Pokemon";
  if (/^trainer(s)?\b/.test(low)) return "Trainer";
  if (/^energy\b/.test(low)) return "Energy";

  return null;
}

function isNoiseLine(line) {
  const s = line.trim();
  if (!s) return true;
  const low = s.toLowerCase();
  if (low.startsWith("total cards")) return true;
  return false;
}

function parseDeckToCardCounts(rawText) {
  const lines = String(rawText || "").replace(/\r\n/g, "\n").split("\n");
  const map = new Map(); // key -> { key, name, setCode, number, count, type }

  let currentType = "Trainer"; // default bucket before any header appears

  const add = (type, count, name, setCode = "", number = "") => {
    const key = `${type}||${name}||${setCode}||${number}`;
    const prev = map.get(key);
    if (prev) prev.count += count;
    else map.set(key, { key, type, name, setCode, number, count });
  };

  for (const line0 of lines) {
    const line = line0.trim();
    if (isNoiseLine(line)) continue;

    const headerType = detectHeaderType(line);
    if (headerType) {
      currentType = headerType;
      continue;
    }

    let m = line.match(RE_PTCGL);
    if (!m) m = line.match(RE_LIMITLESS);

    if (m) {
      const count = Number(m[1]);
      const name = m[2].trim();
      const setCode = (m[3] || "").trim();
      const number = (m[4] || "").trim();
      if (!Number.isFinite(count) || count <= 0) continue;
      add(currentType, count, name, setCode, number);
      continue;
    }

    // Support "4x Card Name"
    const m2 = line.match(/^(\d+)\s*x\s+(.+)$/i);
    if (m2) {
      const count = Number(m2[1]);
      const name = m2[2].trim();
      if (!Number.isFinite(count) || count <= 0) continue;
      add(currentType, count, name);
      continue;
    }
  }

  const cards = Array.from(map.values());

  cards.sort((a, b) =>
    a.type.localeCompare(b.type) ||
    b.count - a.count ||
    a.name.localeCompare(b.name) ||
    (a.setCode || "").localeCompare(b.setCode || "") ||
    (a.number || "").localeCompare(b.number || "")
  );

  return cards;
}

// --- Hypergeometric maths ---
// Probability of drawing exactly k successes:
// C(K, k) * C(N-K, n-k) / C(N, n)

function logFactorial(n) {
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Grouping helpers ---
const TYPE_ORDER = ["Pokemon", "Trainer", "Energy"];

function groupCards(cards) {
  const groups = new Map();
  for (const t of TYPE_ORDER) groups.set(t, []);
  for (const c of cards) {
    if (!groups.has(c.type)) groups.set(c.type, []);
    groups.get(c.type).push(c);
  }
  return groups;
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

function renderCardsGrid() {
  const q = (cardSearchEl.value || "").trim().toLowerCase();

  const filtered = q
    ? currentCards.filter((c) =>
        (`${c.name} ${c.setCode} ${c.number}`).toLowerCase().includes(q)
      )
    : currentCards;

  cardsListEl.innerHTML = "";

  if (!currentDeck) {
    deckMetaEl.textContent = "—";
    cardsListEl.innerHTML = `<div class="empty">Choose a deck above.</div>`;
    return;
  }

  const totals = { Pokemon: 0, Trainer: 0, Energy: 0, All: 0 };
  for (const c of currentCards) {
    totals.All += c.count;
    if (totals[c.type] !== undefined) totals[c.type] += c.count;
  }
  deckMetaEl.textContent = `${currentDeck.name || "Deck"} • ${totals.All} cards (P ${totals.Pokemon} / T ${totals.Trainer} / E ${totals.Energy})`;

  if (!filtered.length) {
    cardsListEl.innerHTML = `<div class="empty">No cards match that search.</div>`;
    return;
  }

  const groups = groupCards(filtered);

  for (const type of TYPE_ORDER) {
    const cards = groups.get(type) || [];
    if (!cards.length) continue;

    // Sort inside group: copies desc, then name, then set/number
    cards.sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name) ||
        (a.setCode || "").localeCompare(b.setCode || "") ||
        (a.number || "").localeCompare(b.number || "")
    );

    const groupEl = document.createElement("div");
    groupEl.className = "group";

    const headEl = document.createElement("div");
    headEl.className = "grouphead";

    const titleEl = document.createElement("h4");
    titleEl.className = "gtitle";
    titleEl.textContent = type === "Pokemon" ? "Pokémon" : type;

    const metaEl = document.createElement("span");
    metaEl.className = "gmeta";
    const groupTotal = cards.reduce((a, c) => a + c.count, 0);
    metaEl.textContent = `${cards.length} cards • ${groupTotal} copies`;

    headEl.appendChild(titleEl);
    headEl.appendChild(metaEl);

    const gridEl = document.createElement("div");
    gridEl.className = "grid";

    for (const c of cards) {
      const div = document.createElement("div");
      div.className = "carditem" + (c.key === selectedCardKey ? " active" : "");

      div.innerHTML = `
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="meta">${c.count} copies${c.setCode ? ` • ${escapeHtml(c.setCode)} ${escapeHtml(c.number)}` : ""}</div>
      `;

      div.addEventListener("click", () => {
        selectedCardKey = c.key;
        renderCardsGrid();
        renderStats();
      });

      gridEl.appendChild(div);
    }

    groupEl.appendChild(headEl);
    groupEl.appendChild(gridEl);
    cardsListEl.appendChild(groupEl);
  }
}

function renderStats() {
  if (!currentDeck || !selectedCardKey) {
    selMetaEl.textContent = "—";
    statsEl.classList.add("hidden");
    emptyStateEl.classList.remove("hidden");
    return;
  }

  const card = currentCards.find((c) => c.key === selectedCardKey);
  if (!card) return;

  const N = clampInt(deckSizeEl.value, 1, 60);
  const n = clampInt(handSizeEl.value, 1, N);
  const K = clampInt(card.count, 0, N);

  selMetaEl.textContent =
    `${card.name}${card.setCode ? ` • ${card.setCode} ${card.number}` : ""} • ${card.type === "Pokemon" ? "Pokémon" : card.type}`;

  const p0 = hypergeomPMF(N, K, n, 0);
  const pAtLeast1 = 1 - p0;
  const expected = n * (K / N);

  copiesEl.textContent = String(K);
  pAtLeast1El.textContent = fmtPct(pAtLeast1);
  p0El.textContent = fmtPct(p0);
  expEl.textContent = fmtNum(expected);

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

// Deep link support: /apps/outs/?deckId=...
function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

// --- Events ---
deckSelectEl.addEventListener("change", async () => {
  const id = deckSelectEl.value;
  selectedCardKey = null;

  if (!id) {
    currentDeck = null;
    currentCards = [];
    renderCardsGrid();
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
  renderCardsGrid();
  renderStats();
});

btnRefreshEl.addEventListener("click", async () => {
  await loadDecks();
  toast("Refreshed");
});

cardSearchEl.addEventListener("input", () => renderCardsGrid());
handSizeEl.addEventListener("input", () => renderStats());
deckSizeEl.addEventListener("input", () => renderStats());

// --- Init ---
async function loadDecks() {
  const decks = await getAllDecks();
  renderDeckDropdown(decks);

  const qp = getQueryParam("deckId");
  if (qp) {
    deckSelectEl.value = qp;
    const d = await getDeck(qp);
    if (d) {
      currentDeck = d;
      currentCards = parseDeckToCardCounts(d.rawText || "");
      renderCardsGrid();
      renderStats();
      return;
    }
  }

  currentDeck = null;
  currentCards = [];
  renderCardsGrid();
  renderStats();
}

(async function init() {
  db = await openDB();
  await loadDecks();
})().catch((e) => {
  console.error(e);
  toast("Failed to load database (open Decklist Manager once first).");
});
