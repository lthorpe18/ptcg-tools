// Single V3 route registry. Future native destinations replace a legacy entry here.
// Collection is added only when functional; no public route/tab is reserved for it.
export const destinations = Object.freeze([
  { id: "home", label: "Home", icon: "⌂", section: "home" },
  { id: "meta", label: "Meta", icon: "◈", section: "meta" },
  { id: "decks", label: "Decks", icon: "▤", section: "decks" },
  { id: "compete", label: "Compete", icon: "◇", section: "compete" },
  { id: "utilities", label: "Utilities", section: "tools" },
  { id: "settings", label: "Settings", path: "apps/settings/" },
]);
export function parseRoute(hash) {
  const value = String(hash || "").replace(/^#/, "");
  if (!value || value === "/specimen")
    return { id: "specimen", kind: "native" };
  if (value === "/specimen/states") return { id: "states", kind: "native" };
  const item = destinations.find((item) => value === `/${item.id}`);
  return item
    ? { ...item, kind: "legacy" }
    : { id: "unknown", kind: "invalid" };
}
export function legacyUrl(id, base) {
  const item = destinations.find((item) => item.id === id);
  if (!item) return null;
  const url = new URL("../v2-preview/" + (item.path || ""), base);
  if (item.section && item.section !== "home")
    url.searchParams.set("section", item.section);
  return url.href;
}
export function cleanState(value = {}) {
  value = value || {};
  return {
    v3: true,
    view: value.view === "gallery" ? "gallery" : "list",
    filter: ["all", "Pokémon", "Trainers", "Energy"].includes(value.filter)
      ? value.filter
      : "all",
    scroll: Number.isFinite(Number(value.scroll))
      ? Math.max(0, Number(value.scroll))
      : 0,
    details: Array.isArray(value.details)
      ? value.details.filter((x) => typeof x === "string")
      : null,
  };
}
