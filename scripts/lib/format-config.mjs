import fs from 'node:fs/promises';
import path from 'node:path';

export const SUPABASE_URL = 'https://naylqcyrnhjvqodjpjsg.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Nr1MmUClNYQcD1vxkoJZog_VfOtBzFQ';
const FALLBACK = path.resolve('v2-preview/data/meta/config-default.json');

const asDate = value => {
  if (!value) return null;
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
};

async function rest(pathname) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    headers: { apikey: SUPABASE_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Supabase config ${response.status}: ${pathname}`);
  return response.json();
}

async function fallbackConfig() {
  return JSON.parse(await fs.readFile(FALLBACK, 'utf8'));
}

function normaliseFormula(row = {}) {
  return {
    id: row.id || null,
    versionKey: row.version_key || row.versionKey || 'blended-v2',
    versionNumber: Number(row.version_number ?? row.versionNumber ?? 2),
    irlStartWeight: Number(row.irl_start_weight ?? row.irlStartWeight ?? 0.70),
    irlDecayPerDay: Number(row.irl_decay_per_day ?? row.irlDecayPerDay ?? 0.02),
    irlFloor: Number(row.irl_floor ?? row.irlFloor ?? 0.30),
    previousFormatCap: Number(row.previous_format_cap ?? row.previousFormatCap ?? 0.25),
    transitionPolicy: row.transition_policy || row.transitionPolicy || 'format-aware-v2',
    status: row.status || 'published',
    notes: row.notes || '',
  };
}

export async function loadPublishedConfig({ allowFallback = true } = {}) {
  try {
    const [registries, pointers] = await Promise.all([
      rest('ptcg_format_registry_versions?status=eq.published&select=id,version_number,sets,published_at&order=version_number.desc&limit=1'),
      rest('ptcg_blended_live_formula?select=formula_id,activated_at&singleton=eq.true&limit=1'),
    ]);
    if (!registries?.[0]) throw new Error('No published format registry');
    const pointer = pointers?.[0];
    let formula = null;
    if (pointer?.formula_id) {
      const rows = await rest(`ptcg_blended_formula_versions?id=eq.${encodeURIComponent(pointer.formula_id)}&select=*&limit=1`);
      formula = rows?.[0] || null;
    }
    if (!formula) throw new Error('No live blended formula');
    return {
      source: 'supabase',
      formatRegistryId: registries[0].id,
      formatRegistryVersion: Number(registries[0].version_number),
      formatPublishedAt: registries[0].published_at || null,
      sets: [...(registries[0].sets || [])].sort((a,b) => Number(a.releaseOrder) - Number(b.releaseOrder)),
      liveFormula: normaliseFormula(formula),
      formulaActivatedAt: pointer?.activated_at || null,
    };
  } catch (error) {
    if (!allowFallback) throw error;
    const fallback = await fallbackConfig();
    console.warn(`Using in-repo format config fallback: ${error.message}`);
    return {
      source: 'fallback',
      formatRegistryId: null,
      formatRegistryVersion: Number(fallback.formatRegistryVersion || 0),
      formatPublishedAt: null,
      sets: [...(fallback.sets || [])].sort((a,b) => Number(a.releaseOrder) - Number(b.releaseOrder)),
      liveFormula: normaliseFormula(fallback.liveFormula || {}),
      formulaActivatedAt: null,
    };
  }
}

function dateField(channel) {
  return channel === 'irl' ? 'irlLegalDate' : 'onlineLegalDate';
}

export function resolveFormatAt(sets, channel = 'online', at = new Date()) {
  const when = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(when.getTime())) return null;
  const field = dateField(channel);
  const ordered = [...(sets || [])].sort((a,b) => Number(a.releaseOrder) - Number(b.releaseOrder));
  const eligible = ordered.filter(set => {
    const date = asDate(set[field]);
    return date && date.getTime() <= when.getTime();
  });
  if (!eligible.length) return null;
  const upper = eligible.at(-1);
  const rotations = eligible.filter(set => set.isRotationSet && set.rotationLowerSetCode);
  const latestRotation = rotations.at(-1) || null;
  const lowerCode = latestRotation?.rotationLowerSetCode || ordered[0]?.setCode || upper.setCode;
  const lower = ordered.find(set => set.setCode === lowerCode) || null;
  const start = asDate(upper[field]);
  const rotationDate = latestRotation ? asDate(latestRotation[field]) : null;
  return {
    id: `${lowerCode}-${upper.setCode}`,
    label: `${lowerCode}–${upper.setCode}`,
    lowerSetCode: lowerCode,
    upperSetCode: upper.setCode,
    upperSetTitle: upper.setTitle || upper.setCode,
    startDate: start ? start.toISOString().slice(0,10) : null,
    channel,
    isRotationStart: !!upper.isRotationSet,
    rotationSetCode: latestRotation?.setCode || null,
    rotationLowerSetCode: latestRotation?.rotationLowerSetCode || null,
    rotationYear: rotationDate ? rotationDate.getUTCFullYear() : when.getUTCFullYear(),
    lowerReleaseOrder: Number(lower?.releaseOrder || 0),
    upperReleaseOrder: Number(upper.releaseOrder || 0),
  };
}

export function previousFormat(sets, channel = 'online', at = new Date()) {
  const current = resolveFormatAt(sets, channel, at);
  if (!current) return null;
  const field = dateField(channel);
  const ordered = [...(sets || [])].sort((a,b) => Number(a.releaseOrder) - Number(b.releaseOrder));
  const previousUpper = ordered
    .filter(set => Number(set.releaseOrder) < current.upperReleaseOrder && asDate(set[field]) && asDate(set[field]).getTime() <= new Date(at).getTime())
    .at(-1);
  if (!previousUpper) return null;
  const justBefore = new Date(asDate(current.startDate)?.getTime() - 1 || new Date(at).getTime());
  const resolved = resolveFormatAt(sets, channel, justBefore);
  if (resolved?.upperSetCode === previousUpper.setCode) return resolved;
  const rotations = ordered.filter(set => Number(set.releaseOrder) <= Number(previousUpper.releaseOrder) && set.isRotationSet && set.rotationLowerSetCode && asDate(set[field]));
  const lowerCode = rotations.at(-1)?.rotationLowerSetCode || ordered[0]?.setCode || previousUpper.setCode;
  return {
    id:`${lowerCode}-${previousUpper.setCode}`,
    label:`${lowerCode}–${previousUpper.setCode}`,
    lowerSetCode:lowerCode,
    upperSetCode:previousUpper.setCode,
    upperSetTitle:previousUpper.setTitle || previousUpper.setCode,
    startDate:previousUpper[field],
    channel,
    isRotationStart:!!previousUpper.isRotationSet,
    rotationSetCode:rotations.at(-1)?.setCode || null,
    rotationLowerSetCode:rotations.at(-1)?.rotationLowerSetCode || null,
    rotationYear:asDate(rotations.at(-1)?.[field])?.getUTCFullYear() || new Date(at).getUTCFullYear(),
    upperReleaseOrder:Number(previousUpper.releaseOrder || 0),
  };
}

export function resolveCurrentFormats(config, at = new Date()) {
  return {
    online: resolveFormatAt(config.sets, 'online', at),
    irl: resolveFormatAt(config.sets, 'irl', at),
    previousOnline: previousFormat(config.sets, 'online', at),
    previousIrl: previousFormat(config.sets, 'irl', at),
  };
}

export function formatForEvent(config, eventDate) {
  return resolveFormatAt(config.sets, 'irl', new Date(`${String(eventDate).slice(0,10)}T23:59:59Z`));
}
