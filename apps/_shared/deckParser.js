// Shared deck parser for PTCG Tools (supports common PTCGL + Limitless text formats)
(function () {
  function normalizeLine(line) {
    return (line || "").replace(/\s+/g, " ").trim();
  }

  function stripDiacritics(s) {
    try { return (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, ""); } catch { return s || ""; }
  }

  // Attempts to parse lines like:
  // 4 Card Name (SET 123)
  // 4 Card Name SET 123
  // 4 Card Name SET
  function parseCardLine(line) {
    const raw = normalizeLine(line);
    if (!raw) return null;

    // Ignore some export boilerplate
    const lower = stripDiacritics(raw).toLowerCase();
    if (
      lower.startsWith("deck list") ||
      lower.startsWith("decklist") ||
      lower.startsWith("total cards") ||
      lower === "pokemon" || lower === "pokémon" ||
      lower === "trainer" || lower === "trainers" ||
      lower === "energy" || lower === "energies"
    ) {
      return { kind: "header" };
    }

    // Leading count
    const mCount = raw.match(/^(\d+)\s+(.+)$/);
    if (!mCount) return { kind: "other", raw };

    const count = parseInt(mCount[1], 10);
    let rest = mCount[2].trim();

    // PTCGL style: Name (SET 123)
    let m = rest.match(/^(.*)\s*\(\s*([A-Za-z0-9\-]+)\s+(\d+)\s*\)\s*$/);
    if (m) return { kind: "card", count, name: m[1].trim(), set: m[2].trim(), number: m[3].trim(), raw };

    // Limitless style: Name SET 123
    m = rest.match(/^(.*)\s+([A-Za-z0-9\-]+)\s+(\d+)\s*$/);
    if (m) return { kind: "card", count, name: m[1].trim(), set: m[2].trim(), number: m[3].trim(), raw };

    // Limitless sometimes has set without number: Name SET
    m = rest.match(/^(.*)\s+([A-Za-z0-9\-]+)\s*$/);
    if (m) return { kind: "card", count, name: m[1].trim(), set: m[2].trim(), number: null, raw };

    return { kind: "card", count, name: rest, set: null, number: null, raw };
  }

  function detectSectionFromLine(line) {
    const raw = normalizeLine(line);
    if (!raw) return null;

    const l = stripDiacritics(raw).toLowerCase();

    // Accept headings like:
    // "Pokémon: 15", "Pokemon:", "Trainer: 26", "Trainers", "Energy: 19"
    const pokemon = /^\s*pok[eé]mon\s*:?(?:\s*\d+)?\s*$/i;
    const trainer = /^\s*trainer(?:s)?\s*:?(?:\s*\d+)?\s*$/i;
    const energy = /^\s*energ(?:y|ies)\s*:?(?:\s*\d+)?\s*$/i;

    if (pokemon.test(raw) || pokemon.test(l)) return "pokemon";
    if (trainer.test(raw) || trainer.test(l)) return "trainers";
    if (energy.test(raw) || energy.test(l)) return "energy";

    // Other common headers
    if (l === "trainer cards:" || l === "energy cards:" || l === "basic energy:") {
      if (l.includes("trainer")) return "trainers";
      if (l.includes("energy")) return "energy";
    }

    return null;
  }

  function parseDeck(rawText) {
    const lines = (rawText || "").split(/\r?\n/);

    let section = "unknown";
    const cards = [];
    const otherLines = [];

    for (const line of lines) {
      const sec = detectSectionFromLine(line);
      if (sec) {
        section = sec;
        continue;
      }

      const parsed = parseCardLine(line);
      if (!parsed) continue;

      if (parsed.kind === "header") continue;

      if (parsed.kind === "card") {
        cards.push({ ...parsed, section });
      } else if (parsed.kind === "other" && parsed.raw) {
        // ignore blank-ish noise
        if (normalizeLine(parsed.raw)) otherLines.push(parsed.raw);
      }
    }

    const byName = new Map(); // nameLower -> {name,total,bySection}
    let totalCards = 0;
    const totals = { pokemon: 0, trainers: 0, energy: 0, unknown: 0 };

    for (const c of cards) {
      const key = (c.name || "").toLowerCase();
      const prev = byName.get(key) || { name: c.name, total: 0, bySection: { pokemon: 0, trainers: 0, energy: 0, unknown: 0 } };
      prev.total += c.count || 0;
      prev.bySection[c.section] = (prev.bySection[c.section] || 0) + (c.count || 0);
      byName.set(key, prev);

      totals[c.section] = (totals[c.section] || 0) + (c.count || 0);
      totalCards += c.count || 0;
    }

    const sections = { pokemon: [], trainers: [], energy: [], unknown: [] };
    for (const c of cards) (sections[c.section] || sections.unknown).push(c);

    return { cards, sections, byName, totals, totalCards, otherLines };
  }

  window.PTCGDeckParser = { parseDeck };
})();
