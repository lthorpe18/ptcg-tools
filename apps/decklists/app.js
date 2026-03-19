// Decklist Manager (static GitHub Pages)
// Storage: IndexedDB (decks persist between visits on the same device)

const DB_NAME = "ptcg-tools-db";
const DB_VERSION = 2;
const STORE = "decks";

let db;
let currentId = null;
let currentDeck = null;
let dirty = false;

const $ = (id) => document.getElementById(id);

const deckListEl = $("deckList");
const emptyStateEl = $("emptyState");
const editorPaneEl = $("editorPane");

const btnNew = $("btnNew");
const btnSave = $("btnSave");
const btnDelete = $("btnDelete");
const btnDuplicate = $("btnDuplicate");

const deckNameEl = $("deckName");
const deckTextEl = $("deckText");
const searchEl = $("search");

const formatHintEl = $("formatHint");
const cardCountHintEl = $("cardCountHint");
const savedHintEl = $("savedHint");

const btnCopyPTCGL = $("btnCopyPTCGL");
const btnCopyLimitless = $("btnCopyLimitless");
const btnImgGen = $("btnImgGen");

const imageFileEl = $("imageFile");
const imageDropEl = $("imageDrop");
const imageEmptyEl = $("imageEmpty");
const imagePreviewEl = $("imagePreview");
const btnClearImage = $("btnClearImage");
const btnDownloadImage = $("btnDownloadImage");

const tabEditEl = $("tabEdit");
const tabStatsEl = $("tabStats");
const editorViewEl = $("editorView");
const statsViewEl = $("statsView");

const statsCardSearchEl = $("statsCardSearch");
const statsHandSizeEl = $("statsHandSize");
const statsDeckSizeEl = $("statsDeckSize");
const statsCardsListEl = $("statsCardsList");
const statsDeckMetaEl = $("statsDeckMeta");
const statsSelMetaEl = $("statsSelMeta");
const statsEmptyEl = $("statsEmpty");
const statsPanelEl = $("statsPanel");
const statsCopiesEl = $("statsCopies");
const statsAtLeast1El = $("statsAtLeast1");
const statsP0El = $("statsP0");
const statsExpectedEl = $("statsExpected");
const statsDistEl = $("statsDist");

const btnExportAll = $("btnExportAll");
const importBackupFileEl = $("importBackupFile");

const toastEl = $("toast");

let activeView = "edit";
let currentStatsCards = [];
let selectedCardKey = null;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}
// Decklists (merged) — deck manager + odds calculator + sprite identity
// Storage: IndexedDB "ptcg-tools-db" store "decks"

(() => {
  const DB_NAME = "ptcg-tools-db";
  const DB_VERSION = 2;
  const STORE_DECKS = "decks";

  const $ = (id) => document.getElementById(id);

  // Screens
  const screenLibrary = $("screenLibrary");
  const screenDeck = $("screenDeck");

  // Library UI
  const deckGrid = $("deckGrid");
  const emptyState = $("emptyState");
  
  // Deck card interactions (event delegation for robust mobile taps)
  deckGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".deck-card");
    if (!card) return;
    const id = card.dataset.deckId;
    if (id) openDeck(id);
  });

  deckGrid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".deck-card");
    if (!card) return;
    const id = card.dataset.deckId;
    if (id) {
      e.preventDefault();
      openDeck(id);
    }
  });

const btnNewDeck = $("btnNewDeck");
  const btnNewDeck2 = $("btnNewDeck2");
  const btnExport = $("btnExport");
  const fileImport = $("fileImport");
  const searchEl = $("search");
  const sortEl = $("sort");

  // Deck UI
  const btnBackToLibrary = $("btnBackToLibrary");
  const deckNameEl = $("deckName");
  const deckTextEl = $("deckText");
  const btnSaveDeck = $("btnSaveDeck");
  const btnDuplicateDeck = $("btnDuplicateDeck");
  const btnDeleteDeck = $("btnDeleteDeck");
  const btnParsePreview = $("btnParsePreview");
  const parseHint = $("parseHint");
  const cardPreview = $("cardPreview");
  const insightsEl = $("insights");
  const pinnedOddsEl = $("pinnedOdds");
  const btnCopyDecklist = $("btnCopyDecklist");

  // Statistics UI
  const statsSummaryEl = $("statsSummary");
  const topCardsEl = $("topCards");
  const energyMixEl = $("energyMix");
  const staplesEl = $("staples");

  const deckSpritesEl = $("deckSprites");
  const saveHint = $("saveHint");

  // Tabs
  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  const tabPanes = {
    overview: $("tab-overview"),
    cards: $("tab-cards"),
    stats: $("tab-stats"),
  };

  // Calc UI
  const calcCard = $("calcCard");
  const calcCopies = $("calcCopies");
  const calcDraws = $("calcDraws");
  const pAtLeast = $("pAtLeast");
  const pZero = $("pZero");
  const expCopies = $("expCopies");
  const deckSize = $("deckSize");
  const distTable = $("distTable");

  // Menu modal
  const menuModal = $("menuModal");
  const btnDeckMenu = $("btnDeckMenu");
  const btnCloseMenu = $("btnCloseMenu");
  const btnExportOne = $("btnExportOne");
  const btnCopyPinned = $("btnCopyPinned");

  // Sprite pickers
  const spritePickerEls = Array.from(document.querySelectorAll(".sprite-picker"));

  // Toast
  const toastEl = $("toast");
  let toastTimer = null;
  function toast(msg) {
    if (!msg) return;
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2200);
  }

  // State
  let db = null;
  let decks = []; // cached
  let activeDeckId = null;
  let activeDeck = null; // object
  let parsed = null;
  let dirty = false;
  let pokeNamesReady = false;

  // ---------- IndexedDB ----------
  function openDB() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_DECKS)) {
          const store = d.createObjectStore(STORE_DECKS, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("name", "name", { unique: false });
        } else {
          // Ensure indexes exist
          const tx = req.transaction;
          const store = tx.objectStore(STORE_DECKS);
          if (!store.indexNames.contains("updatedAt")) store.createIndex("updatedAt", "updatedAt", { unique: false });
          if (!store.indexNames.contains("name")) store.createIndex("name", "name", { unique: false });
        }
      };
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function txStore(mode = "readonly") {
    const tx = db.transaction([STORE_DECKS], mode);
    return tx.objectStore(STORE_DECKS);
  }

  function getAllDecks() {
    return new Promise((resolve, reject) => {
      const store = txStore("readonly");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function putDeck(deck) {
    return new Promise((resolve, reject) => {
      const store = txStore("readwrite");
      const req = store.put(deck);
      req.onsuccess = () => resolve(deck);
      req.onerror = () => reject(req.error);
    });
  }

  function deleteDeck(id) {
    return new Promise((resolve, reject) => {
      const store = txStore("readwrite");
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- Helpers ----------
  function uid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function fmtTimeAgo(ts) {
    if (!ts) return "—";
    const ms = Date.now() - ts;
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function setDirty(v) {
    dirty = v;
    updateSaveHint();
  }

  function updateSaveHint() {
    if (!activeDeck) {
      saveHint.textContent = "—";
      return;
    }
    if (dirty) {
      saveHint.textContent = "Unsaved changes";
      return;
    }
    saveHint.textContent = `Saved ${fmtTimeAgo(activeDeck.updatedAt)}`;
  }

  function showScreen(name) {
    screenLibrary.classList.toggle("hidden", name !== "library");
    screenDeck.classList.toggle("hidden", name !== "deck");
  }

  function setActiveTab(key) {
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    Object.entries(tabPanes).forEach(([k, el]) => el.classList.toggle("hidden", k !== key));
    tabButtons.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === key ? "true" : "false"));
  }

  function downloadJSON(filename, dataObj) {
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function titleCase(s) {
    return (s || "").replace(/(^|[\s-])([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  }

  // ---------- Rendering: Library ----------
  function sortedDecks(list) {
    const q = (searchEl.value || "").toLowerCase().trim();
    let out = list;
    if (q) out = out.filter(d => (d.name || "").toLowerCase().includes(q));
    const sort = sortEl.value || "updated";
    out = [...out].sort((a, b) => {
      if (sort === "name") return (a.name || "").localeCompare(b.name || "");
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return out;
  }

  function deckSpritesHTML(deck) {
    const sprites = (deck.sprites || []).filter(Boolean).slice(0, 2);
    if (!sprites.length) return "";
    return sprites.map(s => `<img class="sprite" src="${s.spriteUrl || ""}" alt="${s.name || ""}">`).join("");
  }

  function renderDeckGrid() {
    const list = sortedDecks(decks);
    deckGrid.innerHTML = "";
    if (!list.length) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    for (const d of list) {
      const card = document.createElement("div");
      card.className = "deck-card";
      card.tabIndex = 0;
      card.setAttribute("role","button");
      card.innerHTML = `
        <div class="deck-main">
          <div class="deck-title">${escapeHtml(d.name || "Untitled deck")}</div>
          <div class="deck-meta">${escapeHtml(summaryLine(d))}</div>
        </div>
        <div class="deck-sprites">${deckSpritesHTML(d)}</div>
      `;
      card.setAttribute("role","button");
      card.dataset.deckId = d.id;
      deckGrid.appendChild(card);
    }
  }

  function summaryLine(deck) {
    const parsedLocal = window.PTCGDeckParser.parseDeck(deck.rawText || "");
    const total = parsedLocal.totalCards || 0;
    const p = parsedLocal.totals.pokemon || 0;
    const t = parsedLocal.totals.trainers || 0;
    const e = parsedLocal.totals.energy || 0;
    const pins = (deck.pinnedCards || []).length;
    const warn = total && total !== 60 ? " • ⚠ not 60" : "";
    return `${p} Pokémon • ${t} Trainers • ${e} Energy • ${total} cards${pins ? ` • ${pins} pinned` : ""} • Updated ${fmtTimeAgo(deck.updatedAt)}${warn}`;
  }

  // ---------- Rendering: Deck ----------
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  
  async function copyToClipboard(text) {
    const t = String(text ?? "");
    if (!t) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(t);
        return;
      }
    } catch {}
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

}

// --- Stats parsing ---
function detectHeaderType(line) {
  const low = line.trim().toLowerCase();
  if (/^pok(?:é|e)mon\b/.test(low)) return "Pokemon";
  if (/^trainer(s)?\b/.test(low)) return "Trainer";
  if (/^energy\b/.test(low)) return "Energy";
  return null;
}

function isNoiseLine(line) {
  const s = line.trim();
  if (!s) return true;
  const low = s.toLowerCase();
  return low.startsWith("total cards");
}

function parseDeckToCardCounts(rawText) {
  const lines = String(rawText || "").replace(/\r\n/g, "\n").split("\n");
  const map = new Map();

  let currentType = "Trainer";

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

// --- Hypergeometric stats ---
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

function toPTCGLText(deck) {
  // If we have structured entries with set+number, output PTCGL lines; otherwise keep raw
  const parsed = parseDeckText(deck.rawText);
  const out = [];
  for (const e of parsed.entries) {
    if (e.count && e.name && e.set && e.number) {
      out.push(`${e.count} ${e.name} (${e.set} ${e.number})`);
    } else if (e.count && e.name && !e.set && !e.number) {
      out.push(`${e.count} ${e.name}`);
    } else if (e.raw) {
      out.push(e.raw);
  function renderDeckHeaderSprites() {
    deckSpritesEl.innerHTML = "";
    const sprites = (activeDeck?.sprites || []).filter(Boolean).slice(0, 2);
    sprites.forEach(s => {
      const img = document.createElement("img");
      img.className = "sprite";
      img.alt = s.name || "";
      img.src = s.spriteUrl || "";
      deckSpritesEl.appendChild(img);
    });
  }

  function renderInsights() {
    if (!parsed) return;
    const total = parsed.totalCards || 0;
    const p = parsed.totals.pokemon || 0;
    const t = parsed.totals.trainers || 0;
    const e = parsed.totals.energy || 0;

    insightsEl.innerHTML = `
      <div class="insight"><div class="k">Total cards</div><div class="v">${total || "—"}</div></div>
      <div class="insight"><div class="k">Pokémon</div><div class="v">${p}</div></div>
      <div class="insight"><div class="k">Trainers</div><div class="v">${t}</div></div>
      <div class="insight"><div class="k">Energy</div><div class="v">${e}</div></div>
    `;

    if (total && total !== 60) {
      insightsEl.insertAdjacentHTML("beforeend",
        `<div class="insight" style="grid-column: 1 / -1;">
          <div class="k">Warning</div>
          <div class="v" style="font-size:14px;font-weight:650;">Deck is ${total} cards (expected 60)</div>
        </div>`);
    }
  }

  function renderPinnedOdds() {
    pinnedOddsEl.innerHTML = "";
    if (!activeDeck || !parsed) return;

    const pins = activeDeck.pinnedCards || [];
    if (!pins.length) {
      pinnedOddsEl.innerHTML = `<div class="muted">No pinned cards yet.</div>`;
      return;
    }

    const N = parsed.totalCards || 60;
    const n = clampInt(calcDraws.value || 7, 1, 60, 7);

    for (const nm of pins) {
      const entry = parsed.byName.get(nm.toLowerCase());
      const K = entry ? entry.total : 0;
      const p1 = window.PTCGProb.pAtLeastOne(N, K, n);
      const p0 = 1 - p1;

      const row = document.createElement("div");
      row.className = "pinned-item";
      row.innerHTML = `
        <div class="left">
          <div class="nm">${escapeHtml(nm)}</div>
          <p class="sub">K=${K} • n=${n} • P(0) ${(p0*100).toFixed(1)}%</p>
        </div>
        <div class="odds">${(p1*100).toFixed(1)}%</div>
      `;
      pinnedOddsEl.appendChild(row);
    }
  }

  
  function renderStatistics() {
    if (!parsed) return;

    // Summary metrics (reuse same styling as insights)
    const total = parsed.totalCards || 0;
    const p = parsed.totals.pokemon || 0;
    const t = parsed.totals.trainers || 0;
    const e = parsed.totals.energy || 0;
    const unique = parsed.byName ? parsed.byName.size : 0;

    if (statsSummaryEl) {
      statsSummaryEl.innerHTML = `
        <div class="insight"><div class="k">Total cards</div><div class="v">${total || "—"}</div></div>
        <div class="insight"><div class="k">Unique cards</div><div class="v">${unique || "—"}</div></div>
        <div class="insight"><div class="k">Pokémon</div><div class="v">${p}</div></div>
        <div class="insight"><div class="k">Trainers</div><div class="v">${t}</div></div>
        <div class="insight"><div class="k">Energy</div><div class="v">${e}</div></div>
      `;
    }

    // Top cards
    if (topCardsEl) {
      const rows = [];
      const entries = [];
      if (parsed.byName) {
        for (const v of parsed.byName.values()) entries.push(v);
      }
      entries.sort((a,b) => (b.total||0) - (a.total||0) || a.name.localeCompare(b.name));
      const top = entries.slice(0, 10);
      if (!top.length) {
        topCardsEl.innerHTML = `<div class="muted small">No cards parsed yet.</div>`;
      } else {
        topCardsEl.innerHTML = "";
        for (const it of top) {
          const div = document.createElement("div");
          div.className = "list-item";
          div.innerHTML = `<div class="li-name">${escapeHtml(it.name)}</div><div class="li-val">${it.total}</div>`;
          topCardsEl.appendChild(div);
        }
      }
    }

    // Energy mix (based on energy section)
    if (energyMixEl) {
      const mix = new Map();
      for (const c of (parsed.sections?.energy || [])) {
        const nm = c.name;
        mix.set(nm, (mix.get(nm) || 0) + (c.count || 0));
      }
      const arr = Array.from(mix.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
      if (!arr.length) {
        energyMixEl.innerHTML = `<div class="muted small">No energy detected.</div>`;
      } else {
        energyMixEl.innerHTML = "";
        for (const [nm, cnt] of arr) {
          const div = document.createElement("div");
          div.className = "list-item";
          div.innerHTML = `<div class="li-name">${escapeHtml(nm)}</div><div class="li-val">${cnt}</div>`;
          energyMixEl.appendChild(div);
        }
      }
    }

    // Staples quick counts (simple name matching)
    if (staplesEl) {
      const staples = [
        "Ultra Ball",
        "Nest Ball",
        "Buddy-Buddy Poffin",
        "Professor's Research",
        "Iono",
        "Judge",
        "Boss's Orders",
        "Arven",
        "Rare Candy",
        "Earthen Vessel",
        "Super Rod",
        "Night Stretcher"
      ];
      staplesEl.innerHTML = "";
      let any = false;
      for (const name of staples) {
        const key = name.toLowerCase();
        const v = parsed.byName?.get(key);
        const cnt = v ? (v.total || 0) : 0;
        if (cnt > 0) any = true;
        const div = document.createElement("div");
        div.className = "list-item";
        div.innerHTML = `<div class="li-name">${escapeHtml(name)}</div><div class="li-val">${cnt}</div>`;
        staplesEl.appendChild(div);
      }
      if (!any) {
        const hint = document.createElement("div");
        hint.className = "muted small topgap";
        hint.textContent = "No staple matches found (this list is just a starting point).";
        staplesEl.appendChild(hint);
      }
    }
  }

function buildCardPreview() {
    if (!parsed) return;
    cardPreview.innerHTML = "";
    const sections = [
      ["pokemon", "Pokémon", parsed.totals.pokemon || 0],
      ["trainers", "Trainers", parsed.totals.trainers || 0],
      ["energy", "Energy", parsed.totals.energy || 0],
    ];

    for (const [key, title, total] of sections) {
      const cards = parsed.sections[key] || [];
      if (!cards.length) continue;

      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = `
        <div class="section-head">
          <div class="section-title">${title}</div>
          <div class="muted small">${total}</div>
        </div>
        <div class="section-body"></div>
      `;
      const body = sec.querySelector(".section-body");
      const byName = new Map();
      for (const c of cards) {
        const k = c.name.toLowerCase();
        byName.set(k, (byName.get(k) || 0) + c.count);
      }
      const items = Array.from(byName.entries()).map(([k, cnt]) => ({ name: parsed.byName.get(k)?.name || k, count: cnt }));
      items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      for (const it of items) {
        const row = document.createElement("div");
        row.className = "card-row";
        const pinned = (activeDeck.pinnedCards || []).some(x => x.toLowerCase() === it.name.toLowerCase());
        row.innerHTML = `
          <div class="muted small">${it.count}×</div>
          <div class="name">${escapeHtml(it.name)}</div>
          <button class="pin ${pinned ? "active" : ""}" title="Pin for quick odds">${pinned ? "★" : "☆"}</button>
        `;
        row.querySelector(".pin").addEventListener("click", () => togglePinned(it.name));
        body.appendChild(row);
      }

      cardPreview.appendChild(sec);
    }

function showEditor(show) {
  if (show) {
    emptyStateEl.classList.add("hidden");
    editorPaneEl.classList.remove("hidden");
  } else {
    emptyStateEl.classList.remove("hidden");
    editorPaneEl.classList.add("hidden");
    setActiveView("edit");
    // Unknown / unparsed lines
    if (parsed.otherLines && parsed.otherLines.length) {
      const sec = document.createElement("div");
      sec.className = "section";
      sec.innerHTML = `
        <div class="section-head">
          <div class="section-title">Other lines</div>
          <div class="muted small">${parsed.otherLines.length}</div>
        </div>
        <div class="section-body">
          <div class="muted small">These lines weren’t recognized as cards.</div>
        </div>
      `;
      cardPreview.appendChild(sec);
    }
  }

  function togglePinned(cardName) {
    if (!activeDeck) return;
    const pins = activeDeck.pinnedCards || [];
    const idx = pins.findIndex(x => x.toLowerCase() === cardName.toLowerCase());
    if (idx >= 0) pins.splice(idx, 1);
    else pins.push(cardName);
    activeDeck.pinnedCards = pins;
    setDirty(true);
    buildCardPreview();
    renderPinnedOdds();
    rebuildCalcCardOptions();
  }

  // ---------- Calculator ----------
  function rebuildCalcCardOptions() {
    calcCard.innerHTML = "";
    if (!parsed) return;

    const names = Array.from(parsed.byName.values()).map(v => v.name);
    names.sort((a, b) => a.localeCompare(b));

    // Put pinned first
    const pinsLower = new Set((activeDeck?.pinnedCards || []).map(x => x.toLowerCase()));
    const pinnedNames = names.filter(n => pinsLower.has(n.toLowerCase()));
    const otherNames = names.filter(n => !pinsLower.has(n.toLowerCase()));
    const final = pinnedNames.concat(otherNames);

    for (const name of final) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      calcCard.appendChild(opt);
    }

    // default
    if (final.length) {
      calcCard.value = pinnedNames[0] || final[0];
      syncCalcCopiesFromSelection();
      computeCalc();
    } else {
      calcCopies.value = 0;
      computeCalc();
    }
  }

  function syncCalcCopiesFromSelection() {
    if (!parsed) return;
    const name = calcCard.value;
    const entry = parsed.byName.get((name || "").toLowerCase());
    calcCopies.value = entry ? entry.total : 0;
  }

function setActiveView(view) {
  activeView = view;
  const isEdit = view === "edit";
  tabEditEl.classList.toggle("active", isEdit);
  tabStatsEl.classList.toggle("active", !isEdit);
  tabEditEl.setAttribute("aria-selected", String(isEdit));
  tabStatsEl.setAttribute("aria-selected", String(!isEdit));
  editorViewEl.classList.toggle("hidden", !isEdit);
  statsViewEl.classList.toggle("hidden", isEdit);
  if (!isEdit) refreshStatsData();
}

function refreshStatsData() {
  if (!currentDeck) {
    currentStatsCards = [];
    selectedCardKey = null;
    renderStatsCards();
    renderStatsPanel();
    return;
  }

  currentStatsCards = parseDeckToCardCounts(deckTextEl.value || "");
  const totalCards = currentStatsCards.reduce((sum, card) => sum + card.count, 0);
  if (totalCards > 0) {
    statsDeckSizeEl.value = String(totalCards);
  }

  if (selectedCardKey && !currentStatsCards.some((c) => c.key === selectedCardKey)) {
    selectedCardKey = null;
  }
  renderStatsCards();
  renderStatsPanel();
}

function renderStatsCards() {
  const q = (statsCardSearchEl.value || "").trim().toLowerCase();
  const filtered = q
    ? currentStatsCards.filter((c) =>
        (`${c.name} ${c.setCode} ${c.number}`).toLowerCase().includes(q)
      )
    : currentStatsCards;

  statsCardsListEl.innerHTML = "";

  if (!currentDeck) {
    statsDeckMetaEl.textContent = "—";
    statsCardsListEl.innerHTML = `<div class="empty">Choose a deck to view stats.</div>`;
    return;
  }

  const totals = { Pokemon: 0, Trainer: 0, Energy: 0, All: 0 };
  for (const c of currentStatsCards) {
    totals.All += c.count;
    if (totals[c.type] !== undefined) totals[c.type] += c.count;
  }
  statsDeckMetaEl.textContent = `${currentDeck.name || "Deck"} • ${totals.All} cards (P ${totals.Pokemon} / T ${totals.Trainer} / E ${totals.Energy})`;

  if (!filtered.length) {
    statsCardsListEl.innerHTML = `<div class="empty">No cards match that search.</div>`;
    return;
  }

  const groups = groupCards(filtered);

  for (const type of TYPE_ORDER) {
    const cards = groups.get(type) || [];
    if (!cards.length) continue;

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
        renderStatsCards();
        renderStatsPanel();
      });
      gridEl.appendChild(div);
    }

    groupEl.appendChild(headEl);
    groupEl.appendChild(gridEl);
    statsCardsListEl.appendChild(groupEl);
  }
}

function renderStatsPanel() {
  if (!currentDeck || !selectedCardKey) {
    statsSelMetaEl.textContent = "—";
    statsPanelEl.classList.add("hidden");
    statsEmptyEl.classList.remove("hidden");
    return;
  }

  const card = currentStatsCards.find((c) => c.key === selectedCardKey);
  if (!card) return;

  const N = clampInt(statsDeckSizeEl.value, 1, 60);
  const n = clampInt(statsHandSizeEl.value, 1, N);
  const K = clampInt(card.count, 0, N);

  statsSelMetaEl.textContent =
    `${card.name}${card.setCode ? ` • ${card.setCode} ${card.number}` : ""} • ${card.type === "Pokemon" ? "Pokémon" : card.type}`;

  const p0 = hypergeomPMF(N, K, n, 0);
  const pAtLeast1 = 1 - p0;
  const expected = n * (K / N);

  statsCopiesEl.textContent = String(K);
  statsAtLeast1El.textContent = fmtPct(pAtLeast1);
  statsP0El.textContent = fmtPct(p0);
  statsExpectedEl.textContent = fmtNum(expected);

  statsDistEl.innerHTML = "";
  const maxK = Math.min(K, n);
  for (let k = 0; k <= maxK; k++) {
    const pk = hypergeomPMF(N, K, n, k);
    const line = document.createElement("div");
    line.className = "distline";
    line.innerHTML = `<span>Exactly ${k}</span><strong>${fmtPct(pk)}</strong>`;
    statsDistEl.appendChild(line);
  }

  statsEmptyEl.classList.add("hidden");
  statsPanelEl.classList.remove("hidden");
}

// --- Image handling ---
function setImageDataUrl(dataUrl) {
  if (!currentDeck) return;
  currentDeck.imageDataUrl = dataUrl || null;
  updateImageUI();
  setDirty(true);
}
  function computeCalc() {
    if (!parsed) return;
    const N = parsed.totalCards || 60;
    const K = clampInt(calcCopies.value, 0, 60, 0);
    const n = clampInt(calcDraws.value, 1, 60, 7);

    deckSize.textContent = String(N);
    const p1 = window.PTCGProb.pAtLeastOne(N, K, n);
    const p0 = 1 - p1;
    const ex = window.PTCGProb.expected(N, K, n);

    pAtLeast.textContent = `${(p1 * 100).toFixed(1)}%`;
    pZero.textContent = `${(p0 * 100).toFixed(1)}%`;
    expCopies.textContent = ex.toFixed(2);

    const dist = window.PTCGProb.distribution(N, K, n);
    distTable.innerHTML = "";
    for (const row of dist) {
      const div = document.createElement("div");
      div.className = "dist-row";
      div.innerHTML = `<div class="k">Exactly ${row.k}</div><div>${(row.p*100).toFixed(2)}%</div>`;
      distTable.appendChild(div);
    }
  }

  // ---------- Sprites ----------
  function setPickerUI(slot, spriteObj) {
    const picker = spritePickerEls.find(el => parseInt(el.dataset.slot, 10) === slot);
    if (!picker) return;
    const img = picker.querySelector(".sprite-img");
    const input = picker.querySelector(".sprite-input");
    img.src = spriteObj?.spriteUrl || "";
    img.alt = spriteObj?.name ? `${spriteObj.name} sprite` : "";
    input.value = spriteObj?.name ? titleCase(spriteObj.name) : "";
  }

  function closeSuggestions(picker) {
    const sug = picker.querySelector(".suggestions");
    sug.classList.add("hidden");
    sug.innerHTML = "";
  }

  function openSuggestions(picker, items) {
    const sug = picker.querySelector(".suggestions");
    sug.innerHTML = "";
    if (!items.length) {
      sug.classList.add("hidden");
      return;
    }
    for (const obj of items) {
      const name = obj.name;
      const miniUrl = window.PTCGSprites.getQuickSpriteUrl(name);
      const row = document.createElement("div");
      row.className = "sug";
      row.setAttribute("role", "option");
      row.innerHTML = `
        <span class="name">${escapeHtml(titleCase(name))}</span>
        ${miniUrl ? `<img class="mini" src="${miniUrl}" alt="">` : `<span class="muted small">tap</span>`}
      `;
      row.addEventListener("click", async () => {
        await chooseSprite(picker, name);
        closeSuggestions(picker);
      });
      sug.appendChild(row);
    }
    sug.classList.remove("hidden");
  }

  async function chooseSprite(picker, name) {
    if (!activeDeck) return;
    const slot = parseInt(picker.dataset.slot, 10);
    const sprite = await window.PTCGSprites.fetchSprite(name);
    if (!sprite || !sprite.spriteUrl) {
      toast("Sprite not found");
      return;
    }
    activeDeck.sprites = activeDeck.sprites || [null, null];
    activeDeck.sprites[slot] = sprite;
    setPickerUI(slot, sprite);
    renderDeckHeaderSprites();
    setDirty(true);
  }

  function wireSpritePickers() {
    spritePickerEls.forEach(picker => {
      const input = picker.querySelector(".sprite-input");
      const clear = picker.querySelector(".sprite-clear");

      let t = null;
      input.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const q = input.value;
          if (!pokeNamesReady) {
            openSuggestions(picker, []);
            return;
          }
          const hits = window.PTCGSprites.searchNamesSync(q, 12);
          openSuggestions(picker, hits);
        }, 120);
      });

      input.addEventListener("focus", () => {
        if (!pokeNamesReady) return;
        const hits = window.PTCGSprites.searchNamesSync(input.value, 12);
        openSuggestions(picker, hits);
      });

      input.addEventListener("blur", async () => {
        // Give click handlers time to fire
        setTimeout(() => closeSuggestions(picker), 150);

        const val = (input.value || "").trim();
        if (!val) return;
        // If already selected, do nothing
        const slot = parseInt(picker.dataset.slot, 10);
        const existing = activeDeck?.sprites?.[slot]?.name;
        if (existing && titleCase(existing) === titleCase(val)) return;

        // Try fetch by typed value
        const key = val.toLowerCase().replace(/\s+/g, "-");
        const sprite = await window.PTCGSprites.fetchSprite(key);
        if (sprite && sprite.spriteUrl) {
          activeDeck.sprites = activeDeck.sprites || [null, null];
          activeDeck.sprites[slot] = sprite;
          setPickerUI(slot, sprite);
          renderDeckHeaderSprites();
          setDirty(true);
        }
      });

      clear.addEventListener("click", (e) => {
        e.preventDefault();
        if (!activeDeck) return;
        const slot = parseInt(picker.dataset.slot, 10);
        activeDeck.sprites = activeDeck.sprites || [null, null];
        activeDeck.sprites[slot] = null;
        setPickerUI(slot, null);
        renderDeckHeaderSprites();
        setDirty(true);
      });
    });

    // Close suggestions when tapping elsewhere
    document.addEventListener("click", (e) => {
      spritePickerEls.forEach(p => {
        if (!p.contains(e.target)) closeSuggestions(p);
      });
    });
  }

  // ---------- Load / Open deck ----------
  function blankDeck() {
    const now = Date.now();
    return {
      id: uid(),
      name: "New deck",
      rawText: "",
      createdAt: now,
      updatedAt: now,
      pinnedCards: [],
      sprites: [null, null],
    };
  }

  refreshHintsFromText();
  updateImageUI();
  showEditor(true);
  refreshStatsData();
  setActiveView(activeView);
  async function openDeck(id) {
    const found = decks.find(d => d.id === id);
    if (!found) return;

    activeDeckId = id;
    // Clone to allow cancel-ish behavior (we still do explicit save)
    activeDeck = JSON.parse(JSON.stringify(found));

    deckNameEl.value = activeDeck.name || "";
    deckTextEl.value = activeDeck.rawText || "";
    calcDraws.value = 7;

    // Pickers
    setPickerUI(0, activeDeck.sprites?.[0] || null);
    setPickerUI(1, activeDeck.sprites?.[1] || null);
    renderDeckHeaderSprites();

    parseDeckIntoState();
    setDirty(false);
    setActiveTab("overview");
    showScreen("deck");
  }

  function parseDeckIntoState() {
    parsed = window.PTCGDeckParser.parseDeck(deckTextEl.value || "");
    parseHint.textContent = parsed.totalCards ? `${parsed.totalCards} cards parsed` : "No cards parsed";
    renderInsights();
    renderStatistics();
    buildCardPreview();
    rebuildCalcCardOptions();
    renderPinnedOdds();
    computeCalc();
  }

  async function saveActiveDeck() {
    if (!activeDeck) return;

async function deleteCurrentDeck() {
  if (!currentDeck) return;
  const ok = confirm(`Delete "${currentDeck.name}"?`);
  if (!ok) return;

  await deleteDeck(currentDeck.id);
  toast("Deleted");
  currentDeck = null;
  currentId = null;
  showEditor(false);
  refreshStatsData();
  await refreshList();
}
    activeDeck.name = (deckNameEl.value || "").trim() || "Untitled deck";
    activeDeck.rawText = deckTextEl.value || "";
    activeDeck.updatedAt = Date.now();

    await putDeck(activeDeck);

    // Update cache
    const idx = decks.findIndex(d => d.id === activeDeck.id);
    if (idx >= 0) decks[idx] = JSON.parse(JSON.stringify(activeDeck));
    else decks.unshift(JSON.parse(JSON.stringify(activeDeck)));

    setDirty(false);
    renderDeckGrid();
    toast("Saved");
  }

  async function createAndOpenDeck() {
    const d = blankDeck();
    await putDeck(d);
    decks.unshift(d);
    renderDeckGrid();
    openDeck(d.id);
    toast("Created");
  }

  async function duplicateActiveDeck() {
    if (!activeDeck) return;
    const d = JSON.parse(JSON.stringify(activeDeck));
    d.id = uid();
    d.name = `${d.name || "Deck"} (copy)`;
    d.createdAt = Date.now();
    d.updatedAt = Date.now();
    await putDeck(d);
    decks.unshift(d);
    renderDeckGrid();
    toast("Duplicated");
  }

  async function deleteActiveDeckUI() {
    if (!activeDeck) return;
    const ok = confirm(`Delete "${activeDeck.name || "this deck"}"? This cannot be undone.`);
    if (!ok) return;
    await deleteDeck(activeDeck.id);
    decks = decks.filter(d => d.id !== activeDeck.id);
    activeDeck = null;
    activeDeckId = null;
    showScreen("library");
    renderDeckGrid();
    toast("Deleted");
  }

  // ---------- Import / Export ----------
  function exportAllDecks() {
    const payload = {
      kind: "ptcg-tools-decklists-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      decks
    };
    downloadJSON(`ptcg-tools-decks-${new Date().toISOString().slice(0,10)}.json`, payload);
    toast("Exported");
  }

  function exportOneDeck() {
    if (!activeDeck) return;
    const payload = {
      kind: "ptcg-tools-decklists-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      decks: [activeDeck]
    };
    downloadJSON(`${(activeDeck.name || "deck").replace(/[^\w\-]+/g,"_")}.json`, payload);
    toast("Exported deck");
  }

  async function importDecksFromFile(file) {
    const text = await file.text();
    let data = null;
    try { data = JSON.parse(text); } catch { toast("Invalid JSON"); return; }
    const imported = (data && data.decks && Array.isArray(data.decks)) ? data.decks : null;
    if (!imported) { toast("No decks found in file"); return; }

    // Basic normalize
    const now = Date.now();
    for (const d of imported) {
      if (!d.id) d.id = uid();
      if (!d.name) d.name = "Imported deck";
      if (!d.createdAt) d.createdAt = now;
      if (!d.updatedAt) d.updatedAt = now;
      if (!Array.isArray(d.pinnedCards)) d.pinnedCards = [];
      if (!Array.isArray(d.sprites)) d.sprites = [null, null];
      if (d.sprites.length < 2) d.sprites = [d.sprites[0] || null, d.sprites[1] || null];
      await putDeck(d);
    }

    decks = await getAllDecks();
    renderDeckGrid();
    toast(`Imported ${imported.length} deck(s)`);
  }

  // ---------- Menu ----------
  function openMenu() { menuModal.classList.remove("hidden"); }
  function closeMenu() { menuModal.classList.add("hidden"); }

  function copyPinnedSummary() {
    if (!activeDeck || !parsed) return;
    const N = parsed.totalCards || 60;
    const n = clampInt(calcDraws.value || 7, 1, 60, 7);
    const lines = [];
    lines.push(`${activeDeck.name || "Deck"} — pinned odds (n=${n}, N=${N})`);
    for (const nm of (activeDeck.pinnedCards || [])) {
      const entry = parsed.byName.get(nm.toLowerCase());
      const K = entry ? entry.total : 0;
      const p1 = window.PTCGProb.pAtLeastOne(N, K, n);
      lines.push(`- ${nm}: K=${K}, P(≥1) ${(p1*100).toFixed(1)}%`);
    }
    copyToClipboard(lines.join("\n")).then(() => toast("Copied"), () => toast("Copy failed"));
  }

  // ---------- Wire events ----------
  function wireEvents() {
    // Library
    btnNewDeck.addEventListener("click", createAndOpenDeck);
    btnNewDeck2.addEventListener("click", createAndOpenDeck);
    btnExport.addEventListener("click", exportAllDecks);
    fileImport.addEventListener("change", async () => {
      const f = fileImport.files && fileImport.files[0];
      if (!f) return;
      await importDecksFromFile(f);
      fileImport.value = "";
    });
    searchEl.addEventListener("input", renderDeckGrid);
    sortEl.addEventListener("change", renderDeckGrid);

    // Deck navigation
    btnBackToLibrary.addEventListener("click", () => {
      if (dirty) {
        const ok = confirm("You have unsaved changes. Leave anyway?");
        if (!ok) return;
      }
      activeDeck = null;
      activeDeckId = null;
      parsed = null;
      showScreen("library");
      renderDeckGrid();
    });

    // Tabs
    tabButtons.forEach(b => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));

    // Deck edits
    deckNameEl.addEventListener("input", () => setDirty(true));
    deckTextEl.addEventListener("input", () => setDirty(true));
    btnParsePreview.addEventListener("click", () => { parseDeckIntoState(); toast("Preview refreshed"); });
    btnSaveDeck.addEventListener("click", async () => {
      parseDeckIntoState(); // ensure preview reflects saved raw text
      await saveActiveDeck();
    });
    btnDuplicateDeck.addEventListener("click", duplicateActiveDeck);
    btnDeleteDeck.addEventListener("click", deleteActiveDeckUI);

    // Quick actions
    btnCopyDecklist?.addEventListener("click", async () => {
      const txt = (deckTextEl.value || "").trim() || (activeDeck?.rawText || "");
      if (!txt) return toast("Nothing to copy");
      await copyToClipboard(txt);
      toast("Decklist copied");
    });


// --- Wire up events ---
btnNew.addEventListener("click", newDeck);
btnSave.addEventListener("click", () => saveCurrentDeck(false));
btnDelete.addEventListener("click", deleteCurrentDeck);
btnDuplicate.addEventListener("click", duplicateCurrentDeck);

searchEl.addEventListener("input", refreshList);

deckNameEl.addEventListener("input", () => {
  setDirty(true);
  renderStatsCards();
});
deckTextEl.addEventListener("input", () => {
  setDirty(true);
  refreshHintsFromText();
  refreshStatsData();
});

btnCopyPTCGL.addEventListener("click", async () => {
  if (!currentDeck) return;
  const temp = { ...currentDeck, rawText: deckTextEl.value };
  await copyToClipboard(toPTCGLText(temp));
});

btnCopyLimitless.addEventListener("click", async () => {
  if (!currentDeck) return;
  const temp = { ...currentDeck, rawText: deckTextEl.value };
  await copyToClipboard(toLimitlessText(temp));
});

btnImgGen.addEventListener("click", async () => {
  if (!currentDeck) return;
  const temp = { ...currentDeck, rawText: deckTextEl.value };
  const ok = await copyToClipboard(toLimitlessText(temp));
  // Open after the user gesture; iOS Safari usually allows this inside the click handler.
  window.open("https://limitlesstcg.com/tools/imggen", "_blank", "noopener,noreferrer");
  if (ok) toast("Copied. Paste into ImgGen and Submit.");
});

tabEditEl.addEventListener("click", () => setActiveView("edit"));
tabStatsEl.addEventListener("click", () => setActiveView("stats"));

statsCardSearchEl.addEventListener("input", () => renderStatsCards());
statsHandSizeEl.addEventListener("input", () => renderStatsPanel());
statsDeckSizeEl.addEventListener("input", () => renderStatsPanel());

imageFileEl.addEventListener("change", async () => {
  if (!currentDeck) return;
  const file = imageFileEl.files?.[0];
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  setImageDataUrl(dataUrl);
  toast("Image attached");
  imageFileEl.value = "";
});

btnClearImage.addEventListener("click", () => {
  if (!currentDeck) return;
  setImageDataUrl(null);
  toast("Image cleared");
});

btnDownloadImage.addEventListener("click", () => {
  if (!currentDeck?.imageDataUrl) return;
  const a = document.createElement("a");
  a.href = currentDeck.imageDataUrl;
  a.download = (currentDeck.name || "deck") + ".png";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

imageDropEl.addEventListener("paste", (ev) => {
  handlePasteEvent(ev).catch(() => {});
});

// Some browsers only paste into focused elements; also listen on document
document.addEventListener("paste", (ev) => {
  // Only act if the image box is focused
  if (document.activeElement === imageDropEl) {
    handlePasteEvent(ev).catch(() => {});
  }
});

btnExportAll.addEventListener("click", exportAll);

importBackupFileEl.addEventListener("change", async () => {
  const f = importBackupFileEl.files?.[0];
  if (!f) return;
  try {
    await importBackup(f);
  } catch (e) {
    alert("Import failed: " + (e?.message || e));
  } finally {
    importBackupFileEl.value = "";
  }
});

// --- Init ---
(async function init() {
  db = await openDB();
  await refreshList();

  const decks = await getAllDecks();
  if (decks.length) {
    // auto-load most recent
    await loadDeckIntoEditor(decks[0].id);
  } else {
    showEditor(false);
  }
})().catch((e) => {
  console.error(e);
  alert("Failed to start app: " + (e?.message || e));
})();
    // Calculator
    calcCard.addEventListener("change", () => { syncCalcCopiesFromSelection(); computeCalc(); });
    calcCopies.addEventListener("input", computeCalc);
    calcDraws.addEventListener("input", () => { computeCalc(); renderPinnedOdds(); });

    // Menu
    btnDeckMenu.addEventListener("click", openMenu);
    btnCloseMenu.addEventListener("click", closeMenu);
    menuModal.addEventListener("click", (e) => { if (e.target === menuModal) closeMenu(); });
    btnExportOne.addEventListener("click", () => { exportOneDeck(); closeMenu(); });
    btnCopyPinned.addEventListener("click", () => { copyPinnedSummary(); closeMenu(); });
  }

  // ---------- Init ----------
  async function init() {
    await openDB();
    decks = await getAllDecks();

    renderDeckGrid();
    showScreen("library");

    wireEvents();
    wireSpritePickers();

    // Preload Pokémon names (for fast typeahead)
    try {
      await window.PTCGSprites.getIndex();
      pokeNamesReady = true;
    } catch (e) {
      // Still usable without suggestions; user can type full name and blur to fetch
      pokeNamesReady = false;
      toast("Sprite search offline (PokéAPI)");
    }
  }

  init().catch((e) => {
    console.error(e);
    toast("Failed to load");
  });
})();
