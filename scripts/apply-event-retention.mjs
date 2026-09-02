import fs from 'node:fs/promises';

const APP='v2-preview/apps/events/app.js';
const HTML='v2-preview/apps/events/index.html';
const CSS='v2-preview/apps/events/styles.css';
const MASTER='PTCG_TOOLS_MASTER.md';

function replaceOnce(text, regex, replacement, label){
  if(!regex.test(text)) throw new Error(`Could not find ${label}`);
  return text.replace(regex,replacement);
}

let app=await fs.readFile(APP,'utf8');
if(!app.includes('function needsCompletion(')){
  app=replaceOnce(app,
    /  function statusFor\(event\)\{[^\n]*\}\n/,
`  function statusFor(event){const participation=findParticipation(event);if(!participation||!VALID_STATUSES.has(participation.attendanceStatus))return null;return participation.attendanceStatus==='attending'&&isPast(event)?'attended':participation.attendanceStatus}\n  function needsCompletion(participation,event){return !!participation&&isPast(event)&&(participation.attendanceStatus==='attending'||participation.attendanceStatus==='attended')&&!participation.completion}\n  function rollPastAttendingToAttended(){if(!window.PTCGStorage?.update)return;const state=currentState(),ids=(state.eventParticipations||[]).filter(p=>p.attendanceStatus==='attending'&&isPast(snapshotToEvent(p))).map(p=>p.id);if(!ids.length)return;window.PTCGStorage.update(state=>{const now=new Date().toISOString();for(const p of state.eventParticipations||[]){if(!ids.includes(p.id))continue;p.attendanceStatus='attended';p.phase=p.completion?'completed':'needs-completion';p.updatedAt=now}return state})}\n`,
    'statusFor');
}

app=replaceOnce(app,
  /  function savedEvents\(\)\{.*?\}\n  function sortAscending/s,
`  function savedEvents(){const rows=(currentState().eventParticipations||[]).filter(p=>VALID_STATUSES.has(p.attendanceStatus)).map(participation=>({participation,event:snapshotToEvent(participation)}));const filtered=rows.filter(({participation,event})=>{const past=isPast(event),status=participation.attendanceStatus,needs=needsCompletion(participation,event);if(planFilter==='attending')return status==='attending'&&!past;if(planFilter==='interested')return status==='interested'&&!past;if(planFilter==='needs-completion')return needs;if(planFilter==='history')return !needs&&(status==='attended'||status==='skipped'||!!participation.completion);return (status==='attending'||status==='interested')&&!past});filtered.sort((a,b)=>planFilter==='history'?sortDescending(a.event,b.event):sortAscending(a.event,b.event));return filtered.map(x=>x.event)}\n  function sortAscending`,
  'savedEvents');

app=replaceOnce(app,
  /  function cardHtml\(event\)\{.*?\n  \}\n\n  function visibleEvents/s,
`  function cardHtml(event){\n    const status=statusFor(event),participation=findParticipation(event),needs=participation?needsCompletion(participation,event):false,link=externalLink(event),meta=detailLine(event),savedOrganiser=event.scope==='local'&&isSavedOrganiser(event),organiser=organiserName(event);\n    const statusHtml=status?\`<span class="plan-pill \${status}\${needs?' needs-completion':''}">\${escapeHtml(needs?'Needs completion':STATUS_LABELS[status])}</span>\`:'',organiserHtml=savedOrganiser?'<span class="saved-venue-pill">★ Saved organiser</span>':'';\n    const attendLabel=status==='attending'?'Attending ✓':status==='attended'?'Attended ✓':status?STATUS_LABELS[status]:\`I'm attending\`,attendClass=(status==='attending'||status==='attended')?' saved':'';\n    const saveButton=event.scope==='local'&&organiser?\`<button class="venue-save-button\${savedOrganiser?' saved':''}" type="button" data-action="organiser" aria-label="\${savedOrganiser?'Remove saved organiser':'Save organiser'}">\${savedOrganiser?'★':'☆'}</button>\`:'',organiserRow=event.scope==='local'&&organiser?\`<div class="event-venue-row event-organiser-row"><div class="event-organiser">\${escapeHtml(organiser)}</div>\${saveButton}</div>\`:'',locationRow=event.scope==='local'?\`<div class="event-location">\${escapeHtml(placeLine(event))}</div>\`:'';\n    return \`<article class="event-card \${event.scope==='major'?'major-card':''}\${savedOrganiser?' saved-venue-event':''}" data-event-id="\${escapeHtml(eventIdentity(event)||'')}"><div class="event-card-main"><div class="event-topline"><span class="event-type \${typeClass(event)}">\${escapeHtml(typeLabel(event))}</span><div class="event-date">\${escapeHtml(humanDate(event))}</div></div><h2>\${escapeHtml(event.name||placeLine(event))}</h2>\${organiserRow}\${locationRow}<div class="event-meta">\${meta?\`<span>\${escapeHtml(meta)}</span>\`:''}\${organiserHtml}\${statusHtml}</div></div><div class="event-actions"><button class="attend-button\${attendClass}" type="button" data-action="attend">\${escapeHtml(attendLabel)}</button>\${link?\`<a class="primary-link" href="\${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">\${escapeHtml(link.label)}</a>\`:\`<span>Details TBC</span>\`}<button class="more-button" type="button" data-action="status" aria-label="Change event status">•••</button></div></article>\`;\n  }\n\n  function visibleEvents`,
  'cardHtml');

app=replaceOnce(app,
  /  function render\(\)\{.*?\}\n  function setView/s,
`  function render(){if(!dataset)return;renderLocation();renderYourOrganisers();const visible=visibleEvents();els.list.innerHTML=visible.map(cardHtml).join('');els.list.classList.toggle('hidden',visible.length===0);els.empty.classList.toggle('hidden',visible.length!==0);if(!visible.length)els.empty.textContent=activeView==='attending'?(planFilter==='needs-completion'?'No events need completion.':'No saved events match this view.'):(savedOnly?'No upcoming events from your saved organisers match these filters.':'No events match these filters.');els.resultsTitle.textContent=activeView==='majors'?'Major events':activeView==='attending'?(planFilter==='needs-completion'?'Needs completion':'Your events'):(savedOnly?'Saved organiser events':'Nearby events');els.resultsCount.textContent=\`\${visible.length}\`;renderSourceStatus()}\n  function setView`,
  'render');

if(!app.includes('rollPastAttendingToAttended();setLoading(false)')){
  app=replaceOnce(app,/events=data\.events\.filter\(e=>e&&e\.id&&e\.startDate\)\.map\(e=>e\.scope==='local'\?\{\.\.\.e,organiser:organiserName\(e\),organiserKey:organiserIdentity\(e\)\}:e\);setLoading\(false\)/,
    "events=data.events.filter(e=>e&&e.id&&e.startDate).map(e=>e.scope==='local'?{...e,organiser:organiserName(e),organiserKey:organiserIdentity(e)}:e);rollPastAttendingToAttended();setLoading(false)",
    'loadEvents transition');
}
app=app.replace("if(status==='attending')openStatusSheet(item)","if(status==='attending'||status==='attended')openStatusSheet(item)");
await fs.writeFile(APP,app);

let html=await fs.readFile(HTML,'utf8');
if(!html.includes('data-plan-filter="needs-completion"')){
  html=html.replace('<button type="button" data-plan-filter="attending">Going</button>','<button type="button" data-plan-filter="attending">Going</button>\n        <button type="button" data-plan-filter="needs-completion">Needs completion</button>');
}
html=html.replace('Distances update from this point. The current event feed still only contains the events collected around the Bristol search area.','UK-wide local feed · upcoming 6 months. Distances filter from your selected location.');
html=html.replace('./app.js?v=9','./app.js?v=10').replace('./styles.css?v=4','./styles.css?v=5');
await fs.writeFile(HTML,html);

let css=await fs.readFile(CSS,'utf8');
if(!css.includes('.plan-pill.needs-completion'))css+='\n.plan-pill.needs-completion{background:#fffaeb;color:#b54708}\n';
await fs.writeFile(CSS,css);

let master=await fs.readFile(MASTER,'utf8');
const marker='### 11.3 Event Prep';
const section=`### 11.2.1 Local-event feed retention and post-event lifecycle\n\nLocal discovery uses a **UK-wide upcoming-event feed** rather than a user-specific Bristol subset. The shared feed retains no historic local events and is capped at **six months into the future**. A user's selected/device location and radius filter that shared UK feed client-side. This keeps shared data bounded while making location changes genuinely change the events shown.\n\nPersonal event history is separate from the shared discovery feed. Once a user saves an attendance relationship, the retained \`UserEventParticipation.eventSnapshot\` is authoritative for preserving that event after it drops out of the source feed. Historic global event rows are therefore not required to preserve the user's competitive record.\n\nWhen the event date passes, a participation still marked **Attending** rolls forward to **Attended**. If completion/result data has not yet been recorded, its lifecycle phase becomes **Needs completion** and it remains surfaced in Compete until completed or explicitly corrected/skipped. Passing the event date must never silently imply that tournament results were entered.\n\n`;
if(!master.includes('### 11.2.1 Local-event feed retention')){
  if(!master.includes(marker))throw new Error('Could not find Event Prep section in master doc');
  master=master.replace(marker,section+marker);
  await fs.writeFile(MASTER,master);
}

console.log('Applied event retention/UI contract.');
