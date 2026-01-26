// Swiss Tournament Manager (static)
// Storage: IndexedDB
// Pairing: points brackets, avoid rematches when possible, downpair if needed, bye if odd.
// Standings: Points, Opp Win %, OppOpp Win % (resistance-style). Byes excluded from Opp Win% averaging. :contentReference[oaicite:3]{index=3}

const DB_NAME = "ptcg-tools-db";
const DB_VERSION = 2;
const STORE = "tournaments";

let db;
let currentId = null;
let current = null;
let dirty = false;

const $ = (id) => document.getElementById(id);
const toastEl = $("toast");

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function nowISO(){ return new Date().toISOString(); }
function human(iso){ try { return new Date(iso).toLocaleString(); } catch { return iso; } }

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("decks")) {
        // keep compatibility if you already had decklists app using a "decks" store in v1
        d.createObjectStore("decks", { keyPath: "id" });
      }
      if (!d.objectStoreNames.contains(STORE)) {
        const os = d.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("updatedAt", "updatedAt", { unique: false });
        os.createIndex("name", "name", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode="readonly"){
  return db.transaction(store, mode).objectStore(store);
}

function genId(){
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

async function getAllTours(){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE).getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}
async function getTour(id){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function putTour(t){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE,"readwrite").put(t);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
async function delTour(id){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE,"readwrite").delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ---------- DOM refs ----------
const tourListEl = $("tourList");
const emptyEl = $("empty");
const paneEl = $("pane");

const filterFormatEl = $("filterFormat");
const filterTypeEl = $("filterType");
const filterRoundsEl = $("filterRounds");

const btnNew = $("btnNew");
const btnSave = $("btnSave");
const btnDelete = $("btnDelete");
const searchEl = $("search");

const tNameEl = $("tName");
const tFormatEl = $("tFormat");
const tTypeEl = $("tType");
const tRoundsEl = $("tRounds");
const savedHintEl = $("savedHint");

const tabBtns = Array.from(document.querySelectorAll(".tab"));
const tabPanes = {
  players: $("tab-players"),
  rounds: $("tab-rounds"),
  standings: $("tab-standings"),
};

const btnExport = $("btnExport");
const importFileEl = $("importFile");

const newPlayerNameEl = $("newPlayerName");
const btnAddPlayer = $("btnAddPlayer");
const btnAddPlayer2 = $("btnAddPlayer2");
const playerListEl = $("playerList");

const playerEmptyEl = $("playerEmpty");
const playerPaneEl = $("playerPane");
const pNameEl = $("pName");
const pDeckTextEl = $("pDeckText");
const pDeckImageFileEl = $("pDeckImageFile");
const btnRemovePlayer = $("btnRemovePlayer");
const btnCopyLimitless = $("btnCopyLimitless");
const btnOpenImgGen = $("btnOpenImgGen");
const imgBoxEl = $("imgBox");
const imgEmptyEl = $("imgEmpty");
const imgPreviewEl = $("imgPreview");
const btnClearImg = $("btnClearImg");

const btnNewRound = $("btnNewRound");
const roundsListEl = $("roundsList");
const roundHintEl = $("roundHint");

const standingsTableBody = $("standingsTable").querySelector("tbody");

let selectedPlayerId = null;

// ---------- Helpers ----------
function showPane(show){
  if (show){
    emptyEl.classList.add("hidden");
    paneEl.classList.remove("hidden");
  } else {
    emptyEl.classList.remove("hidden");
    paneEl.classList.add("hidden");
  }
}

function isMatchComplete(m){
  if (m.bye) return true;
  return m.result === "P1" || m.result === "P2" || m.result === "T";
}

function isRoundComplete(r){
  return r.matches.every(isMatchComplete);
}

function completedRounds(){
  return current.rounds.filter(isRoundComplete);
}

function setDirty(v){
  dirty = v;
  if (!current) return;
  const base = `Saved: ${human(current.updatedAt)}`;
  savedHintEl.textContent = dirty ? `${base} • (unsaved changes)` : base;
}

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function shortAge(iso){
  try {
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime())/60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins/60);
    if (hrs < 48) return `${hrs}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
  } catch { return ""; }
}

function readInt(el, fallback){
  const n = Math.floor(Number(el.value));
  return Number.isFinite(n) ? n : fallback;
}

async function copyToClipboard(text){
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
    return true;
  } catch {
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
      toast("Copy failed");
      return false;
    }
  }
}

async function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = ()=> reject(r.error);
    r.readAsDataURL(file);
  });
}

// ---------- Decklist format (for ImgGen copy) ----------
const RE_PTCGL = /^(\d+)\s+(.+?)\s+\(([\w-]+)\s+([0-9]+[a-zA-Z]?)\)\s*$/;
const RE_LIMITLESS = /^(\d+)\s+(.+?)\s+([\w-]+)\s+([0-9]+[a-zA-Z]?)\s*$/;

function isHeaderLine(line){
  const s = line.trim();
  if (!s) return true;
  const low = s.toLowerCase();
  return ["pokémon:","pokemon:","trainer:","trainers:","energy:"].includes(low) || low.startsWith("total cards");
}

function toLimitlessText(rawText){
  const lines = String(rawText||"").replace(/\r\n/g,"\n").split("\n");
  const out = [];
  for (const l0 of lines){
    const l = l0.trim();
    if (isHeaderLine(l)) continue;
    let m = l.match(RE_PTCGL);
    if (m){ out.push(`${m[1]} ${m[2]} ${m[3]} ${m[4]}`); continue; }
    m = l.match(RE_LIMITLESS);
    if (m){ out.push(`${m[1]} ${m[2]} ${m[3]} ${m[4]}`); continue; }
    if (l) out.push(l);
  }
  return out.join("\n").trim() + "\n";
}

// ---------- Domain model ----------
function blankTournament(){
  return {
    id: genId(),
    name: "New tournament",
    format: "Bo1",
    type: "Cup",
    roundsPlanned: 5,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    players: [], // {id,name,deckText,deckImageDataUrl}
    rounds: [],  // each: {roundNumber, matches:[{p1,p2,result:'', bye:false}]}
  };
}

// result options: "", "P1", "P2", "T", "BYE"
function pointsFor(match, playerId){
  if (match.bye && match.p1 === playerId) return 3;
  if (!match.result) return 0;
  if (match.result === "T") return 1;
  if (match.result === "P1") return match.p1 === playerId ? 3 : 0;
  if (match.result === "P2") return match.p2 === playerId ? 3 : 0;
  return 0;
}

function wltFor(match, playerId){
  if (match.bye && match.p1 === playerId) return {w:1,l:0,t:0};
  if (!match.result) return {w:0,l:0,t:0};
  if (match.result === "T") return {w:0,l:0,t:1};
  if (match.result === "P1") return match.p1 === playerId ? {w:1,l:0,t:0} : {w:0,l:1,t:0};
  if (match.result === "P2") return match.p2 === playerId ? {w:1,l:0,t:0} : {w:0,l:1,t:0};
  return {w:0,l:0,t:0};
}

function getPlayer(id){
  return current.players.find(p=>p.id===id) || null;
}

function allMatches(){
  const out = [];
  for (const r of completedRounds()){
    for (const m of r.matches) out.push({round:r.roundNumber, ...m});
  }
  return out;
}

function opponentsOf(playerId){
  const opps = [];
  for (const m of allMatches()){
    if (m.bye) continue; // byes excluded from opponent averaging :contentReference[oaicite:4]{index=4}
    if (m.p1 === playerId && m.p2) opps.push(m.p2);
    else if (m.p2 === playerId && m.p1) opps.push(m.p1);
  }
  return opps;
}

function record(playerId){
  let w=0,l=0,t=0, pts=0;
  for (const m of allMatches()){
    if (m.p1 !== playerId && m.p2 !== playerId) continue;
    const r = wltFor(m, playerId);
    w += r.w; l += r.l; t += r.t;
    pts += pointsFor(m, playerId);
  }
  return {w,l,t,pts};
}

// “Win %” used for resistance calculations.
// In Play! Pokémon ops guidance, opponent win% uses wins/rounds (with floors/caps; drops behave differently). :contentReference[oaicite:5]{index=5}
// MVP simplification for live events: win% = max(0.25, wins / roundsPlayedSoFar), capped at 1.0.
// (No drops handling yet; we can add a “dropped after round N” toggle later.)
function liveWinPct(playerId){
  const rec = record(playerId);
  const roundsPlayed = Math.max(1, rec.w + rec.l + rec.t); // ignore unplayed
  const raw = rec.w / roundsPlayed;
  return Math.max(0.25, Math.min(1.0, raw));
}

function oppWinPct(playerId){
  const opps = opponentsOf(playerId);
  if (!opps.length) return 0;
  const vals = opps.map(o=> liveWinPct(o));
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}

function oppOppWinPct(playerId){
  const opps = opponentsOf(playerId);
  if (!opps.length) return 0;
  const vals = opps.map(o=> oppWinPct(o));
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}

function standings(){
  const rows = current.players.map(p=>{
    const r = record(p.id);
    const ow = oppWinPct(p.id);
    const oow = oppOppWinPct(p.id);
    return {id:p.id, name:p.name, ...r, ow, oow};
  });
  rows.sort((a,b)=>{
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.ow !== a.ow) return b.ow - a.ow;
    if (b.oow !== a.oow) return b.oow - a.oow;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

function playedAgainst(a,b){
  for (const m of allMatches()){
    if (m.bye) continue;
    if ((m.p1===a && m.p2===b) || (m.p1===b && m.p2===a)) return true;
  }
  return false;
}

// ---------- Pairing ----------
function generateNextRound(){
  if (current.rounds.length){
  const last = current.rounds[current.rounds.length - 1];
  if (!isRoundComplete(last)){
    toast("Finish entering results for the current round first.");
    return;
  }
  const roundNumber = current.rounds.length + 1;
  const totalRounds = Math.max(1, current.roundsPlanned);
  if (roundNumber > totalRounds){
    toast("All rounds already generated");
    return;
  }
  if (current.players.length < 2){
    toast("Need at least 2 players");
    return;
  }

  // group by points (Swiss)
  const st = standings(); // already sorted by pts/tiebreakers, but pairing mostly by pts
  const byPts = new Map();
  for (const row of st){
    const arr = byPts.get(row.pts) || [];
    arr.push(row.id);
    byPts.set(row.pts, arr);
  }
  const ptsLevels = Array.from(byPts.keys()).sort((a,b)=>b-a);

  // Create a queue in descending point brackets
  const queue = [];
  for (const pts of ptsLevels){
    // shuffle within bracket slightly to reduce deterministic rematch issues
    const arr = byPts.get(pts);
    queue.push(...arr);
  }

  // If odd, assign bye to lowest points player without a previous bye (simple)
  const hadBye = new Set();
  for (const m of allMatches()){
    if (m.bye && m.p1) hadBye.add(m.p1);
  }
  let byePlayer = null;
  if (queue.length % 2 === 1){
    // lowest points = end of standings list
    const reversed = [...st].reverse();
    byePlayer = reversed.find(r => !hadBye.has(r.id))?.id || reversed[0].id;
    // remove byePlayer from queue
    const idx = queue.indexOf(byePlayer);
    if (idx >= 0) queue.splice(idx,1);
  }

  const unpaired = new Set(queue);
  const matches = [];

  function pickOpponent(p1){
    // prefer same points first, then downpair, avoid rematches
    const p1Pts = record(p1).pts;

    // candidates sorted by closeness of points
    const candidates = Array.from(unpaired).filter(id=>id!==p1);
    candidates.sort((a,b)=>{
      const da = Math.abs(record(a).pts - p1Pts);
      const db = Math.abs(record(b).pts - p1Pts);
      if (da !== db) return da - db;
      return (getPlayer(a)?.name||"").localeCompare(getPlayer(b)?.name||"");
    });

    // first pass: no rematch
    const noRematch = candidates.find(c => !playedAgainst(p1, c));
    return noRematch || candidates[0] || null;
  }

  for (const p1 of [...queue]){
    if (!unpaired.has(p1)) continue;
    unpaired.delete(p1);
    const p2 = pickOpponent(p1);
    if (p2){
      unpaired.delete(p2);
      matches.push({p1, p2, result:"", bye:false});
    } else {
      // should not happen
      matches.push({p1, p2:null, result:"BYE", bye:true});
    }
  }

  if (byePlayer){
    matches.push({p1: byePlayer, p2: null, result:"BYE", bye:true});
  }

  current.rounds.push({roundNumber, matches});
  current.updatedAt = nowISO();
  setDirty(true);
  toast(`Round ${roundNumber} generated`);
  renderRounds();
  renderStandings();
  updateRoundHint();
}

// ---------- Rendering ----------
async function refreshTourList(){
  const q = (searchEl.value||"").trim().toLowerCase();
  const fmt = (filterFormatEl?.value || "").trim();
  const typ = (filterTypeEl?.value || "").trim();
  const rnd = (filterRoundsEl?.value || "").trim();

  const tours = await getAllTours();

  const filtered = tours.filter(t => {
    if (q && !(t.name || "").toLowerCase().includes(q)) return false;
    if (fmt && (t.format || "") !== fmt) return false;
    if (typ && (t.type || "") !== typ) return false;
    if (rnd && String(t.roundsPlanned || "") !== rnd) return false;
    return true;
  });

  tourListEl.innerHTML = "";
  if (!filtered.length){
    tourListEl.innerHTML = `<div class="empty"><h2>No tournaments found</h2><p>Try clearing filters.</p></div>`;
    return;
  }

  for (const t of filtered){
    const div = document.createElement("div");
    div.className = "item" + (t.id===currentId ? " active":"");
    div.innerHTML = `
      <div class="name">${escapeHtml(t.name || "Untitled")}</div>
      <div class="meta">${escapeHtml(t.type||"")} • ${escapeHtml(t.format||"")} • ${escapeHtml(t.roundsPlanned||"—")} rounds • Updated ${escapeHtml(shortAge(t.updatedAt))}</div>
    `;
    div.addEventListener("click", ()=> loadTournament(t.id));
    tourListEl.appendChild(div);
  }
}

function renderTournamentFields(){
  tNameEl.value = current.name || "";
  tFormatEl.value = current.format || "Bo1";
  tTypeEl.value = current.type || "Cup";
  tRoundsEl.value = String(current.roundsPlanned || 5);
  setDirty(false);
}

function renderPlayers(){
  playerListEl.innerHTML = "";
  for (const p of current.players){
    const rec = record(p.id);
    const div = document.createElement("div");
    div.className = "pitem" + (p.id===selectedPlayerId ? " active":"");
    div.innerHTML = `
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="meta">${rec.w}-${rec.l}-${rec.t} • ${rec.pts} pts</div>
    `;
    div.addEventListener("click", ()=>{
      selectedPlayerId = p.id;
      renderSelectedPlayer();
      renderPlayers();
    });
    playerListEl.appendChild(div);
  }
  if (!current.players.length){
    playerListEl.innerHTML = `<div class="empty small">No players yet.</div>`;
  }
}

function updateImageUI(p){
  const has = !!p.deckImageDataUrl;
  if (!has){
    imgPreviewEl.src = "";
    imgPreviewEl.classList.add("hidden");
    imgEmptyEl.classList.remove("hidden");
  } else {
    imgPreviewEl.src = p.deckImageDataUrl;
    imgPreviewEl.classList.remove("hidden");
    imgEmptyEl.classList.add("hidden");
  }
}

function renderSelectedPlayer(){
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p){
    playerEmptyEl.classList.remove("hidden");
    playerPaneEl.classList.add("hidden");
    return;
  }
  playerEmptyEl.classList.add("hidden");
  playerPaneEl.classList.remove("hidden");
  pNameEl.value = p.name;
  pDeckTextEl.value = p.deckText || "";
  updateImageUI(p);
}

function renderRounds(){
  roundsListEl.innerHTML = "";
  if (!current.rounds.length){
    roundsListEl.innerHTML = `<div class="empty small">No rounds generated yet.</div>`;
    return;
  }
  for (const r of [...current.rounds].reverse()){
    const wrap = document.createElement("div");
    wrap.className = "round";
    wrap.innerHTML = `<h3 style="margin:0 0 10px;font-size:14px">Round ${r.roundNumber}</h3>`;

    r.matches.forEach((m, idx)=>{
      const p1 = getPlayer(m.p1)?.name || "—";
      const p2 = m.bye ? "BYE" : (getPlayer(m.p2)?.name || "—");

      const row = document.createElement("div");
      row.className = "match";

      const sel = document.createElement("select");
      sel.className = "result";
      sel.innerHTML = `
        <option value="">Pending</option>
        <option value="P1">${p1} wins</option>
        <option value="P2">${p2} wins</option>
        <option value="T">Tie</option>
        ${m.bye ? `<option value="BYE">BYE</option>` : ``}
      `;
      sel.value = m.bye ? "BYE" : (m.result || "");
      if (m.bye) sel.disabled = true;

      sel.addEventListener("change", ()=>{
        m.result = sel.value;
        current.updatedAt = nowISO();
        setDirty(true);
        renderPlayers();
        renderStandings();
      });

      row.innerHTML = `
        <div><strong>${escapeHtml(p1)}</strong></div>
        <div class="vs">vs</div>
        <div><strong>${escapeHtml(p2)}</strong></div>
      `;
      row.appendChild(sel);
      wrap.appendChild(row);
    });

    roundsListEl.appendChild(wrap);
  }
}

function pct(n){
  if (!Number.isFinite(n)) return "0.000";
  return (n*100).toFixed(1) + "%";
}

function renderStandings(){
  const rows = standings();
  standingsTableBody.innerHTML = "";
  rows.forEach((r, i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${r.w}</td><td>${r.l}</td><td>${r.t}</td>
      <td><strong>${r.pts}</strong></td>
      <td>${pct(r.ow)}</td>
      <td>${pct(r.oow)}</td>
    `;
    standingsTableBody.appendChild(tr);
  });
}

function updateRoundHint(){
  const done = completedRounds().length;
  roundHintEl.textContent = `Rounds: ${current.rounds.length}/${current.roundsPlanned} • Counted: ${done}`;
}

// ---------- Actions ----------
async function newTournament(){
  if (dirty) await saveTournament(true);
  current = blankTournament();
  currentId = current.id;
  selectedPlayerId = null;
  showPane(true);
  renderTournamentFields();
  renderPlayers();
  renderSelectedPlayer();
  renderRounds();
  renderStandings();
  updateRoundHint();
  await putTour(current);
  await refreshTourList();
  toast("Tournament created");
}

async function loadTournament(id){
  if (dirty) await saveTournament(true);
  const t = await getTour(id);
  if (!t) return;
  current = t;
  currentId = id;
  selectedPlayerId = null;
  showPane(true);
  renderTournamentFields();
  renderPlayers();
  renderSelectedPlayer();
  renderRounds();
  renderStandings();
  updateRoundHint();
  setDirty(false);
  await refreshTourList();
}

async function saveTournament(silent=false){
  if (!current) return;
  current.name = tNameEl.value.trim() || "Untitled tournament";
  current.format = tFormatEl.value;
  current.type = tTypeEl.value;
  current.roundsPlanned = Math.max(1, readInt(tRoundsEl, 5));
  current.updatedAt = nowISO();
  await putTour(current);
  setDirty(false);
  await refreshTourList();
  if (!silent) toast("Saved");
}

async function deleteTournament(){
  if (!current) return;
  const ok = confirm(`Delete "${current.name}"?`);
  if (!ok) return;
  await delTour(current.id);
  current = null;
  currentId = null;
  selectedPlayerId = null;
  showPane(false);
  await refreshTourList();
  toast("Deleted");
}

function addPlayer(name){
  const n = (name || "").trim();
  if (!n) return;
  current.players.push({id: genId(), name:n, deckText:"", deckImageDataUrl:null});
  current.updatedAt = nowISO();
  setDirty(true);
  newPlayerNameEl.value = "";
  renderPlayers();
}

function removeSelectedPlayer(){
  if (!current || !selectedPlayerId) return;
  const p = current.players.find(x=>x.id===selectedPlayerId);
  if (!p) return;
  const ok = confirm(`Remove "${p.name}"? (Matches involving them will remain in history; best to do this before Round 1.)`);
  if (!ok) return;
  current.players = current.players.filter(x=>x.id!==selectedPlayerId);
  selectedPlayerId = null;
  current.updatedAt = nowISO();
  setDirty(true);
  renderPlayers();
  renderSelectedPlayer();
  renderRounds();
  renderStandings();
}

// Export/import tournament(s)
async function exportData(){
  const tours = await getAllTours();
  const payload = {kind:"ptcg-tools-swiss-backup", version:1, exportedAt: nowISO(), tournaments: tours};
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ptcg-tools-swiss-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Exported");
}

async function importData(file){
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || data.kind !== "ptcg-tools-swiss-backup" || !Array.isArray(data.tournaments)){
    alert("Not a valid Swiss backup file.");
    return;
  }
  const existing = await getAllTours();
  const ids = new Set(existing.map(t=>t.id));
  for (const t of data.tournaments){
    const copy = structuredClone(t);
    if (ids.has(copy.id)) copy.id = genId();
    copy.updatedAt = nowISO();
    await putTour(copy);
  }
  toast("Imported");
  await refreshTourList();
}

// ---------- Tabs ----------
function setTab(name){
  tabBtns.forEach(b=> b.classList.toggle("active", b.dataset.tab===name));
  Object.entries(tabPanes).forEach(([k,el])=> el.classList.toggle("hidden", k!==name));
}
tabBtns.forEach(b=> b.addEventListener("click", ()=> setTab(b.dataset.tab)));

// ---------- Wire up ----------
btnNew.addEventListener("click", newTournament);
btnSave.addEventListener("click", ()=> saveTournament(false));
btnDelete.addEventListener("click", deleteTournament);
searchEl.addEventListener("input", refreshTourList);

[tNameEl,tRoundsEl].forEach(el => el.addEventListener("input", ()=> setDirty(true)));
[tFormatEl,tTypeEl].forEach(el => el.addEventListener("change", ()=> setDirty(true)));

btnAddPlayer.addEventListener("click", ()=> addPlayer(newPlayerNameEl.value));
btnAddPlayer2.addEventListener("click", ()=> addPlayer(newPlayerNameEl.value));
newPlayerNameEl.addEventListener("keydown", (e)=>{ if (e.key==="Enter") addPlayer(newPlayerNameEl.value); });

btnRemovePlayer.addEventListener("click", removeSelectedPlayer);

[filterFormatEl, filterTypeEl, filterRoundsEl].forEach(el => {
  el.addEventListener("change", refreshTourList);
});

// Player editing
pNameEl.addEventListener("input", ()=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  p.name = pNameEl.value;
  current.updatedAt = nowISO();
  setDirty(true);
  renderPlayers();
});
pDeckTextEl.addEventListener("input", ()=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  p.deckText = pDeckTextEl.value;
  current.updatedAt = nowISO();
  setDirty(true);
});
pDeckImageFileEl.addEventListener("change", async ()=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  const f = pDeckImageFileEl.files?.[0];
  if (!f) return;
  p.deckImageDataUrl = await readFileAsDataURL(f);
  pDeckImageFileEl.value = "";
  current.updatedAt = nowISO();
  setDirty(true);
  updateImageUI(p);
  toast("Image attached");
});
btnClearImg.addEventListener("click", ()=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  p.deckImageDataUrl = null;
  current.updatedAt = nowISO();
  setDirty(true);
  updateImageUI(p);
  toast("Image cleared");
});

imgBoxEl.addEventListener("paste", async (ev)=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  const items = ev.clipboardData?.items;
  if (!items) return;
  for (const it of items){
    if (it.type?.startsWith("image/")){
      const blob = it.getAsFile();
      if (blob){
        p.deckImageDataUrl = await readFileAsDataURL(blob);
        current.updatedAt = nowISO();
        setDirty(true);
        updateImageUI(p);
        toast("Image pasted");
        ev.preventDefault();
        return;
      }
    }
  }
});

btnCopyLimitless.addEventListener("click", async ()=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  await copyToClipboard(toLimitlessText(p.deckText || ""));
});
btnOpenImgGen.addEventListener("click", async ()=>{
  const p = selectedPlayerId ? current.players.find(x=>x.id===selectedPlayerId) : null;
  if (!p) return;
  await copyToClipboard(toLimitlessText(p.deckText || ""));
  window.open("https://limitlesstcg.com/tools/imggen", "_blank", "noopener,noreferrer");
});

btnNewRound.addEventListener("click", ()=>{
  generateNextRound();
});

btnExport.addEventListener("click", exportData);
importFileEl.addEventListener("change", async ()=>{
  const f = importFileEl.files?.[0];
  if (!f) return;
  try { await importData(f); }
  catch(e){ alert("Import failed: " + (e?.message || e)); }
  finally { importFileEl.value = ""; }
});

// ---------- Init ----------
(async function init(){
  db = await openDB();
  await refreshTourList();
  const tours = await getAllTours();
  if (tours.length){
    await loadTournament(tours[0].id);
  } else {
    showPane(false);
  }
  setTab("players");
})().catch(e=>{
  console.error(e);
  alert("Failed to start: " + (e?.message || e));
});

