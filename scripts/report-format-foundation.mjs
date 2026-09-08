import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create}=require('../v2-preview/apps/_shared/format-resolver.js');
const seed=require('../data/formats/verified-seed.json');
const synthetic=require('../tests/fixtures/format-synthetic.json');
const maintained=require('../data/formats/maintained-calendar.json');
console.log('## User-maintained current calendar');
console.log('Dates supplied by the project owner; not independently verified. Unknown release/history data remain unknown.');
console.log('| Date | Online format | IRL format | Lowest mark / set | Next Online / IRL scheduled change | 30C release |');
console.log('|---|---|---|---|---|---|');
for(const date of ['2026-09-08','2026-09-14','2026-09-15','2026-09-23','2026-09-24','2026-09-25']) {
  const r=create(maintained).resolve(date), o=r.environments.online, i=r.environments.irl;
  console.log(`| ${date} | ${o.formatContext.label} | ${i.formatContext.label} | ${o.maintainedBoundary.lowestMark} / ${o.maintainedBoundary.earliestSet} | ${o.nextScheduledChange.date||'Unknown'} / ${i.nextScheduledChange.date||'Unknown'} | Unknown |`);
}
console.log('\nNext rotation: unknown. Releases after 30C: unknown. H–J remains the maintained regulation range.\n');
console.log('## Historical evidence and synthetic acceptance fixtures');
const cases=[
  [seed,'2025-07-17','Real simultaneous Online admission'],
  [seed,'2025-07-18','Real simultaneous tabletop release'],
  [seed,'2026-03-25','Real before Online rotation'],
  [seed,'2026-03-26','Real Online rotation/admission; no tabletop release'],
  [seed,'2026-03-27','Real tabletop release; IRL rotation still pending'],
  [seed,'2026-04-10','Real IRL rotation/admission'],
  [seed,'2026-09-08','Outside verified rotation coverage'],
  [synthetic,'2030-01-20','SYNTHETIC normal'],
  [synthetic,'2030-02-01','SYNTHETIC split + simultaneous additions'],
  [synthetic,'2030-02-02','SYNTHETIC released; IRL still old'],
  [synthetic,'2030-02-15','SYNTHETIC both adopt'],
  [synthetic,'2030-03-01','SYNTHETIC rotation without release'],
  [synthetic,'2030-03-15','SYNTHETIC IRL catches up'],
];
console.log('| Date | Case | Released (registered only) | Online lower mark / legal sets | IRL lower mark / legal sets | Full identities | Next Online / IRL change |');
console.log('|---|---|---|---|---|---|---|');
const env=e=>`${e.boundary?.lowestMark || '?'} / ${e.legalSets.map(s=>s.id).join(', ') || '?'}${e.unknownSets.length?' (incomplete)':''}`;
const next=e=>`${e.nextChange.date||'none known'}${e.nextChange.certainty==='ordering-unknown'?' (order uncertain)':''}`;
for(const [registry,date,label] of cases){
  const r=create(registry).resolve(date), o=r.environments.online, i=r.environments.irl;
  console.log(`| ${date} | ${label} | ${r.releasedSets.join(', ')||'None'} | ${env(o)} | ${env(i)} | ${o.format.id && i.format.id ? o.format.id===i.format.id?'Known, same':'Known, different':'Unknown/incomplete'} | ${next(o)} / ${next(i)} |`);
}
