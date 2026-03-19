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

function nowISO() {
  return new Date().toISOString();
}

function humanTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

async function openDB() {
  const open = (version) =>
    new Promise((resolve, reject) => {
      const req = version == null ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);

      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const os = d.createObjectStore(STORE, { keyPath: "id" });
          os.createIndex("updatedAt", "updatedAt", { unique: false });
          os.createIndex("name", "name", { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Database upgrade blocked (another tab open?). Close other tabs and retry."));
    });

  // 1) Open whatever exists
  let d = await open();

  // 2) If store exists, we're done
  if (d.objectStoreNames.contains(STORE)) return d;

  // 3) Store missing: bump version to force an upgrade that creates it
  const nextVersion = (d.version || 1) + 1;
  d.close();

  d = await open(nextVersion);

  if (!d.objectStoreNames.contains(STORE)) {
    d.close();
    throw new Error(`DB opened but "${STORE}" store still missing after upgrade.`);
  }

  return d;
}


function tx(storeName, mode = "readonly") {
  const t = db.transaction(storeName, mode);
  return t.objectStore(storeName);
}

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

async function getAllDecks() {
  return new Promise((resolve, reject) => {
    const store = tx(STORE, "readonly");
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getDeck(id) {
  return new Promise((resolve, reject) => {
    const store = tx(STORE, "readonly");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putDeck(deck) {
  return new Promise((resolve, reject) => {
    const store = tx(STORE, "readwrite");
    const req = store.put(deck);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function deleteDeck(id) {
  return new Promise((resolve, reject) => {
    const store = tx(STORE, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// --- Decklist parsing / formatting ---
// We support two common copy/paste styles:
//
// PTCGL-ish lines:   4 Card Name (SET 123)
// Limitless-ish:     4 Card Name SET 123
//
// We store rawText plus a parsed list of {count, name, set, number, raw} where possible.

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

function parseDeckText(rawText) {
  const lines = String(rawText || "").replace(/\r\n/g, "\n").split("\n");

  const entries = [];
  let parsedCount = 0;
  let totalCardsFromLines = 0;

  for (const line0 of lines) {
    const line = line0.trim();
    if (isHeaderLine(line)) continue;

    let m = line.match(RE_PTCGL);
    if (m) {
      const count = Number(m[1]);
      const name = m[2];
      const set = m[3];
      const number = m[4];
      entries.push({ count, name, set, number, raw: line });
      parsedCount++;
      totalCardsFromLines += count;
      continue;
    }

    m = line.match(RE_LIMITLESS);
    if (m) {
      const count = Number(m[1]);
      const name = m[2];
      const set = m[3];
      const number = m[4];
      entries.push({ count, name, set, number, raw: line });
      parsedCount++;
      totalCardsFromLines += count;
      continue;
    }

    // Try "4x" style
    const m2 = line.match(/^(\d+)\s*x\s+(.+)$/i);
    if (m2) {
      entries.push({ count: Number(m2[1]), name: m2[2], set: "", number: "", raw: line });
      parsedCount++;
      totalCardsFromLines += Number(m2[1]);
      continue;
    }

    // Unparsed: keep raw
    entries.push({ count: null, name: "", set: "", number: "", raw: line });
  }

  const detected =
    parsedCount === 0
      ? "Unknown"
      : lines.some((l) => RE_PTCGL.test(l.trim()))
      ? "PTCGL"
      : "Limitless";

  return { entries, detectedFormat: detected, totalCards: totalCardsFromLines || null };
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
    }
  }
  return out.join("\n").trim() + "\n";
}

function toLimitlessText(deck) {
  const parsed = parseDeckText(deck.rawText);
  const out = [];
  for (const e of parsed.entries) {
    if (e.count && e.name && e.set && e.number) {
      out.push(`${e.count} ${e.name} ${e.set} ${e.number}`);
    } else if (e.count && e.name && !e.set && !e.number) {
      // still useful for imggen sometimes
      out.push(`${e.count} ${e.name}`);
    } else if (e.raw) {
      out.push(e.raw);
    }
  }
  return out.join("\n").trim() + "\n";
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
    return true;
  } catch (e) {
    // Fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copied to clipboard");
      return true;
    } catch {
      toast("Copy failed (browser blocked it).");
      return false;
    }
  }
}

// --- UI helpers ---
function setDirty(v) {
  dirty = v;
  if (!currentDeck) return;
  const base = `Saved: ${humanTime(currentDeck.updatedAt)}`;
  savedHintEl.textContent = dirty ? `${base} • (unsaved changes)` : base;
}

function showEditor(show) {
  if (show) {
    emptyStateEl.classList.add("hidden");
    editorPaneEl.classList.remove("hidden");
  } else {
    emptyStateEl.classList.remove("hidden");
    editorPaneEl.classList.add("hidden");
    setActiveView("edit");
  }
}

function renderDeckList(decks, selectedId) {
  deckListEl.innerHTML = "";
  if (!decks.length) {
    const div = document.createElement("div");
    div.className = "empty";
    div.innerHTML = `<h2>No decks yet</h2><p>Create your first deck with “New Deck”.</p>`;
    deckListEl.appendChild(div);
    return;
  }

  for (const d of decks) {
    const item = document.createElement("div");
    item.className = "deckitem" + (d.id === selectedId ? " active" : "");
    const count = (parseDeckText(d.rawText).totalCards ?? "—");
    item.innerHTML = `
      <div class="name">${escapeHtml(d.name || "Untitled deck")}</div>
      <div class="meta">${count} cards • Updated ${escapeHtml(shortAge(d.updatedAt))}</div>
    `;
    item.addEventListener("click", () => loadDeckIntoEditor(d.id));
    deckListEl.appendChild(item);
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

function shortAge(iso) {
  try {
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso || "";
  }
}

function refreshHintsFromText() {
  if (!currentDeck) return;
  const { detectedFormat, totalCards } = parseDeckText(deckTextEl.value);
  formatHintEl.textContent = `Format: ${detectedFormat}`;
  cardCountHintEl.textContent = `Cards: ${totalCards ?? "—"}`;
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

function updateImageUI() {
  const has = !!(currentDeck && currentDeck.imageDataUrl);
  if (!has) {
    imagePreviewEl.classList.add("hidden");
    imageEmptyEl.classList.remove("hidden");
    imagePreviewEl.src = "";
    return;
  }
  imagePreviewEl.src = currentDeck.imageDataUrl;
  imagePreviewEl.classList.remove("hidden");
  imageEmptyEl.classList.add("hidden");
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Paste image from clipboard (where supported)
async function handlePasteEvent(ev) {
  if (!currentDeck) return;

  // Prefer Clipboard API items
  const items = ev.clipboardData?.items;
  if (!items) return;

  for (const it of items) {
    if (it.type && it.type.startsWith("image/")) {
      const blob = it.getAsFile();
      if (blob) {
        const dataUrl = await readFileAsDataURL(blob);
        setImageDataUrl(dataUrl);
        toast("Image pasted");
        ev.preventDefault();
        return;
      }
    }
  }
}

// --- CRUD actions ---
async function loadDeckIntoEditor(id) {
  if (dirty) {
    // best-effort auto-save before switching
    await saveCurrentDeck(true);
  }

  const d = await getDeck(id);
  if (!d) return;

  currentId = id;
  currentDeck = d;

  deckNameEl.value = d.name || "";
  deckTextEl.value = d.rawText || "";

  refreshHintsFromText();
  updateImageUI();
  showEditor(true);
  refreshStatsData();
  setActiveView(activeView);

  setDirty(false);
  await refreshList();
}

async function refreshList() {
  const q = (searchEl.value || "").trim().toLowerCase();
  const decks = await getAllDecks();
  const filtered = q
    ? decks.filter((d) => (d.name || "").toLowerCase().includes(q))
    : decks;
  renderDeckList(filtered, currentId);
}

async function newDeck() {
  if (dirty) await saveCurrentDeck(true);

  const id = genId();
  const deck = {
    id,
    name: "New deck",
    rawText: "",
    imageDataUrl: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await putDeck(deck);
  toast("Deck created");
  await loadDeckIntoEditor(id);
}

async function saveCurrentDeck(silent = false) {
  if (!currentDeck) return false;

  currentDeck.name = deckNameEl.value.trim() || "Untitled deck";
  currentDeck.rawText = deckTextEl.value;
  currentDeck.updatedAt = nowISO();

  await putDeck(currentDeck);
  setDirty(false);
  if (!silent) toast("Saved");
  await refreshList();
  return true;
}

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

async function duplicateCurrentDeck() {
  if (!currentDeck) return;
  const copy = structuredClone(currentDeck);
  copy.id = genId();
  copy.name = (currentDeck.name || "Deck") + " (copy)";
  copy.createdAt = nowISO();
  copy.updatedAt = nowISO();
  await putDeck(copy);
  toast("Duplicated");
  await loadDeckIntoEditor(copy.id);
}

// --- Backup import/export ---
async function exportAll() {
  const decks = await getAllDecks();
  const payload = {
    kind: "ptcg-tools-deck-backup",
    version: 1,
    exportedAt: nowISO(),
    decks,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ptcg-tools-decks-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup exported");
}

async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data || data.kind !== "ptcg-tools-deck-backup" || !Array.isArray(data.decks)) {
    alert("Not a valid backup file.");
    return;
  }

  // Merge: keep ids if unique, otherwise generate new ids
  const existing = await getAllDecks();
  const existingIds = new Set(existing.map((d) => d.id));

  for (const d of data.decks) {
    const deck = {
      id: existingIds.has(d.id) ? genId() : d.id,
      name: d.name || "Imported deck",
      rawText: d.rawText || "",
      imageDataUrl: d.imageDataUrl || null,
      createdAt: d.createdAt || nowISO(),
      updatedAt: nowISO(),
    };
    await putDeck(deck);
  }

  toast("Backup imported");
  await refreshList();
}

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
