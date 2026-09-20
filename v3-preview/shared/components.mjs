import { attachArtwork } from "./artwork.mjs";
export const el = (tag, className = "", text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
export function sprite(name, size = 36) {
  const node = el("span");
  try {
    node.innerHTML = window.DeckSprites.html(String(name), { size });
  } catch {
    node.textContent = "◇";
    node.setAttribute("aria-hidden", "true");
  }
  return node;
}
export function artworkHeader({ name, card, focal, level = "h1" }) {
  const node = el("header", "artwork-header");
  node.append(el(level, "", name));
  const fallback = el("span", "art-fallback");
  fallback.append(sprite(name, 48));
  node.append(fallback);
  attachArtwork(node, card, { focal, eager: true });
  return node;
}
export function cardArt(card, className = "") {
  const node = el("span", `card-art ${className}`);
  node.append(el("span", "missing-label", "No art"));
  attachArtwork(node, card);
  return node;
}
export function toolbar(label) {
  const node = el("div", "section-toolbar");
  node.setAttribute("role", "group");
  node.setAttribute("aria-label", label);
  return node;
}
export function cardRow(card, onInspect) {
  const li = el("li");
  const button = el("button", "card-row");
  button.type = "button";
  button.append(el("span", "quantity", `${card.quantity}×`), cardArt(card));
  const name = el("span", "name", card.name);
  name.append(
    el(
      "span",
      "meta",
      [card.set, card.number].filter(Boolean).join(" · ") ||
        "Printing unavailable",
    ),
  );
  button.append(name, el("span", "chevron", "↗"));
  button.setAttribute(
    "aria-label",
    `Inspect ${card.name}, ${card.set || "unknown printing"} ${card.number || ""}, ${card.quantity} copies`,
  );
  button.onclick = () => onInspect(card, button);
  li.append(button);
  return li;
}
export function disclosure(id, title, text, open = false) {
  const node = el("details", "disclosure");
  node.id = id;
  node.open = open;
  node.append(el("summary", "", title), el("div", "detail-body", text));
  return node;
}
export function denseRow(name, value) {
  const row = el("div", "dense-row");
  row.append(
    sprite(name),
    el("span", "grow", name),
    el("span", "value", value),
  );
  return row;
}
export function state(kind, title, message, retry) {
  const node = el("section", `state ${kind}`);
  node.append(el("h3", "", title), el("p", "", message));
  if (kind === "loading") {
    node.setAttribute("role", "status");
    const lines = el("div", "loading-lines");
    lines.setAttribute("aria-hidden", "true");
    lines.append(el("span"), el("span"));
    node.append(lines);
  }
  if (retry) {
    const button = el("button", "", "Retry sample");
    button.onclick = () => retry(node, button);
    node.append(button);
  }
  return node;
}
export function dialog(title, trigger, { sheet = false } = {}) {
  const node = el("dialog", sheet ? "sheet" : "inspector");
  const heading = el("h2", "", title);
  heading.id = "dialog-title";
  node.setAttribute("aria-labelledby", heading.id);
  const bar = el("div", "dialog-toolbar");
  const close = el("button", "", "Close");
  close.autofocus = true;
  close.onclick = () => node.close();
  bar.append(heading, close);
  node.append(bar);
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...node.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    ].filter((control) => control.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  node.addEventListener(
    "close",
    () => {
      node.remove();
      if (trigger?.isConnected) trigger.focus();
    },
    { once: true },
  );
  document.body.append(node);
  return node;
}
export function inspector(card, trigger) {
  const node = dialog(card.name, trigger);
  node.append(
    el(
      "p",
      "meta",
      `${card.set || "Printing unavailable"} ${card.number || ""} · Read-only fixture`,
    ),
    cardArt(card, "inspector-art"),
  );
  node.showModal();
}
