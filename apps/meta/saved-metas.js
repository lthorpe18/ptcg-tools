(() => {
  const STORAGE_KEY = 'ptcg-tools.meta-lab.saved-metas.v1';

  function cleanField(field) {
    const rows = (Array.isArray(field) ? field : [])
      .map(row => ({ name: String(row?.name || '').trim(), share: Number(row?.share || 0) }))
      .filter(row => row.name && row.name !== 'Other' && row.name !== 'Unknown' && row.share > 0);
    const total = rows.reduce((sum, row) => sum + row.share, 0);
    if (!total) return [];
    return rows.map(row => ({ name: row.name, share: row.share / total }));
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(x => x?.id && x?.name && Array.isArray(x?.field)) : [];
    } catch (error) {
      console.warn('Could not read saved Meta Lab metas', error);
      return [];
    }
  }

  function write(rows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      window.dispatchEvent(new CustomEvent('savedmetas:updated'));
      return true;
    } catch (error) {
      console.warn('Could not save Meta Lab metas', error);
      return false;
    }
  }

  function list() {
    return read().sort((a, b) => a.name.localeCompare(b.name));
  }

  function get(id) {
    return read().find(row => row.id === id) || null;
  }

  function save(name, field, format = '') {
    const cleanName = String(name || '').trim();
    const clean = cleanField(field);
    if (!cleanName || !clean.length) return null;

    const rows = read();
    const now = new Date().toISOString();
    const existing = rows.find(row => row.name.toLowerCase() === cleanName.toLowerCase());
    const item = existing || {
      id: `meta-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
    };
    item.name = cleanName;
    item.field = clean;
    item.format = String(format || '');
    item.updatedAt = now;

    if (!existing) rows.push(item);
    if (!write(rows)) return null;
    return item;
  }

  function remove(id) {
    const rows = read();
    const next = rows.filter(row => row.id !== id);
    if (next.length === rows.length) return false;
    return write(next);
  }

  window.SavedMetas = { list, get, save, remove, cleanField };
})();
