// Decklist Manager (static GitHub Pages)
// Storage: IndexedDB (decks persist between visits on the same device)

const DB_NAME = "ptcg-tools-db";
const DB_VERSION = 1;
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

const btnExportAll = $("btnExportAll");
const importBackupFileEl = $("importBackupFile");

const toastEl = $("toast");

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

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("updatedAt", "updatedAt", { unique: false });
        os.createIndex("name", "name", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

deckNameEl.addEventListener("input", () => setDirty(true));
deckTextEl.addEventListener("input", () => {
  setDirty(true);
  refreshHintsFromText();
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

