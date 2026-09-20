import {
  destinations,
  parseRoute,
  legacyUrl,
  cleanState,
} from "./shared/routes.mjs";
import {
  el,
  artworkHeader,
  toolbar,
  cardRow,
  disclosure,
  denseRow,
  state,
  dialog,
  inspector,
} from "./shared/components.mjs";
import { cards, cover, deckName } from "./fixtures.mjs";
const main = document.querySelector("main");
let ui = cleanState(history.state),
  rendering = false;
let retained = history.state?.previewContexts || {};
history.scrollRestoration = "manual";
function save() {
  if (rendering) return;
  ui.scroll = window.scrollY;
  ui.details = [...main.querySelectorAll("details[open]")].map(
    (node) => node.id,
  );
  history.replaceState({ ...ui, previewContexts: retained }, "", location.href);
}
function link(text, href, className = "") {
  const node = el("a", className, text);
  node.href = href;
  return node;
}
const nav = document.querySelector(".bottom-nav");
// Reserve the measured navigation height, including safe area and enlarged text.
new ResizeObserver(() => {
  document.documentElement.style.setProperty(
    "--nav-height",
    `${nav.getBoundingClientRect().height}px`,
  );
}).observe(nav, { box: "border-box" });
for (const item of destinations.slice(0, 4)) {
  const a = link("", `#/${item.id}`);
  const icon = el("span", "nav-icon", item.icon);
  icon.setAttribute("aria-hidden", "true");
  a.append(icon, el("span", "", item.label));
  nav.append(a);
}
function routeTo(hash) {
  save();
  const current = parseRoute(location.hash);
  if (current.kind === "native") retained[current.id] = cleanState(ui);
  const next = parseRoute(hash);
  const nextState = cleanState(
    retained[next.id] || { view: ui.view, filter: ui.filter },
  );
  history.pushState({ ...nextState, previewContexts: retained }, "", hash);
  render(true);
}
document.addEventListener("click", (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault();
    main.focus();
    return;
  }
  const a = event.target.closest('a[href^="#/"]');
  if (
    !a ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (location.hash !== a.hash) routeTo(a.hash);
});
function note() {
  const node = el("div", "fixture-note");
  node.append(
    el("span", "", "Read-only specimen · fixture data"),
    link("States & patterns", "#/specimen/states"),
  );
  return node;
}
function filterSheet(trigger) {
  const node = dialog("Filter specimen", trigger, { sheet: true });
  node.append(el("p", "meta", "Presentation only. No saved deck is changed."));
  const label = el("label", "", "Card group");
  label.htmlFor = "group";
  const select = el("select");
  select.id = "group";
  for (const [value, text] of [
    ["all", "All cards"],
    ["Pokémon", "Pokémon"],
    ["Trainers", "Trainers"],
    ["Energy", "Energy"],
  ]) {
    const option = el("option", "", text);
    option.value = value;
    select.append(option);
  }
  select.value = ui.filter;
  const actions = el("div", "sheet-actions");
  const reset = el("button", "", "Reset");
  reset.onclick = () => {
    select.value = "all";
  };
  const apply = el("button", "primary", "Apply");
  apply.onclick = () => {
    ui.filter = select.value;
    renderCards();
    save();
    node.close();
  };
  actions.append(reset, apply);
  node.append(label, select, actions);
  node.showModal();
}
function renderCards() {
  const container = document.getElementById("card-groups");
  if (!container) return;
  container.replaceChildren();
  for (const group of ["Pokémon", "Trainers", "Energy"]) {
    if (ui.filter !== "all" && ui.filter !== group) continue;
    const rows = cards.filter((card) => card.group === group);
    const heading = el("h2", "section-label");
    heading.append(
      el("span", "", group),
      el(
        "span",
        "",
        rows.reduce((n, c) => n + c.quantity, 0),
      ),
    );
    const list = el(
      "ul",
      `card-list ${ui.view === "gallery" ? "gallery" : ""}`,
    );
    list.setAttribute("aria-label", group);
    for (const card of rows) list.append(cardRow(card, inspector));
    container.append(heading, list);
  }
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.view === ui.view),
      ),
    );
  const filter = document.getElementById("filter-button");
  filter.textContent = ui.filter === "all" ? "Filter" : `Filter: ${ui.filter}`;
}
function specimen() {
  main.append(
    note(),
    artworkHeader({ name: deckName, card: cover, focal: { x: 50, y: 35 } }),
  );
  const controls = toolbar("Fixture deck display");
  controls.append(el("span", "grow meta", "60 cards · Sample list"));
  const views = el("div", "segmented");
  views.setAttribute("role", "group");
  views.setAttribute("aria-label", "Card display");
  for (const view of ["list", "gallery"]) {
    const button = el("button", "", view === "list" ? "List" : "Gallery");
    button.dataset.view = view;
    button.onclick = () => {
      if (ui.view === view) return;
      ui.view = view;
      renderCards();
      save();
    };
    views.append(button);
  }
  const filter = el("button", "", "Filter");
  filter.id = "filter-button";
  filter.onclick = () => filterSheet(filter);
  controls.append(views, filter);
  const groups = el("div");
  groups.id = "card-groups";
  main.append(controls, groups);
  renderCards();
  const secondary = el("div", "support");
  secondary.append(
    disclosure(
      "fixture-context",
      "About this specimen",
      "Historical sample list for layout inspection, not a live deck, legality recommendation or saved user state.",
    ),
    disclosure(
      "fixture-interaction",
      "Keyboard and inspection",
      "Tab to a card and press Enter to inspect its full printing. Escape closes the dialog and returns focus. Filters and List/Gallery only change this preview.",
      true,
    ),
  );
  main.append(
    secondary,
    link("Inspect states and patterns", "#/specimen/states", "specimen-footer"),
  );
}
function states() {
  main.append(note());
  const heading = el("header", "page-header");
  heading.append(
    el("h1", "", "States & patterns"),
    el(
      "p",
      "",
      "Read-only examples. Counts below are fixtures, not current Meta evidence.",
    ),
  );
  main.append(heading);
  const support = el("div", "support");
  support.append(link("← Back to card specimen", "#/specimen"));
  const grid = el("div", "states-grid");
  grid.append(
    state(
      "loading",
      "Loading sample cards",
      "Reserved space while a request is pending.",
    ),
    state("empty", "No cards match", "Try another card group."),
    state(
      "partial",
      "Some artwork is unavailable",
      "Card names, quantities and exact printings remain visible.",
    ),
    state(
      "error",
      "Sample request failed",
      "This is a deliberate error specimen. Retry demonstrates an announcement.",
      (node, button) => {
        node.querySelector("h3").textContent = "Sample retry complete";
        node.querySelector("p").textContent =
          "Fixture recovered. No network or user data was changed.";
        node.querySelector("p").setAttribute("role", "status");
        button.textContent = "Retry sample again";
      },
    ),
  );
  support.append(
    grid,
    disclosure(
      "collapsed-example",
      "Collapsed disclosure",
      "Secondary content remains keyboard accessible.",
    ),
    disclosure(
      "expanded-example",
      "Expanded disclosure",
      "Secondary information is visible without another nested panel.",
      true,
    ),
  );
  support.append(
    el("h2", "", "Dense data rows"),
    denseRow("Raging Bolt Ogerpon", "12.8%"),
    denseRow("Dragapult Dusknoir", "9.4%"),
    denseRow("Alakazam Dudunsparce — long archetype label", "3.1%"),
  );
  support.append(el("h2", "", "Missing artwork"));
  support.append(
    artworkHeader({
      name: "Cynthia’s Garchomp ex — missing-art specimen",
      card: {},
      level: "h2",
    }),
  );
  const list = el("ul", "card-list");
  list.append(
    cardRow(
      {
        name: "A deliberately long exact printing name with unavailable artwork",
        quantity: 2,
      },
      inspector,
    ),
  );
  support.append(list);
  main.append(support);
}
function transition(route) {
  const heading = el("header", "page-header");
  heading.append(el("h1", "", route.label));
  const body = el("section", "transition");
  body.append(
    el(
      "p",
      "",
      `${route.label} opens in the existing V2 app during this preview. Use browser Back through any V2 navigation to return here. Your specimen position and display are retained.`,
    ),
  );
  const exit = link(
    `Open ${route.label} in V2`,
    legacyUrl(route.id, location.href),
    "primary",
  );
  exit.onclick = () => save();
  body.append(exit, link("Return to specimen", "#/specimen"));
  main.append(heading, body);
}
function render(focus = false) {
  rendering = true;
  document.querySelectorAll("dialog[open]").forEach((node) => node.close());
  ui = cleanState(history.state);
  retained = history.state?.previewContexts || {};
  const route = parseRoute(location.hash);
  main.replaceChildren();
  document.querySelectorAll(".bottom-nav a").forEach((a) => {
    if (a.hash === `#/${route.id}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (route.kind === "legacy") transition(route);
  else if (route.id === "specimen") specimen();
  else if (route.id === "states") states();
  else {
    const heading = el("header", "page-header");
    heading.append(
      el("h1", "", "Preview route not found"),
      el("p", "", "This preview has no destination at that address."),
      link("Open component specimen", "#/specimen"),
    );
    main.append(heading);
  }
  if (history.state?.v3 && ui.details !== null)
    main
      .querySelectorAll("details")
      .forEach((node) => (node.open = ui.details.includes(node.id)));
  document.title = `${route.label || { specimen: "Component specimen", states: "States & patterns", unknown: "Route not found" }[route.id]} · PTCG Tools preview`;
  requestAnimationFrame(() => {
    if (focus) main.focus({ preventScroll: true });
    window.scrollTo(0, ui.scroll);
    rendering = false;
    save();
  });
}
window.addEventListener("popstate", () => render(true));
window.addEventListener("pagehide", save);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    ui = cleanState(history.state);
    window.scrollTo(0, ui.scroll);
  }
});
let scrollTimer;
window.addEventListener(
  "scroll",
  () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(save, 80);
  },
  { passive: true },
);
main.addEventListener("toggle", save, true);
render();
