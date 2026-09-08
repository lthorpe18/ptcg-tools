import fs from 'node:fs/promises';
import formatResolver from '../v2-preview/apps/_shared/format-resolver.js';

export const calendar = JSON.parse(await fs.readFile(new URL('../data/formats/maintained-calendar.json', import.meta.url), 'utf8'));
export const resolver = formatResolver.create(calendar);
export const day = value => {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(text)) throw new Error(`Missing/invalid event date: ${text}`);
  return formatResolver.dateOnly(text.slice(0,10));
};
export function formatAt(date, environment, rules = resolver) {
  if (!['online','irl'].includes(environment)) throw new Error('Unknown environment');
  return rules.resolve(day(date)).environments[environment].formatContext;
}
export function classifyEvent(event, environment, declaredFormat, rules = resolver) {
  const date = day(event.date);
  const context = formatAt(date, environment, rules);
  if (context && !context.contextId) throw new Error(`Unknown ${environment} event-date format on ${date}`);
  if (event.format && event.format !== declaredFormat) throw new Error(`Event ${event.id} format disagrees with dataset`);
  if (!declaredFormat) throw new Error('Dataset format is required');
  if (context?.contextId && context.label !== declaredFormat) throw new Error(`Event ${event.id} (${date}, ${environment}) is ${context.label}, not ${declaredFormat}`);
  // Existing ingested history predates the owner's baseline. Preserve its source
  // declaration, with no invented legality start or claim of calendar verification.
  return {...event, format:declaredFormat, formatEvidence:{environment, date, basis:context?.contextId?'maintained-calendar':'source-declared-history', contextId:context?.contextId || null, calendarRevision:rules.revision, unknowns:context?.contextId?[]:['Historical date not covered by maintained calendar']}};
}
export function validateDataset(payload, environment, expected, rules = resolver) {
  if (!payload || payload.format !== expected) throw new Error(`${environment} source format mismatch: expected ${expected}, got ${payload?.format}`);
  const events = payload.tournaments || payload.events || [];
  const classified = events.map(event=>classifyEvent(event,environment,expected,rules));
  for (const result of payload.results || []) classifyEvent(result,environment,expected,rules);
  for (const event of classified) for (const result of event.results || []) {
    classifyEvent(result,environment,expected,rules);
    if (String(result.eventId) !== String(event.id)) throw new Error('Result event identity mismatch');
  }
  return classified;
}
export function ingestionContext(environment, date = new Date().toISOString()) {
  const context = formatAt(date,environment);
  if (!context?.contextId) throw new Error(`Unknown ${environment} format on ${date}`);
  const dates = calendar.sets.filter(set=>context.addedSetIds.includes(set.id)).map(set=>set.legality[environment].value).filter(Boolean).sort();
  // Legacy ingestion query boundary, NOT a verified release or legality date.
  const queryStart = dates.at(-1) || '2026-07-17';
  return {format:context.label, context, queryStart, queryStartBasis:dates.length?'maintained-legality':'legacy-source-query-boundary', date:day(date)};
}

// During an Online/IRL split, finish collecting the outgoing Online format as
// well as the new one. This closes the gap between the last daily run and midnight.
export function ingestionJobs(environment, date = new Date().toISOString()) {
  const today=day(date), current=ingestionContext(environment,date);
  const transitions=[calendar.baseline.asOf,...calendar.sets.map(set=>set.legality?.[environment]?.value).filter(Boolean)].filter(d=>d<=today).sort();
  const last=transitions.at(-1);
  if(!last || last===calendar.baseline.asOf)return [current];
  const before=new Date(last+'T00:00:00Z');before.setUTCDate(before.getUTCDate()-1);
  const previous=ingestionContext(environment,before.toISOString());
  const other=formatAt(date,environment==='online'?'irl':'online');
  const recent=(new Date(today)-new Date(last))/86400000<=2;
  return previous.format!==current.format && (recent || other?.label===previous.format)
    ? [{...previous,queryEnd:last},current] : [current];
}

export function verifyAggregateQuery(html, {format,set,rotation}) {
  // Preserve the established source query. A new query must be acknowledged by
  // the response, otherwise an unsupported set parameter could return old data.
  if(format==='TEF-PBL' && set==='PBL' && rotation===2026)return 'legacy-source-query';
  function selected(name) {
    for(const match of String(html).matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
      if(!new RegExp(`\\bname\\s*=\\s*["']${name}["']`,'i').test(match[1]))continue;
      for(const option of match[2].matchAll(/<option\b([^>]*)>/gi))if(/(?:^|\s)selected(?:\s|=|$)/i.test(option[1]))return option[1].match(/\bvalue\s*=\s*["']([^"']*)["']/i)?.[1];
    }
    return null;
  }
  if(selected('set')!==String(set) || selected('rotation')!==String(rotation))throw new Error('Source did not confirm requested aggregate format filters; refusing to relabel its data');
  return 'source-confirmed-query';
}
