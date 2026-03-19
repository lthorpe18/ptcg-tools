const SHEET_CONFIG = {
  // Replace if your sheet/gid changes.
  spreadsheetId: "1zYSq52q6vD2vFyzNbOZbN5qASu2K5C0nHL7mOj_PTRw",
  gid: "825935892",
};

const STORAGE_KEY = "ptcg-events-cache-v1";
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

const $ = (id) => document.getElementById(id);

const searchEl = $("search");
const dateRangeEl = $("dateRange");
const eventTypeFilterEl = $("eventTypeFilter");
const swissFilterEl = $("swissFilter");
const btnRefreshEl = $("btnRefresh");

const tabCardsEl = $("tabCards");
const tabMapEl = $("tabMap");
const cardsViewEl = $("cardsView");
const mapViewEl = $("mapView");

const cardsGridEl = $("cardsGrid");
const metaEl = $("meta");
const loadingEl = $("loading");
const emptyEl = $("empty");
const errorEl = $("error");
const toastEl = $("toast");

let allEvents = [];
let visibleEvents = [];
let activeView = "cards";

let map = null;
let mapLayer = null;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}

function setError(message) {
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${SHEET_CONFIG.gid}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((cols) => {
    const out = {};
    for (let i = 0; i < headers.length; i++) {
      out[headers[i]] = String(cols[i] ?? "").trim();
    }
    return out;
  });
}

function toDateTime(dateRaw, timeRaw) {
  const d = String(dateRaw || "").trim();
  const t = String(timeRaw || "").trim();
  if (!d) return null;

  const withTime = `${d} ${t}`.trim();
  const parsed = new Date(withTime);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const parsedDateOnly = new Date(d);
  if (!Number.isNaN(parsedDateOnly.getTime())) return parsedDateOnly;

  return null;
}

function parseCoordinateValue(value) {
  const n = Number(String(value || "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeEvent(row, idx) {
  const location = row.Location || "";
  const date = row.Date || "";
  const time = row.Time || "";
  const eventType = row["Event Type"] || "Other";
  const registrationMethod = row["Registration Method"] || "";
  const swissFormat = row["Swiss Format"] || "";

  const latitude = parseCoordinateValue(row.Latitude);
  const longitude = parseCoordinateValue(row.Longitude);

  const startsAt = toDateTime(date, time);

  const id = `${location}|${date}|${time}|${eventType}|${idx}`;

  return {
    id,
    location,
    date,
    time,
    eventType,
    registrationMethod,
    swissFormat,
    startsAt,
    lat: latitude,
    lng: longitude,
    raw: row,
  };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows) || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function saveCache(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
  } catch {
    // ignore cache errors
  }
}

async function fetchRows({ force = false } = {}) {
  if (!force) {
    const cached = loadCache();
    if (cached) return cached;
  }

  const res = await fetch(csvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  saveCache(rows);
  return rows;
}

function humanDate(event) {
  if (event.startsAt) {
    return event.startsAt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return [event.date, event.time].filter(Boolean).join(" • ") || "Date unknown";
}

function dayDiffFromNow(event) {
  if (!event.startsAt) return null;
  const ms = event.startsAt.getTime() - Date.now();
  return ms / (1000 * 60 * 60 * 24);
}

function parseRegistration(registrationMethod) {
  const s = String(registrationMethod || "").trim();
  if (!s) return { label: "No registration info", url: "" };

  const urlMatch = s.match(/https?:\/\/\S+/i);
  if (urlMatch) {
    return { label: "Register", url: urlMatch[0] };
  }

  return { label: s, url: "" };
}

function updateFilterOptions(events) {
  const typeValues = new Set();
  const swissValues = new Set();

  for (const e of events) {
    if (e.eventType) typeValues.add(e.eventType);
    if (e.swissFormat) swissValues.add(e.swissFormat);
  }

  eventTypeFilterEl.innerHTML = `<option value="">All</option>`;
  swissFilterEl.innerHTML = `<option value="">All</option>`;

  for (const v of Array.from(typeValues).sort((a, b) => a.localeCompare(b))) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    eventTypeFilterEl.appendChild(opt);
  }

  for (const v of Array.from(swissValues).sort((a, b) => a.localeCompare(b))) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    swissFilterEl.appendChild(opt);
  }
}

function applyFilters() {
  const q = (searchEl.value || "").trim().toLowerCase();
  const rangeDays = Number(dateRangeEl.value || "0");
  const typeFilter = eventTypeFilterEl.value;
  const swissFilter = swissFilterEl.value;

  visibleEvents = allEvents.filter((e) => {
    if (e.startsAt && e.startsAt.getTime() < Date.now()) return false;

    if (rangeDays > 0 && e.startsAt) {
      const dd = dayDiffFromNow(e);
      if (dd == null || dd > rangeDays) return false;
    }

    if (typeFilter && e.eventType !== typeFilter) return false;
    if (swissFilter && e.swissFormat !== swissFilter) return false;

    if (q) {
      const hay = `${e.location} ${e.eventType} ${e.registrationMethod} ${e.swissFormat}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  visibleEvents.sort((a, b) => {
    const at = a.startsAt?.getTime?.() || Number.MAX_SAFE_INTEGER;
    const bt = b.startsAt?.getTime?.() || Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  renderCards();
  renderMap();
  metaEl.textContent = `${visibleEvents.length} event${visibleEvents.length === 1 ? "" : "s"}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCards() {
  cardsGridEl.innerHTML = "";

  loadingEl.classList.add("hidden");
  setError("");

  if (!visibleEvents.length) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  for (const e of visibleEvents) {
    const card = document.createElement("article");
    card.className = "card";

    const reg = parseRegistration(e.registrationMethod);

    const dd = dayDiffFromNow(e);
    const urgency = dd == null ? "" : dd < 7 ? " • This week" : "";

    card.innerHTML = `
      <div class="cardhead">
        <span class="badge">${escapeHtml(e.eventType || "Event")}</span>
        <div class="date">${escapeHtml(humanDate(e))}${escapeHtml(urgency)}</div>
      </div>

      <div class="title">${escapeHtml(e.location || "Unknown location")}</div>

      <div class="row"><span class="key">Swiss:</span> ${escapeHtml(e.swissFormat || "—")}</div>
      <div class="row"><span class="key">Registration:</span> ${escapeHtml(e.registrationMethod || "—")}</div>

      <div class="actions">
        ${reg.url ? `<a class="btn primary" href="${escapeHtml(reg.url)}" target="_blank" rel="noopener noreferrer">Register</a>` : ""}
        <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location || "")}" target="_blank" rel="noopener noreferrer">Open in Maps</a>
      </div>
    `;

    cardsGridEl.appendChild(card);
  }
}

function ensureMap() {
  if (map) return;
  map = L.map("map").setView([37.0902, -95.7129], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  mapLayer = L.layerGroup().addTo(map);
}

function renderMap() {
  if (activeView !== "map") return;
  ensureMap();

  mapLayer.clearLayers();

  const withCoords = visibleEvents.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));
  if (!withCoords.length) {
    toast("No coordinates found. Add Latitude/Longitude columns for map pins.");
    return;
  }

  const bounds = [];
  for (const e of withCoords) {
    const marker = L.marker([e.lat, e.lng]).addTo(mapLayer);
    marker.bindPopup(`
      <strong>${escapeHtml(e.eventType || "Event")}</strong><br />
      ${escapeHtml(e.location || "Unknown location")}<br />
      ${escapeHtml(humanDate(e))}<br />
      Swiss: ${escapeHtml(e.swissFormat || "—")}
    `);
    bounds.push([e.lat, e.lng]);
  }

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
  }
}

function setActiveView(view) {
  activeView = view;
  const isCards = view === "cards";

  tabCardsEl.classList.toggle("active", isCards);
  tabMapEl.classList.toggle("active", !isCards);
  tabCardsEl.setAttribute("aria-selected", String(isCards));
  tabMapEl.setAttribute("aria-selected", String(!isCards));

  cardsViewEl.classList.toggle("hidden", !isCards);
  mapViewEl.classList.toggle("hidden", isCards);

  if (!isCards) {
    setTimeout(() => {
      renderMap();
      map?.invalidateSize?.();
    }, 0);
  }
}

async function loadData({ force = false } = {}) {
  loadingEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  setError("");

  try {
    const rows = await fetchRows({ force });

    allEvents = rows
      .map((r, i) => normalizeEvent(r, i))
      .filter((e) => e.location || e.date || e.eventType);

    updateFilterOptions(allEvents);
    applyFilters();

    if (force) toast("Events refreshed");
  } catch (err) {
    console.error(err);
    setError(
      `Could not load events. Make sure your sheet tab is shared/published and headers exactly match: Location, Date, Time, Event Type, Registration Method, Swiss Format.`
    );
    loadingEl.classList.add("hidden");
  }
}

searchEl.addEventListener("input", applyFilters);
dateRangeEl.addEventListener("change", applyFilters);
eventTypeFilterEl.addEventListener("change", applyFilters);
swissFilterEl.addEventListener("change", applyFilters);

btnRefreshEl.addEventListener("click", () => loadData({ force: true }));

tabCardsEl.addEventListener("click", () => setActiveView("cards"));
tabMapEl.addEventListener("click", () => setActiveView("map"));

loadData().catch((e) => {
  console.error(e);
  setError("Unexpected error loading events.");
});

