// Shared deck parser for PTCG Tools (supports common PTCGL + Limitless text formats)
(function () {
  function normalizeLine(line) {
    return (line || "").replace(/\s+/g, " ").trim();
  }

  // Attempts to parse lines like:
  // 4 Card Name (SET 123)
  // 4 Card Name SET 123
  // 1 Card Name (SVI 123)
  // Also tolerates "Card Name" lines without count.
  function parseCardLine(line) {
    const raw = normalizeLine(line);
    if (!raw) return null;

    // Ignore headers commonly found in exports
    const lower = raw.toLowerCase();
    if (
      lower === "pokémon:" || lower === "pokemon:" ||
      lower === "trainer cards:" || lower === "trainers:" ||
      lower === "energy:" || lower === "basic energy:" ||
      lower.startsWith("total cards") ||
      lower.startsWith("deck list") ||
      lower.startsWith("decklist")
    ) {
      return { kind: "header" };
    }

    // Leading count
    const mCount = raw.match(/^(\d+)\s+(.+)$/);
    if (!mCount) {
      // Could be a comment or uncounted line; treat as note
      return { kind: "other", raw };
    }

    const count = parseInt(mCount[1], 10);
    let rest = mCount[2].trim();

    // PTCGL style: Name (SET 123)
    let set = null;
    let number = null;

    const mParen = rest.match(/^(.*)\s+\(([A-Za-z0-9\-]+)\s+(\d+)\)\s*$/);
    if (mParen) {
      const name = mParen[1].trim();
      set = mParen[2].trim();
      number = mParen[3].trim();
      return { kind: "card", count, name, set, number, raw };
    }

    // Limitless style: Name SET 123 (set can include hyphen, letters)
    const mTail = rest.match(/^(.*)\s+([A-Za-z0-9\-]+)\s+(\d+)\s*$/);
    if (mTail) {
      const name = mTail[1].trim();
      set = mTail[2].trim();
      number = mTail[3].trim();
      return { kind: "card", count, name, set, number, raw };
    }

    // No set/number detected; still a card
    return { kind: "card", count, name: rest, set: null, number: null, raw };
  }

  function detectSectionFromLine(line) {
    const l = normalizeLine(line).toLowerCase();
    if (l === "pokémon:" || l === "pokemon:") return "pokemon";
    if (l === "trainer cards:" || l === "trainers:" || l === "trainer:") return "trainers";
    if (l === "energy:" || l === "basic energy:" || l === "energy cards:") return "energy";
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
      } else {
        otherLines.push(parsed.raw);
      }
    }

    // Totals and indices
    const byName = new Map(); // nameLower -> {name, total, bySection}
    let totalCards = 0;
    const totals = { pokemon: 0, trainers: 0, energy: 0, unknown: 0 };

    for (const c of cards) {
      const key = c.name.toLowerCase();
      const prev = byName.get(key) || { name: c.name, total: 0, bySection: { pokemon: 0, trainers: 0, energy: 0, unknown: 0 } };
      prev.total += c.count;
      prev.bySection[c.section] = (prev.bySection[c.section] || 0) + c.count;
      byName.set(key, prev);

      totals[c.section] = (totals[c.section] || 0) + c.count;
      totalCards += c.count;
    }

    // Sections list
    const sections = {
      pokemon: [],
      trainers: [],
      energy: [],
      unknown: []
    };
    for (const c of cards) sections[c.section].push(c);

    return {
      cards,
      sections,
      byName,
      totals,
      totalCards,
      otherLines
    };
  }

  window.PTCGDeckParser = { parseDeck };
})();