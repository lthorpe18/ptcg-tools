import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create}=require('../v2-preview/apps/_shared/format-resolver.js');
const seed=require('../data/formats/verified-seed.json');
const synthetic=require('../tests/fixtures/format-synthetic.json');
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
