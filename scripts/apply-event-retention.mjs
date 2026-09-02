import fs from 'node:fs/promises';

const APP='v2-preview/apps/events/app.js';
const HTML='v2-preview/apps/events/index.html';
const CSS='v2-preview/apps/events/styles.css';
const MASTER='PTCG_TOOLS_MASTER.md';

function replaceOnce(text,regex,replacement,label){
  if(!regex.test(text))throw new Error(`Could not find ${label}`);
  return text.replace(regex,replacement);
}

let app=await fs.readFile(APP,'utf8');

if(!app.includes("manageOrganisers:$('manageOrganisersButton')")){
  app=replaceOnce(app,
    /yourVenuesSection:\$\('yourVenuesSection'\),yourVenuesList:\$\('yourVenuesList'\),resultsTitle:/,
    "yourVenuesSection:$('yourVenuesSection'),yourVenuesList:$('yourVenuesList'),manageOrganisers:$('manageOrganisersButton'),resultsTitle:",
    'organiser management element');
}
if(!app.includes('let organiserManage=false;')){
  app=replaceOnce(app,/  let savedOnly=false;\n/,"  let savedOnly=false;\n  let organiserManage=false;\n",'organiser management state');
}

if(!app.includes('function organiserNameKey(')){
  app=replaceOnce(app,
    /  function savedOrganiserRows\(\)\{[^\n]*\}\n  function savedOrganiserKeys\(\)\{[^\n]*\}\n  function isSavedOrganiser\(event\)\{[^\n]*\}\n  function organiserRowName\(row\)\{[^\n]*\}\n  function organiserSnapshot\(event\)\{[^\n]*\}\n  function toggleOrganiser\(event\)\{.*?\n  \}\n/s,
`  function organiserRowName(row){return displayOrganiserLabel(typeof row==='string'?row:(row&&row.name)||(row&&row.organiser)||'Saved organiser')}\n  function organiserNameKey(value){const name=typeof value==='string'?value:(value&&value.scope==='local'?organiserName(value):(value&&value.name)||(value&&value.organiser)||'');const canonical=aliasOrganiserLabel(name);return canonical?canonical.toLowerCase().replace(/\\s+/g,' '):null}\n  function organiserRowToken(row){return organiserIdentity(row)||((organiserNameKey(row))?\`name:\${organiserNameKey(row)}\`:null)}\n  function organiserMatches(row,event){const rowId=organiserIdentity(row),eventId=organiserIdentity(event);if(rowId&&eventId&&rowId===eventId)return true;const a=organiserNameKey(row),b=organiserNameKey(event);return !!a&&a===b}\n  function savedOrganiserRows(){const seen=new Set();return (currentState().favouriteOrganisers||[]).filter(row=>{const key=organiserRowToken(row);if(!key||seen.has(key))return false;seen.add(key);return true})}\n  function savedOrganiserKeys(){return new Set(savedOrganiserRows().map(organiserRowToken).filter(Boolean))}\n  function isSavedOrganiser(event){return savedOrganiserRows().some(row=>organiserMatches(row,event))}\n  function organiserSnapshot(event){const key=organiserIdentity(event),name=organiserName(event),id=event&& (event.organiserId||event.organizerId||event.leagueId||event.shopId);return key&&name?{organiserKey:key,organiserId:id||null,name,source:event.source||null,savedAt:new Date().toISOString()}:null}\n  function reconcileSavedOrganisers(){\n    if(!window.PTCGStorage?.update)return;const saved=currentState().favouriteOrganisers||[];if(!saved.length)return;\n    const liveByName=new Map();for(const event of events.filter(e=>e.scope==='local')){const nameKey=organiserNameKey(event),id=organiserIdentity(event);if(!nameKey||!id)continue;const bucket=liveByName.get(nameKey)||new Map();bucket.set(id,event);liveByName.set(nameKey,bucket)}\n    let changed=false;const reconciled=[],seen=new Set();\n    for(const row of saved){let next=row;const nameKey=organiserNameKey(row),matches=nameKey?liveByName.get(nameKey):null;if(matches&&matches.size===1){const event=[...matches.values()][0],stable=organiserIdentity(event);if(stable&&organiserIdentity(row)!==stable){next={...row,organiserKey:stable,organiserId:event.organiserId||event.organizerId||event.leagueId||event.shopId||null,name:organiserName(event)||organiserRowName(row),source:event.source||row.source||null};changed=true}}const token=organiserRowToken(next);if(!token||seen.has(token)){changed=true;continue}seen.add(token);reconciled.push(next)}\n    if(changed)window.PTCGStorage.update(state=>{state.favouriteOrganisers=reconciled;return state});\n  }\n  function removeSavedOrganiser(token){if(!window.PTCGStorage?.update||!token)return;let removed=false;window.PTCGStorage.update(state=>{state.favouriteOrganisers=(state.favouriteOrganisers||[]).filter(row=>{const match=organiserRowToken(row)===token;if(match)removed=true;return !match});return state});if(removed)toast('Organiser removed');render()}\n  function toggleOrganiser(event){\n    if(!window.PTCGStorage||event.scope!=='local'||!organiserIdentity(event))return;const wasSaved=isSavedOrganiser(event);\n    window.PTCGStorage.update(state=>{state.favouriteOrganisers=Array.isArray(state.favouriteOrganisers)?state.favouriteOrganisers:[];if(wasSaved)state.favouriteOrganisers=state.favouriteOrganisers.filter(row=>!organiserMatches(row,event));else{const snapshot=organiserSnapshot(event);if(snapshot)state.favouriteOrganisers.push(snapshot)}return state});\n    toast(wasSaved?'Organiser removed':'Organiser saved');render();\n  }\n`,
    'saved organiser identity block');
}

app=replaceOnce(app,
  /  function renderYourOrganisers\(\)\{.*?\n  \}\n\n  function externalLink/s,
`  function renderYourOrganisers(){\n    const rows=savedOrganiserRows(),show=activeView==='nearby'&&rows.length>0;els.yourVenuesSection.classList.toggle('hidden',!show);if(!show){els.yourVenuesList.innerHTML='';organiserManage=false;if(els.manageOrganisers){els.manageOrganisers.textContent='Manage';els.manageOrganisers.setAttribute('aria-pressed','false')}return}\n    const upcoming=events.filter(e=>e.scope==='local'&&!isPast(e)).sort(sortAscending);\n    if(els.manageOrganisers){els.manageOrganisers.textContent=organiserManage?'Done':'Manage';els.manageOrganisers.setAttribute('aria-pressed',String(organiserManage))}\n    els.yourVenuesList.innerHTML=rows.map(row=>{const next=upcoming.find(e=>organiserMatches(row,e)),name=organiserRowName(row),nextLine=next?\`\${typeLabel(next)} · \${compactDate(next)}\`:'No upcoming event in current feed',distance=next?eventDistanceMiles(next):null,meta=next?[placeLine(next),next.city&&next.city!==next.venue?next.city:null,Number.isFinite(distance)?\`\${distance.toFixed(1)} mi\`:null].filter(Boolean).join(' · '):'Saved organiser',token=organiserRowToken(row);return \`<article class="saved-venue-card"><div class="saved-venue-card-top"><strong>\${escapeHtml(name)}</strong>\${organiserManage?\`<button class="saved-organiser-remove" type="button" data-remove-organiser="\${escapeHtml(token||'')}" aria-label="Remove \${escapeHtml(name)}">Remove</button>\`:'<span class="saved-venue-star">★</span>'}</div><div class="saved-venue-next">\${escapeHtml(nextLine)}</div><div class="saved-venue-meta">\${escapeHtml(meta)}</div></article>\`}).join('');\n  }\n\n  function externalLink`,
  'renderYourOrganisers');

if(!app.includes('reconcileSavedOrganisers();rollPastAttendingToAttended();')){
  app=app.replace('rollPastAttendingToAttended();setLoading(false)','reconcileSavedOrganisers();rollPastAttendingToAttended();setLoading(false)');
}
if(!app.includes("els.manageOrganisers?.addEventListener")){
  app=replaceOnce(app,
    /  els\.savedVenuesFilter\?\.addEventListener\('click',.*?\n/,
    match=>match+"  els.manageOrganisers?.addEventListener('click',()=>{organiserManage=!organiserManage;renderYourOrganisers()});\n  els.yourVenuesList?.addEventListener('click',event=>{const button=event.target.closest('[data-remove-organiser]');if(!button)return;removeSavedOrganiser(button.dataset.removeOrganiser)});\n",
    'organiser management listeners');
}

app=app.replace(/\.sort\(\(a,b\)=>\{const da=eventDistanceMiles\(a\),db=eventDistanceMiles\(b\);if\(Number\.isFinite\(da\)&&Number\.isFinite\(db\)&&Math\.abs\(da-db\)>\.05\)return da-db;return sortAscending\(a,b\)\}\)/g,'.sort(sortAscending)');
await fs.writeFile(APP,app);

let html=await fs.readFile(HTML,'utf8');
if(!html.includes('id="manageOrganisersButton"')){
  html=html.replace(
    '<div class="your-venues-head"><div><strong id="yourVenuesTitle">Your organisers</strong><small>Next event from each saved organiser</small></div></div>',
    '<div class="your-venues-head"><div><strong id="yourVenuesTitle">Your organisers</strong><small>Next event from each saved organiser</small></div><button id="manageOrganisersButton" class="manage-organisers-button" type="button" aria-pressed="false">Manage</button></div>');
}
html=html.replace('./app.js?v=10','./app.js?v=12').replace('./app.js?v=11','./app.js?v=12').replace('./styles.css?v=5','./styles.css?v=6');
await fs.writeFile(HTML,html);

let css=await fs.readFile(CSS,'utf8');
if(!css.includes('.manage-organisers-button')){
  css+='\n.manage-organisers-button{border:0;background:transparent;color:#175cd3;font:inherit;font-size:11px;font-weight:800;padding:4px 2px}.saved-organiser-remove{border:1px solid #fecdca;border-radius:8px;background:#fff;color:#d92d20;font:inherit;font-size:10px;font-weight:800;padding:5px 8px}.saved-organiser-remove:active{background:#fef3f2}\n';
}
await fs.writeFile(CSS,css);

let master=await fs.readFile(MASTER,'utf8');
const lifecycle='Passing the event date must never silently imply that tournament results were entered.';
const organiserContract=' Saved organiser identity should prefer a stable source organiser/league ID where available. Legacy name-based favourites are reconciled to a stable ID only when the canonical organiser name maps unambiguously to one live source identity; matching retains a canonical-name fallback so feed normalization cannot silently orphan a favourite. Compete exposes a small organiser-management control for explicitly removing saved organisers.';
if(master.includes(lifecycle)&&!master.includes('Legacy name-based favourites are reconciled')){
  master=master.replace(lifecycle,lifecycle+organiserContract);
  await fs.writeFile(MASTER,master);
}

console.log('Applied event retention, organiser reconciliation, management and date-sort contract.');