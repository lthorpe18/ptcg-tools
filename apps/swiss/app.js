// Swiss Tournament Manager (static, vanilla)
// - Library screen (list / import / export)
// - Tournament screen (run / players / standings / top cut)
// Storage: IndexedDB (ptcg-tools-db / tournaments)
// Pairing modes: Swiss, Round robin
// Cup: optional Top Cut after Swiss concludes
// Round timer: default 30m (Bo1) / 50m (Bo3)

const DB_NAME = "ptcg-tools-db";
const DB_VERSION = 2;
const STORE = "tournaments";

const $ = (id) => document.getElementById(id);

let db;
let tournaments = [];

let currentId = null;
let current = null;

let selectedPlayerId = null;

// Round editing (draft results that don't affect standings until saved)
let editingRoundKey = null; // {phase, index}
let roundDraft = null;      // {results:[], dirty:boolean}

// Timer tick
let timerInterval = null;


// Notifications (best-effort while app is running)
let notifTimeouts = [];
// Wake Lock (best-effort; iOS support varies)
let wakeLockSentinel = null;


const toastEl = $("toast");
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function nowISO(){ return new Date().toISOString(); }
function human(iso){ try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function genId(){
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2));
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath:"id" });
        os.createIndex("updatedAt","updatedAt",{ unique:false });
        os.createIndex("name","name",{ unique:false });
      }
      // Keep compatibility with other apps which use "decks"
      if (!db.objectStoreNames.contains("decks")){
        const os = db.createObjectStore("decks", { keyPath:"id" });
        os.createIndex("updatedAt","updatedAt",{ unique:false });
        os.createIndex("name","name",{ unique:false });
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
function tx(store, mode="readonly"){
  return db.transaction(store, mode).objectStore(store);
}

async function dbGetAll(){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE).getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  });
}
async function dbGet(id){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE).get(id);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> reject(req.error);
  });
}
async function dbPut(obj){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE,"readwrite").put(obj);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}
async function dbDelete(id){
  return new Promise((resolve,reject)=>{
    const req = tx(STORE,"readwrite").delete(id);
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

// ---------- Screens / Tabs ----------
function showScreen(name){
  $("screenLibrary").classList.toggle("hidden", name !== "library");
  $("screenTournament").classList.toggle("hidden", name !== "tournament");

  $("libraryActions").classList.toggle("hidden", name !== "library");

  // stop timer tick UI updates on library (but keep running timer state)
  if (name === "library"){
    stopTimerIntervalUI();
    // Don’t keep the device awake on the library screen
    releaseWakeLock();
    if (clockOverlayVisible()) hideClockOverlay();
  } else {
    startTimerIntervalUI();
    syncWakeLock();
  }
}

function setActiveTab(tab){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(b=> b.classList.toggle("active", b.dataset.tab === tab));
  const panes = ["rounds","players","standings","topcut"];
  panes.forEach(p=>{
    const el = $("tab-" + p);
    if (!el) return;
    el.classList.toggle("hidden", p !== tab);
  });
}

// ---------- Tournament model helpers ----------
function defaultTimerSec(format){
  return (format === "Bo3" ? 50*60 : 30*60);
}

function blankTournament(){
  const id = genId();
  return {
    id,
    name: "New tournament",
    format: "Bo1",
    type: "Cup",
    pairingMode: "swiss",        // "swiss" | "round_robin"
    roundsPlanned: 5,            // used for swiss only
    topCut: { size: 8, started: false }, // cup only
    rrSchedule: null,            // round robin schedule (array of rounds)
    timer: {
      durationSec: defaultTimerSec("Bo1"),
      remainingSec: defaultTimerSec("Bo1"),
      endsAt: null,
      running: false,
      autoStart: false,
      custom: false,
      notify: { at10: false, at5: false, at0: false },
      keepAwake: false,
      showClock: false
    },
    players: [],
    rounds: [], // includes swiss and topcut rounds
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

function ensureDefaults(t){
  if (!t.pairingMode) t.pairingMode = "swiss";
  if (!t.roundsPlanned) t.roundsPlanned = 5;
  if (!t.topCut) t.topCut = { size: 8, started: false };
  if (t.rrSchedule === undefined) t.rrSchedule = null;
  if (!t.timer){
    const sec = defaultTimerSec(t.format || "Bo1");
    t.timer = { durationSec: sec, remainingSec: sec, endsAt: null, running:false, endsAt:null, autoStart:false, custom:false };
  }
  if (t.timer.durationSec == null){
    const sec = defaultTimerSec(t.format || "Bo1");
    t.timer.durationSec = sec;
  }
  if (t.timer.remainingSec == null) t.timer.remainingSec = t.timer.durationSec;
  if (t.timer.autoStart == null) t.timer.autoStart = false;
  if (t.timer.custom == null) t.timer.custom = false;
  if (!t.timer.notify) t.timer.notify = { at10:false, at5:false, at0:false };
  if (t.timer.keepAwake == null) t.timer.keepAwake = false;
  if (t.timer.showClock == null) t.timer.showClock = false;

  // phase defaults
  for (const r of (t.rounds || [])){
    if (!r.phase) r.phase = "swiss";
    if (!r.label){
      r.label = (r.phase === "swiss" ? `Round ${r.roundNumber}` : `Top cut`);
    }
  }
  return t;
}

function swissRounds(){
  return (current?.rounds || []).filter(r => (r.phase || "swiss") === "swiss");
}
function topCutRounds(){
  return (current?.rounds || []).filter(r => (r.phase || "swiss") === "topcut");
}
function isMatchComplete(m){
  if (m.bye) return true;
  return m.result === "P1" || m.result === "P2" || m.result === "T";
}
function isRoundComplete(r){
  return r.matches.every(isMatchComplete);
}
function completedSwissRounds(){
  return swissRounds().filter(isRoundComplete);
}
function allSwissMatches(){
  const out = [];
  for (const r of completedSwissRounds()){
    for (const m of r.matches) out.push({ round: r.roundNumber, ...m });
  }
  return out;
}

function getPlayer(id){
  return current.players.find(p=>p.id===id) || null;
}

// Points / WLT (Swiss only)
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
function record(playerId){
  let w=0,l=0,t=0, pts=0;
  for (const m of allSwissMatches()){
    if (m.p1 !== playerId && m.p2 !== playerId) continue;
    const r = wltFor(m, playerId);
    w += r.w; l += r.l; t += r.t;
    pts += pointsFor(m, playerId);
  }
  return {w,l,t,pts};
}
function opponentsOf(playerId){
  const opps = [];
  for (const m of allSwissMatches()){
    if (m.bye) continue;
    if (m.p1 === playerId && m.p2) opps.push(m.p2);
    else if (m.p2 === playerId && m.p1) opps.push(m.p1);
  }
  return opps;
}
// resistance-like win%: max(0.25, wins/roundsPlayed), capped
function liveWinPct(playerId){
  const rec = record(playerId);
  const roundsPlayed = Math.max(1, rec.w + rec.l + rec.t);
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
    return { id:p.id, name:p.name, ...r, ow, oow };
  });
  rows.sort((a,b)=>{
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.ow !== a.ow) return b.ow - a.ow;
    if (b.oow !== a.oow) return b.oow - a.oow;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

function swissIsComplete(){
  const planned = plannedSwissRounds();
  return completedSwissRounds().length >= planned && planned > 0;
}
function plannedSwissRounds(){
  if (current.pairingMode === "round_robin"){
    const n = current.players.length;
    if (n <= 1) return 0;
    return (n % 2 === 0) ? (n - 1) : n; // circle method
  }
  return Number(current.roundsPlanned || 0);
}

// ---------- Round Robin schedule ----------
function buildRoundRobinSchedule(playerIds){
  let ids = [...playerIds];
  if (ids.length < 2) return [];
  const odd = (ids.length % 2 === 1);
  if (odd) ids.push(null); // bye slot

  const n = ids.length;
  const rounds = (n % 2 === 0) ? (n - 1) : n;
  const half = n / 2;

  let arr = ids.slice(); // working
  const schedule = [];

  for (let r=0; r<rounds; r++){
    const matches = [];
    for (let i=0; i<half; i++){
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a == null && b == null) continue;
      if (a == null || b == null){
        const p = (a == null ? b : a);
        matches.push({ p1: p, p2: null, result: null, bye: true });
      } else {
        matches.push({ p1: a, p2: b, result: null, bye: false });
      }
    }

    schedule.push({ roundNumber: r+1, matches });

    // rotate (keep first fixed)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  return schedule;
}

// ---------- Swiss pairing helpers ----------
function havePlayed(a,b){
  for (const m of allSwissMatches()){
    if (m.bye) continue;
    if ((m.p1===a && m.p2===b) || (m.p1===b && m.p2===a)) return true;
  }
  return false;
}
function hadBye(playerId){
  for (const m of allSwissMatches()){
    if (m.bye && m.p1 === playerId) return true;
  }
  return false;
}
function shuffle(arr){
  for (let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

// ---------- Top cut ----------
function eligibleForTopCutSize(size){
  return current.players.length >= size;
}
function topCutStageLabel(size){
  if (size === 16) return ["R16","QF","SF","F"];
  if (size === 8) return ["QF","SF","F"];
  if (size === 4) return ["SF","F"];
  return ["F"];
}
function seedPairs(ids){
  // ids are ordered 1..N
  const n = ids.length;
  const pairs = [];
  for (let i=0; i<n/2; i++){
    pairs.push([ids[i], ids[n-1-i]]);
  }
  return pairs;
}
function startTopCut(){
  const size = Number(current.topCut?.size || 8);
  if (!eligibleForTopCutSize(size)){
    toast(`Need at least ${size} players for top cut.`);
    return;
  }
  if (!swissIsComplete()){
    toast("Swiss isn't complete yet.");
    return;
  }

  const seeds = standings().slice(0, size).map(r=>r.id);
  const stage = topCutStageLabel(size)[0];
  const pairs = seedPairs(seeds);
  const matches = pairs.map(([a,b]) => ({ p1:a, p2:b, result:null, bye:false }));

  current.rounds.push({
    phase: "topcut",
    roundNumber: topCutRounds().length + 1,
    label: stage,
    matches
  });

  current.topCut.started = true;
  editingRoundKey = { phase:"topcut", index: topCutRounds().length - 1 };
  roundDraft = { results: matches.map(_=>""), dirty:false };

  setTopCutTabVisibility(true);
  setActiveTab("topcut");
  resetTimerForNewRound();
  if (current.timer.autoStart) startTimer();

  saveCurrent();
  renderAll();
  toast("Top cut started.");
}

function advanceTopCutIfPossible(){
  // If last topcut round is complete, create next stage with winners
  const rounds = topCutRounds();
  if (!rounds.length) return;
  const last = rounds[rounds.length - 1];
  if (!isRoundComplete(last)) return;

  // Determine remaining bracket size
  const sizeStart = Number(current.topCut?.size || 8);
  const stages = topCutStageLabel(sizeStart);
  const nextStage = stages[rounds.length]; // 0-based
  if (!nextStage) return; // finished

  const winners = [];
  for (const m of last.matches){
    if (m.result === "P1") winners.push(m.p1);
    else if (m.result === "P2") winners.push(m.p2);
  }
  if (winners.length < 2) return;

  const pairs = seedPairs(winners); // keep bracket order from prior pairing
  const matches = pairs.map(([a,b]) => ({ p1:a, p2:b, result:null, bye:false }));

  current.rounds.push({
    phase:"topcut",
    roundNumber: rounds.length + 1,
    label: nextStage,
    matches
  });

  editingRoundKey = { phase:"topcut", index: rounds.length }; // new last index
  roundDraft = { results: matches.map(_=>""), dirty:false };

  resetTimerForNewRound();
  if (current.timer.autoStart) startTimer();

  saveCurrent();
  renderAll();
  toast(`Generated ${nextStage}.`);
}

// ---------- Timer ----------
function formatMMSS(sec){
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2,"0") + ":" + String(r).padStart(2,"0");
}


// ---------- Timer extras: notifications, wake lock, full-screen clock ----------
function cancelScheduledNotifications(){
  for (const id of notifTimeouts) clearTimeout(id);
  notifTimeouts = [];
}

async function ensureNotificationPermission(){
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try{
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }catch{
    return false;
  }
}

function currentRoundLabel(){
  if (!current?.rounds?.length) return "Round";
  const r = current.rounds[current.rounds.length - 1];
  return (r.phase === "topcut") ? (r.label || "Top cut") : `Round ${r.roundNumber}`;
}

async function scheduleNotifications({allowRequest=false} = {}){
  cancelScheduledNotifications();
  if (!current?.timer?.running) return;

  const notify = current.timer.notify || {};
  const wantAny = !!(notify.at10 || notify.at5 || notify.at0);
  if (!wantAny) return;

  if (!("Notification" in window)){
    // silently ignore
    return;
  }

  if (Notification.permission !== "granted"){
    if (!allowRequest) return;
    const ok = await ensureNotificationPermission();
    if (!ok){
      toast("Notifications not enabled.");
      return;
    }
  }

  const remaining = computeRemainingSec();
  const label = currentRoundLabel();
  const title = "PTCG Tools";

  function scheduleIn(secondsFromNow, body){
    if (secondsFromNow < 0) return;
    const id = setTimeout(()=>{
      try{
        new Notification(title, { body });
      }catch{}
    }, secondsFromNow * 1000);
    notifTimeouts.push(id);
  }

  if (notify.at10 && remaining > 10*60){
    scheduleIn(remaining - 10*60, `${label}: 10 minutes remaining`);
  }
  if (notify.at5 && remaining > 5*60){
    scheduleIn(remaining - 5*60, `${label}: 5 minutes remaining`);
  }
  if (notify.at0 && remaining > 0){
    scheduleIn(remaining, `${label}: time in round`);
  }
}

async function requestWakeLock(){
  if (!current?.timer?.keepAwake) return;
  if (!current.timer.running) return;
  if (document.visibilityState !== "visible") return;
  if (!("wakeLock" in navigator)) return;
  try{
    if (wakeLockSentinel) return;
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", ()=>{ wakeLockSentinel = null; });
  }catch{
    // ignore
  }
}
function releaseWakeLock(){
  if (wakeLockSentinel){
    try{ wakeLockSentinel.release(); }catch{}
    wakeLockSentinel = null;
  }
}
function syncWakeLock(){
  if (!current?.timer?.keepAwake) { releaseWakeLock(); return; }
  if (current.timer.running) requestWakeLock(); else releaseWakeLock();
}

function showClockOverlay(){
  if (!current?.timer?.showClock) return;
  $("clockOverlay").classList.remove("hidden");
  $("clockOverlay").setAttribute("aria-hidden","false");
  updateClockOverlay();
}
function hideClockOverlay(){
  $("clockOverlay").classList.add("hidden");
  $("clockOverlay").setAttribute("aria-hidden","true");
  // Return to Run tab and reveal results input
  try{ setActiveTab("run"); }catch{}
  setTimeout(()=>{ scrollToRoundEditor(); }, 50);
}
function clockOverlayVisible(){
  return !$("clockOverlay").classList.contains("hidden");
}
function updateClockOverlay(){
  if (!$("clockOverlay") || !clockOverlayVisible()) return;
  $("clockTime").textContent = formatMMSS(computeRemainingSec());
  $("clockSub").textContent = `${currentRoundLabel()} • Tap anywhere to return`;
}

function scrollToRoundEditor(){
  const list = $("roundsList");
  if (!list) return;
  // Prefer the currently-editing round if present
  const el =
    list.querySelector(".roundstatus.editing")?.closest(".round") ||
    list.querySelector(".roundstatus:not(.complete)")?.closest(".round") ||
    list.querySelector(".round");
  if (el) el.scrollIntoView({behavior:"smooth", block:"start"});
}
// ---------- Timer helpers ----------
function computeRemainingSec(){
  if (!current?.timer) return 0;
  if (current.timer.running && current.timer.endsAt){
    const ms = current.timer.endsAt - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  }
  return Math.max(0, Math.floor(current.timer.remainingSec || 0));
}

function renderTimer(){
  if (!current) return;
  const remaining = computeRemainingSec();
  $("timerDisplay").textContent = formatMMSS(remaining);
  $("btnTimerStartPause").textContent = (current.timer.running ? "Pause" : "Start");
  updateClockOverlay();
}

async function startTimer(){
  if (!current) return;
  const remaining = computeRemainingSec();
  if (remaining <= 0){
    // reset to duration
    current.timer.remainingSec = current.timer.durationSec;
  }
  current.timer.running = true;
  const rem = computeRemainingSec();
  current.timer.endsAt = Date.now() + rem*1000;
  saveCurrent(true);
  renderTimer();
  syncWakeLock();
  // Request permission only on an explicit user action (Start)
  scheduleNotifications({allowRequest:true});
}
function pauseTimer(){
  if (!current) return;
  current.timer.remainingSec = computeRemainingSec();
  current.timer.running = false;
  current.timer.endsAt = null;
  cancelScheduledNotifications();
  saveCurrent(true);
  renderTimer();
  syncWakeLock();
}
function resetTimer(){
  if (!current) return;
  current.timer.running = false;
  current.timer.endsAt = null;
  current.timer.remainingSec = current.timer.durationSec;
  cancelScheduledNotifications();
  saveCurrent(true);
  renderTimer();
  syncWakeLock();
}
function toggleTimer(){
  if (!current) return;
  if (current.timer.running) pauseTimer(); else startTimer();
}
function resetTimerForNewRound(){
  if (!current) return;
  current.timer.running = false;
  current.timer.endsAt = null;
  current.timer.remainingSec = current.timer.durationSec;
  cancelScheduledNotifications();
  syncWakeLock();
}
function startTimerIntervalUI(){
  stopTimerIntervalUI();
  timerInterval = setInterval(()=>{
    if (!current) return;
    if (current.timer.running){
      const rem = computeRemainingSec();
      if (rem <= 0){
        // time up
        current.timer.running = false;
        current.timer.endsAt = null;
        current.timer.remainingSec = 0;
        cancelScheduledNotifications();
        saveCurrent(true);
        toast("Time!");
        syncWakeLock();
      }
    }
    renderTimer();
  }, 500);
}
function stopTimerIntervalUI(){
  if (timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------- Rendering (Library) ----------
function applyFilters(list){
  const q = ($("search").value || "").trim().toLowerCase();
  const fFormat = $("filterFormat").value;
  const fType = $("filterType").value;
  const fRounds = $("filterRounds").value;

  return list.filter(t=>{
    if (q && !(t.name || "").toLowerCase().includes(q)) return false;
    if (fFormat && t.format !== fFormat) return false;
    if (fType && t.type !== fType) return false;
    if (fRounds){
      const planned = Number((t.pairingMode === "round_robin")
        ? ((t.players?.length||0) <= 1 ? 0 : ((t.players.length % 2 === 0) ? t.players.length - 1 : t.players.length))
        : (t.roundsPlanned||0));
      if (planned !== Number(fRounds)) return false;
    }
    return true;
  });
}

function renderTourList(){
  const listEl = $("tourList");
  listEl.innerHTML = "";

  const filtered = applyFilters(tournaments);
  const empty = $("empty");
  empty.classList.toggle("hidden", tournaments.length !== 0);

  if (!filtered.length){
    if (tournaments.length){
      listEl.innerHTML = `<div class="empty">No tournaments match your filters.</div>`;
    }
    return;
  }

  for (const t of filtered.sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""))){
    const item = document.createElement("div");
    item.className = "item";
    item.tabIndex = 0;

    const left = document.createElement("div");
    left.innerHTML = `<div class="name">${escapeHtml(t.name || "Untitled")}</div>
                      <div class="meta">${escapeHtml(t.type || "—")} • ${escapeHtml(t.format || "—")} • ${plannedText(t)} • Updated ${escapeHtml(timeAgo(t.updatedAt))}</div>`;

    const right = document.createElement("div");
    right.className = "right";
    right.innerHTML = `<span class="pill">${escapeHtml((t.pairingMode === "round_robin") ? "Round robin" : "Swiss")}</span>`;

    item.appendChild(left);
    item.appendChild(right);

    item.addEventListener("click", ()=> openTournament(t.id));
    item.addEventListener("keydown", (e)=>{ if (e.key==="Enter"||e.key===" "){ e.preventDefault(); openTournament(t.id); }});

    listEl.appendChild(item);
  }
}

function plannedText(t){
  if ((t.pairingMode || "swiss") === "round_robin"){
    const n = (t.players||[]).length;
    const rounds = (n<=1) ? 0 : ((n%2===0)?(n-1):n);
    return `${rounds} rounds`;
  }
  return `${Number(t.roundsPlanned||0)} rounds`;
}

function timeAgo(iso){
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms/60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h/24);
  return `${d}d ago`;
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>(
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
  ));
}

// ---------- Rendering (Tournament) ----------
function renderTournamentHeader(){
  if (!current) return;
  $("tourTitle").textContent = current.name || "Tournament";
  $("tourMeta").textContent = `${current.type} • ${current.format} • ${current.pairingMode === "round_robin" ? "Round robin" : (plannedSwissRounds()+" rounds")}`;
  renderTimer();
}

function renderRounds(){
  const list = $("roundsList");
  list.innerHTML = "";

  if (!current) return;

  const rounds = current.rounds || [];
  if (!rounds.length){
    list.innerHTML = `<div class="muted">No rounds yet. Add players, then generate pairings.</div>`;
    return;
  }

  for (let i=0; i<rounds.length; i++){
    const r = rounds[i];
    const phase = r.phase || "swiss";
    const isComplete = isRoundComplete(r);
    const key = { phase, index: i };
    const isEditing = editingRoundKey && editingRoundKey.index === i && editingRoundKey.phase === phase;
    const wrap = document.createElement("div");
    wrap.className = "round";

    const head = document.createElement("div");
    head.className = "roundhead";

    const title = document.createElement("div");
    title.className = "roundtitle";
    const h4 = document.createElement("h4");
    h4.textContent = (phase === "swiss") ? `Round ${r.roundNumber}` : `${r.label}`;
    title.appendChild(h4);

    const status = document.createElement("span");
    status.className = "roundstatus" + (isComplete ? " complete" : "") + (isEditing ? " editing" : "");
    status.textContent = isEditing ? "Editing (draft)" : (isComplete ? "Complete" : "In progress");
    title.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "roundactions";

    if (isEditing){
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "accent smallbtn";
      saveBtn.textContent = "Save round";
      saveBtn.addEventListener("click", saveEditRound);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "ghost smallbtn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelEditRound);

      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
    } else {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "ghost smallbtn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", ()=> startEditRound(key));
      actions.appendChild(editBtn);
    }

    head.appendChild(title);
    head.appendChild(actions);
    wrap.appendChild(head);

    const matchesEl = document.createElement("div");
    matchesEl.className = "matches";

    const results = isEditing ? roundDraft.results : r.matches.map(m => (m.bye ? "BYE" : (m.result || "")));

    r.matches.forEach((m, mi)=>{
      const row = document.createElement("div");
      row.className = "match";

      const p1 = getPlayer(m.p1)?.name || "—";
      const p2 = m.bye ? "BYE" : (getPlayer(m.p2)?.name || "—");

      const left = document.createElement("div");
      left.textContent = p1;

      const vs = document.createElement("div");
      vs.className = m.bye ? "bye" : "vs";
      vs.textContent = m.bye ? "BYE" : "vs";

      const right = document.createElement("div");
      right.textContent = p2;

      row.appendChild(left);
      row.appendChild(vs);
      row.appendChild(right);

      if (isEditing){
        const sel = document.createElement("select");
        sel.dataset.mi = String(mi);

        // Swiss allows ties; Top cut doesn't
        const allowTie = (phase === "swiss");

        sel.innerHTML = `
          <option value=""></option>
          <option value="P1">${escapeHtml(p1)} wins</option>
          <option value="P2">${escapeHtml(p2)} wins</option>
          ${allowTie && !m.bye ? `<option value="T">Tie</option>` : ``}
        `;
        if (m.bye) sel.innerHTML = `<option value="BYE">BYE</option>`;
        sel.value = results[mi] || "";

        sel.addEventListener("change", ()=>{
          roundDraft.results[mi] = sel.value;
          roundDraft.dirty = true;
        });

        row.appendChild(sel);
      } else {
        const pill = document.createElement("div");
        pill.className = "pill";
        pill.textContent = resultLabel(phase, m, results[mi], p1, p2);
        row.appendChild(pill);
      }

      matchesEl.appendChild(row);
    });

    wrap.appendChild(matchesEl);
    list.appendChild(wrap);
  }
}

function resultLabel(phase, match, res, p1, p2){
  if (match.bye) return "BYE";
  if (!res) return "—";
  if (res === "T") return "Tie";
  if (res === "P1") return `${p1} wins`;
  if (res === "P2") return `${p2} wins`;
  return "—";
}

function startEditRound(key){
  const r = current.rounds[key.index];
  if (!r) return;

  if (roundDraft?.dirty && !(editingRoundKey && editingRoundKey.index === key.index && editingRoundKey.phase === key.phase)){
    const ok = confirm("Discard unsaved changes to the currently edited round?");
    if (!ok) return;
  }

  editingRoundKey = { phase: key.phase, index: key.index };
  roundDraft = {
    results: r.matches.map(m => (m.bye ? "BYE" : (m.result || ""))),
    dirty: false
  };

  renderRounds();
  toast(`Editing ${r.phase === "topcut" ? r.label : "Round " + r.roundNumber}`);
}

function saveEditRound(){
  if (!editingRoundKey || !roundDraft) return;
  const r = current.rounds[editingRoundKey.index];
  if (!r) return;

  // Apply results into round
  for (let i=0; i<r.matches.length; i++){
    const m = r.matches[i];
    const v = roundDraft.results[i] || "";
    if (m.bye){
      m.result = null;
    } else {
      m.result = (v === "P1" || v === "P2" || v === "T") ? v : null;
    }
  }

  editingRoundKey = null;
  roundDraft = null;

  // If top cut round completed, auto-generate next stage prompt (user still presses generate next topcut from UI)
  if ((r.phase || "swiss") === "topcut"){
    // after saving, if complete, attempt to auto-advance
    if (isRoundComplete(r)) advanceTopCutIfPossible();
  }

  saveCurrent();
  renderAll();
  toast("Round saved.");
}

function cancelEditRound(){
  editingRoundKey = null;
  roundDraft = null;
  renderRounds();
  toast("Draft cancelled.");
}

function renderRoundHint(){
  const counted = completedSwissRounds().length;
  const planned = plannedSwissRounds();
  $("roundHint").textContent = `Rounds: ${Math.min(swissRounds().length, planned)}/${planned} • Counted: ${counted}`;
}

function renderPlayers(){
  const list = $("playerList");
  list.innerHTML = "";

  if (!current.players.length){
    list.innerHTML = `<div class="muted">No players yet.</div>`;
  }

  for (const p of current.players){
    const row = document.createElement("div");
    row.className = "player" + (p.id === selectedPlayerId ? " active" : "");
    row.addEventListener("click", ()=>{
      selectedPlayerId = p.id;
      renderPlayers();
      renderSelectedPlayer();
    });

    const main = document.createElement("div");
    main.innerHTML = `<div class="pname">${escapeHtml(p.name)}</div>
                      <div class="psub">${p.deckText ? "Deck added" : "No deck"}</div>`;

    const btns = document.createElement("div");
    btns.className = "pbtns";

    row.appendChild(main);
    row.appendChild(btns);
    list.appendChild(row);
  }

  // update remove button state
  $("btnRemovePlayer").disabled = !selectedPlayerId;
}

function renderSelectedPlayer(){
  const pane = $("playerPane");
  pane.innerHTML = "";

  const p = selectedPlayerId ? getPlayer(selectedPlayerId) : null;
  if (!p){
    pane.innerHTML = `<div class="muted">Select a player to edit their deck details.</div>`;
    return;
  }

  const name = document.createElement("div");
  name.innerHTML = `<div class="pill"><b>${escapeHtml(p.name)}</b></div>`;
  pane.appendChild(name);

  // Deck text
  const deck = document.createElement("label");
  deck.className = "field";
  deck.innerHTML = `<span>Decklist (optional)</span>
                    <textarea id="playerDeckText" placeholder="Paste decklist..."></textarea>`;
  pane.appendChild(deck);
  deck.querySelector("textarea").value = p.deckText || "";
  deck.querySelector("textarea").addEventListener("input", (e)=>{
    p.deckText = e.target.value;
    saveCurrent(true);
    renderPlayers();
  });

  // Image upload
  const imgWrap = document.createElement("div");
  imgWrap.className = "imgbox";
  imgWrap.id = "imgBox";

  if (p.deckImageDataUrl){
    imgWrap.innerHTML = `<img src="${p.deckImageDataUrl}" alt="Deck image" />
                         <div class="row" style="justify-content:center">
                           <button id="btnClearImg" class="ghost smallbtn" type="button">Clear image</button>
                         </div>`;
  } else {
    imgWrap.innerHTML = `<div>Deck image (optional)</div>
                         <div class="hint">Choose an image to store locally for quick reference.</div>
                         <input id="playerImg" type="file" accept="image/*" />`;
  }
  pane.appendChild(imgWrap);

  if (p.deckImageDataUrl){
    imgWrap.querySelector("#btnClearImg").addEventListener("click", ()=>{
      p.deckImageDataUrl = null;
      saveCurrent();
      renderSelectedPlayer();
      toast("Image cleared.");
    });
  } else {
    imgWrap.querySelector("#playerImg").addEventListener("change", async (e)=>{
      const file = e.target.files?.[0];
      if (!file) return;
      const url = await fileToDataURL(file, 900);
      p.deckImageDataUrl = url;
      saveCurrent();
      renderSelectedPlayer();
      toast("Image saved.");
    });
  }
}

async function fileToDataURL(file, maxW=900){
  // downscale simple via canvas for storage size
  const img = new Image();
  const data = await file.arrayBuffer();
  const blob = new Blob([data], { type: file.type });
  const url = URL.createObjectURL(blob);

  await new Promise((res,rej)=>{
    img.onload = ()=>res(true);
    img.onerror = rej;
    img.src = url;
  });

  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function renderStandings(){
  const host = $("standingsTable");
  host.innerHTML = "";

  if (!current.players.length){
    host.innerHTML = `<div class="muted">No players yet.</div>`;
    return;
  }

  const rows = standings();
  const table = document.createElement("table");
  table.className = "table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th><th>Player</th><th>Pts</th><th>W-L-T</th><th>OW%</th><th>OOW%</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  rows.forEach((r, i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${r.pts}</td>
      <td>${r.w}-${r.l}-${r.t}</td>
      <td>${(r.ow*100).toFixed(1)}</td>
      <td>${(r.oow*100).toFixed(1)}</td>
    `;
    tbody.appendChild(tr);
  });

  host.appendChild(table);
}

function renderTopCut(){
  const view = $("topCutView");
  view.innerHTML = "";

  if (!current.topCut?.started){
    view.innerHTML = `<div class="muted">Top cut hasn’t started yet.</div>`;
    return;
  }

  const rounds = topCutRounds();
  if (!rounds.length){
    view.innerHTML = `<div class="muted">No top cut rounds found.</div>`;
    return;
  }

  for (const r of rounds){
    const block = document.createElement("div");
    block.className = "round";
    const title = document.createElement("div");
    title.className = "roundhead";
    title.innerHTML = `<div class="roundtitle"><h4>${escapeHtml(r.label)}</h4></div>`;
    block.appendChild(title);

    const matches = document.createElement("div");
    matches.className = "matches";

    r.matches.forEach(m=>{
      const row = document.createElement("div");
      row.className = "match";
      const p1 = getPlayer(m.p1)?.name || "—";
      const p2 = getPlayer(m.p2)?.name || "—";
      row.innerHTML = `<div>${escapeHtml(p1)}</div><div class="vs">vs</div><div>${escapeHtml(p2)}</div><div class="pill">${escapeHtml(resultLabel("topcut", m, m.result, p1, p2))}</div>`;
      matches.appendChild(row);
    });

    block.appendChild(matches);
    view.appendChild(block);
  }
}

function renderCupCTA(){
  const cta = $("cupTopCutCTA");
  const show = current.type === "Cup" && swissIsComplete() && !current.topCut?.started;
  cta.classList.toggle("hidden", !show);

  // Top cut tab button visibility
  setTopCutTabVisibility(!!current.topCut?.started);
}

function setTopCutTabVisibility(show){
  $("tabTopCutBtn").classList.toggle("hidden", !show);
}

// ---------- Actions ----------
async function refreshTours(){
  tournaments = (await dbGetAll()).map(ensureDefaults);
  renderTourList();
}

async function saveCurrent(silent=false){
  if (!current) return;
  current.updatedAt = nowISO();
  await dbPut(current);
  // keep in memory list updated
  await refreshTours();
  if (!silent) toast("Saved.");
}

async function openTournament(id){
  // discard draft?
  if (roundDraft?.dirty){
    const ok = confirm("Discard unsaved round draft changes?");
    if (!ok) return;
  }

  const t = await dbGet(id);
  if (!t) return;
  current = ensureDefaults(t);
  currentId = id;

  // ensure timer is coherent (convert running with endsAt)
  if (current.timer.running && current.timer.endsAt == null){
    current.timer.running = false;
  }
  // if running and ended already, stop
  if (current.timer.running && computeRemainingSec() <= 0){
    current.timer.running = false;
    current.timer.endsAt = null;
    current.timer.remainingSec = 0;
  }

  // If there is an incomplete latest round, open it for editing by default
  const rounds = current.rounds || [];
  if (rounds.length){
    const lastIndex = rounds.length - 1;
    const last = rounds[lastIndex];
    if (!isRoundComplete(last)){
      editingRoundKey = { phase: last.phase || "swiss", index: lastIndex };
      roundDraft = { results: last.matches.map(m => (m.bye ? "BYE" : (m.result || ""))), dirty:false };
    } else {
      editingRoundKey = null;
      roundDraft = null;
    }
  } else {
    editingRoundKey = null;
    roundDraft = null;
  }

  selectedPlayerId = current.players[0]?.id || null;

  syncSettingsFormFromCurrent();
  renderAll();
  showScreen("tournament");
  setActiveTab("rounds");
  renderTimer();
  syncWakeLock();
  scheduleNotifications({allowRequest:false});
}

async function createTournament(){
  const t = blankTournament();
  current = t;
  currentId = t.id;
  await dbPut(t);
  await refreshTours();
  await openTournament(t.id);
  toast("Tournament created.");
}

async function deleteTournament(){
  if (!currentId) return;
  const ok = confirm("Delete this tournament? This cannot be undone.");
  if (!ok) return;
  await dbDelete(currentId);
  current = null;
  currentId = null;
  editingRoundKey = null;
  roundDraft = null;
  selectedPlayerId = null;
  await refreshTours();
  showScreen("library");
  toast("Tournament deleted.");
}

// ---------- Pairings ----------
function canGenerateNextRound(){
  if (!current) return false;
  if (roundDraft?.dirty) return false;
  if (current.players.length < 2) return false;

  // Must finish the latest round before generating another
  const rounds = current.rounds || [];
  if (rounds.length){
    const last = rounds[rounds.length - 1];
    if (!isRoundComplete(last)) return false;
  }

  // If top cut started, allow generation only if there is a next stage available
  if (current.topCut?.started){
    const roundsTC = topCutRounds();
    if (!roundsTC.length) return true;
    const lastTC = roundsTC[roundsTC.length - 1];
    if (!isRoundComplete(lastTC)) return false;

    const sizeStart = Number(current.topCut?.size || 8);
    const stages = topCutStageLabel(sizeStart);
    const nextStage = stages[roundsTC.length]; // 0-based
    return !!nextStage;
  }

  // Otherwise, we are in Swiss / RR
  const planned = plannedSwissRounds();
  if (planned <= 0) return false;
  const completed = completedSwissRounds().length;

  // Swiss concluded
  if (completed >= planned){
    // For Cup tournaments, user should start Top Cut instead
    return false;
  }

  // Round robin: stop once planned reached
  if (current.pairingMode === "round_robin" && swissRounds().length >= planned){
    return false;
  }

  return true;
}

function generateNextSwissRound(){
  const playerIds = current.players.map(p=>p.id);
  const lastSwiss = swissRounds();
  const nextN = lastSwiss.length + 1;
  const planned = plannedSwissRounds();

  if (current.pairingMode === "round_robin"){
    if (!current.rrSchedule || current.rrSchedule.length !== planned){
      current.rrSchedule = buildRoundRobinSchedule(playerIds);
    }
    if (nextN > current.rrSchedule.length){
      toast("Round robin complete.");
      return null;
    }
    const template = current.rrSchedule[nextN - 1];
    return {
      phase: "swiss",
      roundNumber: nextN,
      label: `Round ${nextN}`,
      matches: template.matches.map(m => ({...m, result:null}))
    };
  }

  // Swiss pairing
  if (planned && nextN > planned){
    toast("Swiss rounds complete.");
    return null;
  }

  // Group by points (standings)
  const rows = standings();
  const pointsMap = new Map(rows.map(r=>[r.id, r.pts]));

  // Create buckets
  const buckets = new Map();
  for (const id of playerIds){
    const pts = pointsMap.get(id) ?? 0;
    if (!buckets.has(pts)) buckets.set(pts, []);
    buckets.get(pts).push(id);
  }
  const bracketPts = Array.from(buckets.keys()).sort((a,b)=>b-a);

  // shuffle within buckets for variety
  for (const pts of bracketPts) shuffle(buckets.get(pts));

  const queue = [];
  for (const pts of bracketPts) queue.push(...buckets.get(pts));

  // bye if odd: lowest points without previous bye
  let byeId = null;
  if (queue.length % 2 === 1){
    const candidates = [...queue].reverse(); // start from lowest
    byeId = candidates.find(pid => !hadBye(pid)) ?? candidates[0];
    queue.splice(queue.indexOf(byeId), 1);
  }

  const used = new Set();
  const matches = [];

  function pickOpponent(a){
    // prefer closest in points, avoid rematch if possible
    const aPts = pointsMap.get(a) ?? 0;
    // scan forward for best
    let best = null;
    for (const b of queue){
      if (used.has(b) || b === a) continue;
      const bPts = pointsMap.get(b) ?? 0;
      const diff = Math.abs(aPts - bPts);
      const rematch = havePlayed(a,b);
      const score = diff * 10 + (rematch ? 1000 : 0);
      if (!best || score < best.score){
        best = { id:b, score, rematch };
      }
      if (score === 0) break;
    }
    return best?.id || null;
  }

  for (const a of queue){
    if (used.has(a)) continue;
    const b = pickOpponent(a);
    if (b){
      used.add(a); used.add(b);
      matches.push({ p1:a, p2:b, result:null, bye:false });
    }
  }

  // Handle any unpaired (downpair)
  const unpaired = queue.filter(id=>!used.has(id));
  for (let i=0; i<unpaired.length; i+=2){
    const a = unpaired[i];
    const b = unpaired[i+1];
    if (a && b){
      matches.push({ p1:a, p2:b, result:null, bye:false });
    }
  }

  if (byeId){
    matches.push({ p1: byeId, p2: null, result:null, bye:true });
  }

  return {
    phase: "swiss",
    roundNumber: nextN,
    label: `Round ${nextN}`,
    matches
  };
}

async function generateNextRound(){
  if (!canGenerateNextRound()){
    toast("Finish (and save) the current round first.");
    return;
  }

  // If top cut already started, and Swiss is complete, generating next round should advance top cut
  if (current.topCut?.started){
    advanceTopCutIfPossible();
    renderAll();
    return;
  }

  const r = generateNextSwissRound();
  if (!r) return;

  current.rounds.push(r);

  // Open editing for this new round
  const idx = current.rounds.length - 1;
  editingRoundKey = { phase: r.phase, index: idx };
  roundDraft = { results: r.matches.map(m => (m.bye ? "BYE" : "")), dirty:false };

  // Reset timer per round
  resetTimerForNewRound();
  if (current.timer.autoStart) startTimer();

  await saveCurrent(true);
  renderAll();
  toast("Pairings generated.");
}

// ---------- Settings modal ----------
function openSettings(){
  if (!current) return;
  syncSettingsFormFromCurrent();
  $("settingsModal").classList.remove("hidden");
}
function closeSettings(){
  $("settingsModal").classList.add("hidden");
}

function syncSettingsFormFromCurrent(){
  if (!current) return;
  $("tName").value = current.name || "";
  $("tFormat").value = current.format || "Bo1";
  $("tType").value = current.type || "Cup";
  $("tPairingMode").value = current.pairingMode || "swiss";
  $("tRounds").value = Number(current.roundsPlanned || 5);

  $("tTimerMins").value = Math.round((current.timer.durationSec || defaultTimerSec(current.format)) / 60);
  $("tAutoStartTimer").checked = !!current.timer.autoStart;

  $("tNotify10").checked = !!current.timer.notify?.at10;
  $("tNotify5").checked = !!current.timer.notify?.at5;
  $("tNotify0").checked = !!current.timer.notify?.at0;
  $("tKeepAwake").checked = !!current.timer.keepAwake;
  $("tFullScreenClock").checked = !!current.timer.showClock;

  $("tTopCutSize").value = String(current.topCut?.size || 8);

  updateSettingsVisibility();
}

function updateSettingsVisibility(){
  const mode = $("tPairingMode").value;
  $("roundsField").classList.toggle("hidden", mode !== "swiss");
  const isCup = ($("tType").value === "Cup");
  $("topCutSizeField").classList.toggle("hidden", !isCup);
}

async function saveSettingsFromForm(){
  if (!current) return;

  const prevFormat = current.format;
  const prevMode = current.pairingMode;

  current.name = $("tName").value.trim() || "New tournament";
  current.format = $("tFormat").value;
  current.type = $("tType").value;
  current.pairingMode = $("tPairingMode").value;
  current.roundsPlanned = Math.max(1, Number($("tRounds").value || 1));

  // timer duration
  const mins = Math.max(1, Number($("tTimerMins").value || 1));
  const newDur = mins * 60;
  current.timer.durationSec = newDur;
  current.timer.custom = true;
  // keep remaining within duration if timer not running; if running, leave endsAt as is but recompute remaining against old
  if (!current.timer.running){
    current.timer.remainingSec = Math.min(current.timer.remainingSec || newDur, newDur);
  }

  current.timer.autoStart = $("tAutoStartTimer").checked;
  current.timer.notify = {
    at10: $("tNotify10").checked,
    at5: $("tNotify5").checked,
    at0: $("tNotify0").checked,
  };
  current.timer.keepAwake = $("tKeepAwake").checked;
  current.timer.showClock = $("tFullScreenClock").checked;

  if (current.type === "Cup"){
    current.topCut.size = Math.max(2, Number($("tTopCutSize").value || 8));
  } else {
    current.topCut.started = false;
  }

  // Apply default timer if format changed AND user never customized (or if they set it equal to previous default)
  const prevDefault = defaultTimerSec(prevFormat || "Bo1");
  const newDefault = defaultTimerSec(current.format);
  if (!current.timer.custom || current.timer.durationSec === prevDefault){
    current.timer.durationSec = newDefault;
    if (!current.timer.running){
      current.timer.remainingSec = newDefault;
    }
    current.timer.custom = false;
  }

  // Pairing mode change: if RR schedule exists, warn and clear rounds (because schedules differ)
  if (prevMode !== current.pairingMode && (current.rounds?.length || 0) > 0){
    const ok = confirm("Changing pairing mode will clear all existing rounds (Swiss / RR schedules are incompatible). Continue?");
    if (!ok){
      // revert selection UI
      current.pairingMode = prevMode;
    } else {
      current.rounds = [];
      current.rrSchedule = null;
      current.topCut.started = false;
      editingRoundKey = null;
      roundDraft = null;
    }
  }

  // Round robin: rounds planned is derived; still store roundsPlanned for filters (optional)
  if (current.pairingMode === "round_robin"){
    current.roundsPlanned = plannedSwissRounds(); // store computed
  }

  await saveCurrent();
  renderAll();

// Apply timer side effects
if (!current.timer.showClock && clockOverlayVisible()){
  hideClockOverlay();
}
syncWakeLock();
if (current.timer.running){
  scheduleNotifications({allowRequest:false});
} else {
  cancelScheduledNotifications();
}

  closeSettings();
}

function renderAll(){
  if (!current) return;
  renderTournamentHeader();
  renderRoundHint();
  renderRounds();
  renderPlayers();
  renderSelectedPlayer();
  renderStandings();
  renderTopCut();
  renderCupCTA();

  // Button state & label
  const btn = $("btnNewRound");
  btn.disabled = !canGenerateNextRound();

  if (current.topCut?.started){
    btn.textContent = "Generate next top cut stage";
  } else if (swissIsComplete()){
    btn.textContent = (current.type === "Cup") ? "Swiss complete (start top cut)" : "Swiss complete";
  } else {
    btn.textContent = "Generate next round pairings";
  }
}

// ---------- Export / Import ----------
async function exportBackup(){
  const data = {
    kind: "ptcg-tools-swiss-backup",
    version: 2,
    exportedAt: nowISO(),
    tournaments: (await dbGetAll()).map(ensureDefaults),
  };
  downloadJson(data, `ptcg-tools-swiss-backup-${new Date().toISOString().slice(0,10)}.json`);
  toast("Exported.");
}
function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
async function importBackup(file){
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { toast("Invalid JSON."); return; }
  if (!data || !Array.isArray(data.tournaments)){
    toast("Not a valid backup file.");
    return;
  }
  for (const t of data.tournaments){
    const norm = ensureDefaults(t);
    if (!norm.id) norm.id = genId();
    await dbPut(norm);
  }
  await refreshTours();
  toast("Imported.");
}

// ---------- Event wiring ----------
function wireEvents(){
  // Library
  $("search").addEventListener("input", renderTourList);
  $("filterFormat").addEventListener("change", renderTourList);
  $("filterType").addEventListener("change", renderTourList);
  $("filterRounds").addEventListener("change", renderTourList);

  $("btnNew").addEventListener("click", createTournament);
  $("btnNew2").addEventListener("click", createTournament);

  $("btnExport").addEventListener("click", exportBackup);
  $("importFile").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await importBackup(file);
  });

  // Tournament screen
  $("btnBackLibrary").addEventListener("click", ()=>{
    if (roundDraft?.dirty){
      const ok = confirm("Discard unsaved round draft changes?");
      if (!ok) return;
    }
    current = null;
    currentId = null;
    selectedPlayerId = null;
    editingRoundKey = null;
    roundDraft = null;
    showScreen("library");
    renderTourList();
  });

  // Tabs
  document.querySelectorAll(".tab").forEach(b=>{
    b.addEventListener("click", ()=> setActiveTab(b.dataset.tab));
  });

  // Timer
  $("btnTimerStartPause").addEventListener("click", toggleTimer);
  $("btnTimerReset").addEventListener("click", resetTimer);

  // Full-screen clock
  $("timerDisplay").addEventListener("click", ()=>{ if (current?.timer?.showClock) showClockOverlay(); });
  $("clockOverlay").addEventListener("click", ()=> hideClockOverlay());

  document.addEventListener("visibilitychange", ()=>{
    // Wake lock must be re-requested when returning to the foreground
    if (document.visibilityState === "visible") syncWakeLock(); else releaseWakeLock();
  });

  // Settings modal
  $("btnOpenSettings").addEventListener("click", openSettings);
  $("btnCloseSettings").addEventListener("click", closeSettings);
  $("settingsModal").addEventListener("click", (e)=>{
    if (e.target === $("settingsModal")) closeSettings();
  });
  $("tPairingMode").addEventListener("change", updateSettingsVisibility);
  $("tType").addEventListener("change", updateSettingsVisibility);
  $("tFormat").addEventListener("change", ()=>{
    // live update timer mins suggestion only if user hasn't customized
    const format = $("tFormat").value;
    const mins = defaultTimerSec(format)/60;
    if (!current?.timer?.custom) $("tTimerMins").value = mins;
  });

function maybeRequestNotifs(){
  const any = $("tNotify10").checked || $("tNotify5").checked || $("tNotify0").checked;
  if (!any) return;
  // Request permission on a user gesture (changing the toggle)
  ensureNotificationPermission().then(ok=>{
    if (!ok) toast("Notifications not enabled.");
  });
}
$("tNotify10").addEventListener("change", maybeRequestNotifs);
$("tNotify5").addEventListener("change", maybeRequestNotifs);
$("tNotify0").addEventListener("change", maybeRequestNotifs);

$("tKeepAwake").addEventListener("change", ()=>{ /* saved via Save button */ });
$("tFullScreenClock").addEventListener("change", ()=>{ /* saved via Save button */ });


  $("btnSave").addEventListener("click", saveSettingsFromForm);
  $("btnDelete").addEventListener("click", deleteTournament);

  // Players
  function addPlayer(){
    if (!current) return;
    const name = $("newPlayerName").value.trim();
    if (!name) return;
    if (current.players.some(p=>p.name.toLowerCase() === name.toLowerCase())){
      toast("Player already exists.");
      return;
    }
    const p = { id: genId(), name, deckText:"", deckImageDataUrl:null };
    current.players.push(p);
    $("newPlayerName").value = "";
    selectedPlayerId = p.id;

    // Round robin schedule must be rebuilt if players change and rounds haven't started
    if (current.pairingMode === "round_robin" && swissRounds().length === 0){
      current.rrSchedule = null;
    }

    saveCurrent(true);
    renderAll();
  }
  $("btnAddPlayer").addEventListener("click", addPlayer);
  $("btnAddPlayer2").addEventListener("click", addPlayer);
  $("newPlayerName").addEventListener("keydown", (e)=>{ if (e.key === "Enter") addPlayer(); });

  $("btnRemovePlayer").addEventListener("click", async ()=>{
    if (!current || !selectedPlayerId) return;
    const started = (current.rounds?.length || 0) > 0;
    if (started){
      toast("Can't remove players after rounds have started.");
      return;
    }
    current.players = current.players.filter(p=>p.id !== selectedPlayerId);
    selectedPlayerId = current.players[0]?.id || null;
    current.rrSchedule = null;
    await saveCurrent(true);
    renderAll();
  });

  // Rounds
  $("btnNewRound").addEventListener("click", generateNextRound);

  // Cup CTA
  $("btnStartTopCut").addEventListener("click", ()=>{
    if (roundDraft?.dirty){
      toast("Save/cancel your current draft first.");
      return;
    }
    startTopCut();
  });

  // Keyboard shortcut: Escape closes settings
  window.addEventListener("keydown", (e)=>{
    if (e.key === "Escape" && !$("settingsModal").classList.contains("hidden")){
      closeSettings();
    }
  });
}

// ---------- Init ----------
async function init(){
  db = await openDB();
  wireEvents();
  await refreshTours();

  showScreen("library");
  renderTourList();
}

init().catch(err=>{
  console.error(err);
  toast("Failed to start app.");
});
