// Presentation-only adapter. The production resolver supplies the entire ordered
// candidate chain; this module only binds it to a dimension-reserved image node.
export async function attachArtwork(
  host,
  card,
  { focal = { x: 50, y: 36 }, eager = false, api = window.PTCGCardImages } = {},
) {
  const generation = (host._artGeneration || 0) + 1;
  host._artGeneration = generation;
  // Never remove the canonical sprite inside the fallback treatment.
  host.querySelector(":scope > .art-image")?.remove();
  host.dataset.art = "loading";
  host.style.setProperty(
    "--art-x",
    `${Math.max(0, Math.min(100, Number(focal.x) || 0))}%`,
  );
  host.style.setProperty(
    "--art-y",
    `${Math.max(0, Math.min(100, Number(focal.y) || 0))}%`,
  );
  let result;
  try {
    result = await api.resolve(card, { quality: "high" });
  } catch {
    result = { candidates: [] };
  }
  if (host._artGeneration !== generation) return;
  const candidates = result.candidates || [];
  if (!candidates.length) {
    host.dataset.art = "missing";
    return;
  }
  const img = document.createElement("img");
  img.className = "art-image";
  img.alt = "";
  img.loading = eager ? "eager" : "lazy";
  img.decoding = "async";
  let index = 0;
  img.onload = () => {
    if (host._artGeneration === generation) host.dataset.art = "ready";
  };
  img.onerror = () => {
    if (host._artGeneration !== generation) return;
    if (++index < candidates.length) img.src = candidates[index];
    else {
      img.remove();
      host.dataset.art = "missing";
    }
  };
  img.src = candidates[0];
  host.append(img);
}
