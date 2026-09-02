(function(){
  'use strict';

  const DATA_URL='../../data/events.json';
  const DEFAULT_LOCATION={latitude:51.4545,longitude:-2.5879,label:'Bristol',source:'default'};
  const VALID_STATUSES=new Set(['interested','attending','attended','skipped']);
  const STATUS_LABELS={interested:'Interested',attending:'Attending',attended:'Attended',skipped:'Skipped'};
  const REGION_LABELS={europe:'Europe',northamerica:'North America',latinamerica:'Latin America',oceania:'Oceania',virtual:'Virtual'};
  const MONTHS='january|february|march|april|may|june|july|august|september|october|november|december';
  const ORGANISER_ALIASES=new Map([
    ['ccs','Card Catcher Shop'],
    ['card catcher shop','Card Catcher Shop'],
    ['bath','Bath TCG'],
    ['bath tcg','Bath TCG'],
    ['excelsior!','Excelsior! Games'],
    ['e!','Excelsior! Games'],
    ['excelsior! games','Excelsior! Games']
  ]);
  const DISPLAY_ACRONYMS=new Set(['TCG','CCG','LGS','UK','US','USA','EU','GB']);
  const $=id=>document.getElementById(id);

  const els={
    sourcePill:$('sourcePill'),refresh:$('refreshButton'),nearbyFilters:$('nearbyFilters'),majorFilters:$('majorFilters'),attendingFilters:$('attendingFilters'),
    distance:$('distanceFilter'),nearbyDate:$('nearbyDateFilter'),region:$('regionFilter'),majorSearch:$('majorSearch'),savedVenuesFilter:$('savedVenuesFilter'),
    locationSummary:$('locationSummary'),changeLocation:$('changeLocationButton'),locationEditor:$('locationEditor'),postcode:$('postcodeInput'),
    setPostcode:$('setPostcodeButton'),useDeviceLocation:$('useDeviceLocationButton'),locationError:$('locationError'),
    yourVenuesSection:$('yourVenuesSection'),yourVenuesList:$('yourVenuesList'),resultsTitle:$('resultsTitle'),resultsCount:$('resultsCount'),freshness:$('freshnessText'),
    list:$('eventList'),loading:$('loadingState'),empty:$('emptyState'),error:$('errorState'),backdrop:$('statusBackdrop'),sheetTitle:$('statusSheetTitle'),
    closeSheet:$('closeStatusSheet'),clearStatus:$('clearStatusButton'),toast:$('toast')
  };

  let dataset=null;
  let events=[];
  let activeView='nearby';
  let localType='all';
  let majorType='all';
  let planFilter='upcoming';
  let savedOnly=false;
  let selectedEvent=null;
  let selectedLocation=loadLocation();

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
  function safeUrl(value){try{const u=new URL(String(value||''),location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}}
  function parseDate(date,time){if(!date)return null;const clock=time&&/^\d{2}:\d{2}/.test(time)?time.slice(0,8):'12:00:00';const d=new Date(`${date}T${clock}`);return Number.isNaN(d.getTime())?null:d}
  function eventStart(event){return parseDate(event.startDate||event.date,event.startTime)}
  function eventEnd(event){return parseDate(event.endDate||event.startDate||event.date,event.endTime||event.startTime||'23:59:59')}
  function isPast(event){const end=eventEnd(event);return end?end.getTime()<Date.now():false}
  function daysAway(event){const d=eventStart(event);return d?(d.getTime()-Date.now())/86400000:null}
  function eventIdentity(event){return event&&event.id?event.id:(event&&event.source&&event.sourceId?`${event.source}:${event.sourceId}`:null)}
  function participationIdentity(participation){return participation.eventId||(participation.source&&participation.sourceId?`${participation.source}:${participation.sourceId}`:null)}
  function currentState(){return window.PTCGStorage?window.PTCGStorage.load():{eventParticipations:[],favouriteOrganisers:[],preferences:{}}}
  function participationMap(){const map=new Map();for(const participation of currentState().eventParticipations||[]){const key=participationIdentity(participation);if(key)map.set(key,participation)}return map}
  function findParticipation(event){const key=eventIdentity(event);return key?participationMap().get(key)||window.PTCGStorage?.getParticipation?.(event)||null:null}

  function loadLocation(){
    const saved=currentState().preferences?.eventsLocation;
    const lat=Number(saved?.latitude),lon=Number(saved?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{latitude:lat,longitude:lon,label:String(saved.label||'Saved location'),source:saved.source||'saved'}:{...DEFAULT_LOCATION};
  }
  function saveLocation(next){
    selectedLocation={latitude:Number(next.latitude),longitude:Number(next.longitude),label:String(next.label||'Selected location'),source:next.source||'saved'};
    if(window.PTCGStorage?.update){
      window.PTCGStorage.update(state=>{
        state.preferences=state.preferences&&typeof state.preferences==='object'?state.preferences:{};
        state.preferences.eventsLocation={...selectedLocation,updatedAt:new Date().toISOString()};
        return state;
      });
    }
    renderLocation();
    if(dataset)render();
  }
  function renderLocation(){if(els.locationSummary)els.locationSummary.textContent=selectedLocation.label}
  function showLocationError(message){if(!els.locationError)return;els.locationError.textContent=message||'';els.locationError.classList.toggle('hidden',!message)}
  function toggleLocationEditor(force){
    if(!els.locationEditor)return;
    const open=typeof force==='boolean'?force:els.locationEditor.classList.contains('hidden');
    els.locationEditor.classList.toggle('hidden',!open);els.changeLocation?.setAttribute('aria-expanded',String(open));if(open)els.postcode?.focus();
  }
  async function usePostcode(){
    const postcode=String(els.postcode?.value||'').trim();if(!postcode){showLocationError('Enter a UK postcode.');return}
    showLocationError('');els.setPostcode.disabled=true;
    try{
      const response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,{cache:'no-store'});if(!response.ok)throw new Error('Postcode not found');
      const data=await response.json(),result=data&&data.result;if(!result||!Number.isFinite(Number(result.latitude))||!Number.isFinite(Number(result.longitude)))throw new Error('Postcode not found');
      const label=[result.postcode,result.admin_district].filter(Boolean).join(' · ');
      saveLocation({latitude:result.latitude,longitude:result.longitude,label:label||result.postcode||postcode.toUpperCase(),source:'postcode'});toggleLocationEditor(false);toast(`Location set · ${label||postcode.toUpperCase()}`);
    }catch(error){showLocationError(error?.message||'Could not find that postcode.')}finally{els.setPostcode.disabled=false}
  }
  function useDeviceLocation(){
    if(!navigator.geolocation){showLocationError('Current location is not available in this browser.');return}
    showLocationError('');els.useDeviceLocation.disabled=true;
    navigator.geolocation.getCurrentPosition(
      position=>{saveLocation({latitude:position.coords.latitude,longitude:position.coords.longitude,label:'Current location',source:'device'});els.useDeviceLocation.disabled=false;toggleLocationEditor(false);toast('Using current location')},
      ()=>{els.useDeviceLocation.disabled=false;showLocationError('Location access was not available. You can set a postcode instead.')},
      {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
    );
  }
  function distanceMiles(lat1,lon1,lat2,lon2){
    const toRad=value=>value*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 3958.7613*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  function eventDistanceMiles(event){
    const lat=Number(event?.latitude),lon=Number(event?.longitude);
    if(Number.isFinite(lat)&&Number.isFinite(lon))return distanceMiles(selectedLocation.latitude,selectedLocation.longitude,lat,lon);
    if(selectedLocation.source==='default'&&Number.isFinite(event?.distanceFromSeedMiles))return Number(event.distanceFromSeedMiles);
    return null;
  }

  function canonicalOrganiserLabel(value){
    let text=String(value||'').trim();if(!text)return '';
    text=text.replace(/\s*[-–—]\s*season\s*\d+\b.*$/i,'').trim();
    text=text.replace(new RegExp(`\\s*[-–—]?\\s*(?:${MONTHS})(?:\\s+20\\d{2})?\\s*$`,'i'),'').trim();
    text=text.replace(/\s*[-–—]\s*$/,'').trim();return text;
  }
  function aliasOrganiserLabel(value){const label=canonicalOrganiserLabel(value);if(!label)return '';const key=label.toLowerCase().replace(/\s+/g,' ');return ORGANISER_ALIASES.get(key)||label}
  function displayOrganiserLabel(value){
    const label=aliasOrganiserLabel(value);if(!label)return '';
    return label.split(/(\s+)/).map(part=>{if(/^\s+$/.test(part))return part;const match=part.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)([^A-Za-z0-9]*)$/);if(!match)return part;const [,lead,core,trail]=match,upper=core.toUpperCase();if(DISPLAY_ACRONYMS.has(upper)||/^Q[1-4]$/.test(upper))return `${lead}${upper}${trail}`;return `${lead}${core.charAt(0).toUpperCase()}${core.slice(1).toLowerCase()}${trail}`}).join('');
  }
  function cleanOrganiserCandidate(value){let text=canonicalOrganiserLabel(value);if(!text)return '';text=text.replace(/\s*[-–—]?\s*(?:TCG\s*)?(?:League\s*)?(?:Cup|Challenge)\b.*$/i,'').trim();text=text.replace(/\s*[-–—]\s*$/,'').trim();if(!text||/^pok[eé]mon\b/i.test(text)||/^q\d+\b/i.test(text))return '';return text}
  function organiserWords(value){const stop=new Set(['tcg','league','cup','challenge','season','shop','store','games','cards','pokemon','pokémon']);return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(word=>word&&!stop.has(word)&&!/^\d+$/.test(word))}
  function titleClearlyMatchesVenue(event){const venue=String(event&&event.venue||'').trim();if(!venue)return false;const venueWords=organiserWords(venue),titleWords=new Set(organiserWords(event.name));return venueWords.length>0&&venueWords.every(word=>titleWords.has(word))}
  function organiserName(event){
    if(!event||event.scope!=='local')return null;
    const explicit=event.organiser||event.organizer||event.leagueName||event.league||event.shopName||event.shop;if(String(explicit||'').trim())return displayOrganiserLabel(explicit);
    const venue=String(event.venue||'').trim();if(venue&&titleClearlyMatchesVenue(event))return displayOrganiserLabel(venue);
    const inferred=cleanOrganiserCandidate(event.name);return displayOrganiserLabel(inferred||venue)||null;
  }
  function organiserIdentity(value){
    if(typeof value==='string'){const name=aliasOrganiserLabel(value);return name?`organiser:${name.toLowerCase().replace(/\s+/g,' ')}`:null}
    if(!value||typeof value!=='object')return null;const id=value.organiserId||value.organizerId||value.leagueId||value.shopId;if(id)return `organiser:${value.source||'local'}:${id}`;
    const name=value.scope==='local'?organiserName(value):aliasOrganiserLabel(value.name||value.organiser),canonical=aliasOrganiserLabel(name);return canonical?`organiser:${canonical.toLowerCase().replace(/\s+/g,' ')}`:null;
  }
  function savedOrganiserRows(){const seen=new Set();return (currentState().favouriteOrganisers||[]).filter(row=>{const key=organiserIdentity(row);if(!key||seen.has(key))return false;seen.add(key);return true})}
  function savedOrganiserKeys(){return new Set(savedOrganiserRows().map(organiserIdentity).filter(Boolean))}
  function isSavedOrganiser(event){const key=organiserIdentity(event);return !!key&&savedOrganiserKeys().has(key)}
  function organiserRowName(row){return displayOrganiserLabel(typeof row==='string'?row:(row&&row.name)||(row&&row.organiser)||'Saved organiser')}
  function organiserSnapshot(event){const key=organiserIdentity(event),name=organiserName(event);return key&&name?{organiserKey:key,name,source:event.source||null,savedAt:new Date().toISOString()}:null}
  function toggleOrganiser(event){
    if(!window.PTCGStorage||event.scope!=='local'||!organiserIdentity(event))return;const wasSaved=isSavedOrganiser(event),key=organiserIdentity(event);
    window.PTCGStorage.update(state=>{state.favouriteOrganisers=Array.isArray(state.favouriteOrganisers)?state.favouriteOrganisers:[];const matching=[];state.favouriteOrganisers.forEach((row,index)=>{if(organiserIdentity(row)===key)matching.push(index)});if(matching.length){for(let i=matching.length-1;i>=0;i--)state.favouriteOrganisers.splice(matching[i],1)}else{const snapshot=organiserSnapshot(event);if(snapshot)state.favouriteOrganisers.push(snapshot)}return state});
    toast(wasSaved?'Organiser removed':'Organiser saved');render();
  }

  function humanDate(event){const start=eventStart(event);if(!start)return 'Date TBC';const opts={weekday:'short',day:'numeric',month:'short'};if(start.getFullYear()!==new Date().getFullYear())opts.year='numeric';let label=start.toLocaleDateString('en-GB',opts);const end=event.endDate?eventEnd(event):null;if(end&&event.endDate!==event.startDate)label+=` – ${end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:end.getFullYear()!==start.getFullYear()?'numeric':undefined})}`;if(event.startTime)label+=` · ${event.startTime.slice(0,5)}`;return label}
  function compactDate(event){const d=eventStart(event);return d?d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'TBC'}
  function placeLine(event){if(event.scope==='major')return [event.city,event.country].filter(Boolean).join(', ')||event.region||'Location TBC';return event.venue||event.city||event.address||'Location TBC'}
  function detailLine(event){if(event.scope==='major')return REGION_LABELS[event.region]||event.region||`Season ${event.season||''}`.trim();const bits=[];if(event.city&&event.city!==event.venue)bits.push(event.city);const distance=eventDistanceMiles(event);if(Number.isFinite(distance))bits.push(`${distance.toFixed(1)} mi`);if(event.cost)bits.push(event.cost);return bits.join(' · ')}
  function typeClass(event){if(event.scope==='major')return 'major';if(event.type==='League Cup')return 'cup';if(event.type==='League Challenge')return 'challenge';if(event.type==='Prerelease')return 'prerelease';return ''}
  function typeLabel(event){if(event.type==='League Cup')return 'Cup';if(event.type==='League Challenge')return 'Challenge';if(event.type==='Special Championship')return 'Special';if(event.type==='International')return 'International';return event.type||'Event'}
  function statusFor(event){const participation=findParticipation(event);if(!participation||!VALID_STATUSES.has(participation.attendanceStatus))return null;return participation.attendanceStatus==='attending'&&isPast(event)?'attended':participation.attendanceStatus}
  function needsCompletion(participation,event){return !!participation&&isPast(event)&&(participation.attendanceStatus==='attending'||participation.attendanceStatus==='attended')&&!participation.completion}
  function rollPastAttendingToAttended(){if(!window.PTCGStorage?.update)return;const state=currentState(),ids=(state.eventParticipations||[]).filter(p=>p.attendanceStatus==='attending'&&isPast(snapshotToEvent(p))).map(p=>p.id);if(!ids.length)return;window.PTCGStorage.update(state=>{const now=new Date().toISOString();for(const p of state.eventParticipations||[]){if(!ids.includes(p.id))continue;p.attendanceStatus='attended';p.phase=p.completion?'completed':'needs-completion';p.updatedAt=now}return state})}
  function snapshotToEvent(participation){const snap=participation.eventSnapshot&&typeof participation.eventSnapshot==='object'?participation.eventSnapshot:{};const live=events.find(e=>eventIdentity(e)===participationIdentity(participation)||(participation.source&&participation.sourceId&&e.source===participation.source&&e.sourceId===participation.sourceId));const merged={...snap,...(live||{})};if(!merged.id)merged.id=participation.eventId||`${participation.source||'saved'}:${participation.sourceId||participation.id}`;if(!merged.source)merged.source=participation.source||null;if(!merged.sourceId)merged.sourceId=participation.sourceId||null;if(merged.scope==='local'&&!merged.organiser)merged.organiser=organiserName(merged);return merged}

  function setStatus(event,status){if(!window.PTCGStorage||!window.PTCGStorage.setEventStatus)return;window.PTCGStorage.setEventStatus(event,status);toast(status==='attending'?`Added to Attending · ${compactDate(event)}`:`Saved as ${STATUS_LABELS[status]}`);render()}
  function clearStatus(event){if(!window.PTCGStorage||!window.PTCGStorage.clearEventStatus)return;const result=window.PTCGStorage.clearEventStatus(event);toast(result?.archived?'Attendance cleared · event history kept':'Event status cleared');render()}
  function toast(message){els.toast.textContent=message;els.toast.classList.remove('hidden');clearTimeout(els.toast._timer);els.toast._timer=setTimeout(()=>els.toast.classList.add('hidden'),2100)}
  function showError(message){els.error.textContent=message;els.error.classList.toggle('hidden',!message)}
  function setLoading(on){els.loading.classList.toggle('hidden',!on)}
  function freshnessInfo(){if(!dataset||!dataset.lastSuccessfulUpdate)return {label:'Update time unavailable',stale:true};const d=new Date(dataset.lastSuccessfulUpdate);if(Number.isNaN(d.getTime()))return {label:'Update time unavailable',stale:true};const hours=(Date.now()-d.getTime())/3600000;const label=`Updated ${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;return {label,stale:hours>36}}
  function renderSourceStatus(){const info=freshnessInfo(),dot=els.sourcePill.querySelector('.source-dot');dot.classList.toggle('good',!info.stale);dot.classList.toggle('stale',info.stale);els.sourcePill.querySelector('span:last-child').textContent=info.stale?'Event data may be stale':'Event data current';els.freshness.textContent=info.label}

  function nearbyEvents(){
    const maxDistance=els.distance.value==='all'?Infinity:Number(els.distance.value),maxDays=els.nearbyDate.value==='all'?Infinity:Number(els.nearbyDate.value);
    return events.filter(event=>{if(event.scope!=='local'||isPast(event))return false;if(localType!=='all'&&event.type!==localType)return false;if(savedOnly&&!isSavedOrganiser(event))return false;const distance=eventDistanceMiles(event);if(maxDistance!==Infinity&&(!Number.isFinite(distance)||distance>maxDistance))return false;const days=daysAway(event);if(Number.isFinite(days)&&days>maxDays)return false;return true}).sort((a,b)=>{const da=eventDistanceMiles(a),db=eventDistanceMiles(b);if(Number.isFinite(da)&&Number.isFinite(db)&&Math.abs(da-db)>.05)return da-db;return sortAscending(a,b)});
  }
  function majorEvents(){const region=els.region.value,q=els.majorSearch.value.trim().toLowerCase();return events.filter(event=>event.scope==='major'&&!isPast(event)&&(majorType==='all'||event.type===majorType)&&(region==='all'||event.region===region)&&(!q||`${event.name||''} ${event.city||''} ${event.country||''}`.toLowerCase().includes(q))).sort(sortAscending)}
  function savedEvents(){const rows=(currentState().eventParticipations||[]).filter(p=>VALID_STATUSES.has(p.attendanceStatus)).map(participation=>({participation,event:snapshotToEvent(participation)}));const filtered=rows.filter(({participation,event})=>{const past=isPast(event),status=participation.attendanceStatus,needs=needsCompletion(participation,event);if(planFilter==='attending')return status==='attending'&&!past;if(planFilter==='interested')return status==='interested'&&!past;if(planFilter==='needs-completion')return needs;if(planFilter==='history')return !needs&&(status==='attended'||status==='skipped'||!!participation.completion);return (status==='attending'||status==='interested')&&!past});filtered.sort((a,b)=>planFilter==='history'?sortDescending(a.event,b.event):sortAscending(a.event,b.event));return filtered.map(x=>x.event)}
  function sortAscending(a,b){return (eventStart(a)?.getTime()||Number.MAX_SAFE_INTEGER)-(eventStart(b)?.getTime()||Number.MAX_SAFE_INTEGER)}
  function sortDescending(a,b){return (eventStart(b)?.getTime()||0)-(eventStart(a)?.getTime()||0)}

  function renderYourOrganisers(){
    const rows=savedOrganiserRows(),show=activeView==='nearby'&&rows.length>0;els.yourVenuesSection.classList.toggle('hidden',!show);if(!show){els.yourVenuesList.innerHTML='';return}
    const upcoming=events.filter(e=>e.scope==='local'&&!isPast(e)).sort(sortAscending);
    els.yourVenuesList.innerHTML=rows.map(row=>{const key=organiserIdentity(row),next=upcoming.find(e=>organiserIdentity(e)===key),name=organiserRowName(row),nextLine=next?`${typeLabel(next)} · ${compactDate(next)}`:'No upcoming event in current feed',distance=next?eventDistanceMiles(next):null,meta=next?[placeLine(next),next.city&&next.city!==next.venue?next.city:null,Number.isFinite(distance)?`${distance.toFixed(1)} mi`:null].filter(Boolean).join(' · '):'Saved organiser';return `<article class="saved-venue-card"><div class="saved-venue-card-top"><strong>${escapeHtml(name)}</strong><span class="saved-venue-star">★</span></div><div class="saved-venue-next">${escapeHtml(nextLine)}</div><div class="saved-venue-meta">${escapeHtml(meta)}</div></article>`}).join('');
  }

  function externalLink(event){const registration=safeUrl(event.registrationUrl);if(registration)return {url:registration,label:'Register'};const official=safeUrl(event.officialUrl);if(official)return {url:official,label:'Details'};const secondary=safeUrl(event.secondarySourceUrl);if(secondary)return {url:secondary,label:'Details'};return null}
  function cardHtml(event){
    const status=statusFor(event),participation=findParticipation(event),needs=participation?needsCompletion(participation,event):false,link=externalLink(event),meta=detailLine(event),savedOrganiser=event.scope==='local'&&isSavedOrganiser(event),organiser=organiserName(event);
    const statusHtml=status?`<span class="plan-pill ${status}${needs?' needs-completion':''}">${escapeHtml(needs?'Needs completion':STATUS_LABELS[status])}</span>`:'',organiserHtml=savedOrganiser?'<span class="saved-venue-pill">★ Saved organiser</span>':'';
    const attendLabel=status==='attending'?'Attending ✓':status==='attended'?'Attended ✓':status?STATUS_LABELS[status]:`I'm attending`,attendClass=(status==='attending'||status==='attended')?' saved':'';
    const saveButton=event.scope==='local'&&organiser?`<button class="venue-save-button${savedOrganiser?' saved':''}" type="button" data-action="organiser" aria-label="${savedOrganiser?'Remove saved organiser':'Save organiser'}">${savedOrganiser?'★':'☆'}</button>`:'',organiserRow=event.scope==='local'&&organiser?`<div class="event-venue-row event-organiser-row"><div class="event-organiser">${escapeHtml(organiser)}</div>${saveButton}</div>`:'',locationRow=event.scope==='local'?`<div class="event-location">${escapeHtml(placeLine(event))}</div>`:'';
    return `<article class="event-card ${event.scope==='major'?'major-card':''}${savedOrganiser?' saved-venue-event':''}" data-event-id="${escapeHtml(eventIdentity(event)||'')}"><div class="event-card-main"><div class="event-topline"><span class="event-type ${typeClass(event)}">${escapeHtml(typeLabel(event))}</span><div class="event-date">${escapeHtml(humanDate(event))}</div></div><h2>${escapeHtml(event.name||placeLine(event))}</h2>${organiserRow}${locationRow}<div class="event-meta">${meta?`<span>${escapeHtml(meta)}</span>`:''}${organiserHtml}${statusHtml}</div></div><div class="event-actions"><button class="attend-button${attendClass}" type="button" data-action="attend">${escapeHtml(attendLabel)}</button>${link?`<a class="primary-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`:`<span>Details TBC</span>`}<button class="more-button" type="button" data-action="status" aria-label="Change event status">•••</button></div></article>`;
  }

  function visibleEvents(){if(activeView==='majors')return majorEvents();if(activeView==='attending')return savedEvents();return nearbyEvents()}
  function render(){if(!dataset)return;renderLocation();renderYourOrganisers();const visible=visibleEvents();els.list.innerHTML=visible.map(cardHtml).join('');els.list.classList.toggle('hidden',visible.length===0);els.empty.classList.toggle('hidden',visible.length!==0);if(!visible.length)els.empty.textContent=activeView==='attending'?(planFilter==='needs-completion'?'No events need completion.':'No saved events match this view.'):(savedOnly?'No upcoming events from your saved organisers match these filters.':'No events match these filters.');els.resultsTitle.textContent=activeView==='majors'?'Major events':activeView==='attending'?(planFilter==='needs-completion'?'Needs completion':'Your events'):(savedOnly?'Saved organiser events':'Nearby events');els.resultsCount.textContent=`${visible.length}`;renderSourceStatus()}
  function setView(view){activeView=view;document.querySelectorAll('[data-view]').forEach(btn=>{const active=btn.dataset.view===view;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active))});els.nearbyFilters.classList.toggle('hidden',view!=='nearby');els.majorFilters.classList.toggle('hidden',view!=='majors');els.attendingFilters.classList.toggle('hidden',view!=='attending');render()}
  function setChip(groupSelector,value){document.querySelectorAll(groupSelector).forEach(btn=>btn.classList.toggle('active',btn.dataset.localType===value||btn.dataset.majorType===value||btn.dataset.planFilter===value))}
  function openStatusSheet(event){selectedEvent=event;const status=statusFor(event);els.sheetTitle.textContent=event.name||placeLine(event);document.querySelectorAll('[data-set-status]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.setStatus===status));els.clearStatus.classList.toggle('hidden',!status);els.backdrop.classList.remove('hidden');els.backdrop.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
  function closeStatusSheet(){selectedEvent=null;els.backdrop.classList.add('hidden');els.backdrop.setAttribute('aria-hidden','true');document.body.style.overflow=''}
  function eventFromCard(card){const id=card&&card.dataset.eventId;if(!id)return null;return visibleEvents().find(e=>eventIdentity(e)===id)||events.find(e=>eventIdentity(e)===id)||savedEvents().find(e=>eventIdentity(e)===id)||null}

  async function loadEvents(){setLoading(true);showError('');els.empty.classList.add('hidden');els.list.classList.add('hidden');try{const response=await fetch(`${DATA_URL}?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();if(!data||data.status!=='ok'||!Array.isArray(data.events))throw new Error('Invalid event dataset');dataset=data;events=data.events.filter(e=>e&&e.id&&e.startDate).map(e=>e.scope==='local'?{...e,organiser:organiserName(e),organiserKey:organiserIdentity(e)}:e);rollPastAttendingToAttended();setLoading(false);render()}catch(error){setLoading(false);showError(`Could not load event data. ${error&&error.message?error.message:''}`.trim())}}

  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  document.querySelectorAll('[data-local-type]').forEach(btn=>btn.addEventListener('click',()=>{localType=btn.dataset.localType;setChip('[data-local-type]',localType);render()}));
  document.querySelectorAll('[data-major-type]').forEach(btn=>btn.addEventListener('click',()=>{majorType=btn.dataset.majorType;setChip('[data-major-type]',majorType);render()}));
  document.querySelectorAll('[data-plan-filter]').forEach(btn=>btn.addEventListener('click',()=>{planFilter=btn.dataset.planFilter;setChip('[data-plan-filter]',planFilter);render()}));
  [els.distance,els.nearbyDate,els.region].forEach(el=>el&&el.addEventListener('change',render));els.majorSearch?.addEventListener('input',render);els.refresh?.addEventListener('click',loadEvents);
  els.changeLocation?.addEventListener('click',()=>toggleLocationEditor());els.setPostcode?.addEventListener('click',usePostcode);els.postcode?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();usePostcode()}});els.useDeviceLocation?.addEventListener('click',useDeviceLocation);
  els.savedVenuesFilter?.addEventListener('click',()=>{savedOnly=!savedOnly;els.savedVenuesFilter.classList.toggle('active',savedOnly);els.savedVenuesFilter.setAttribute('aria-pressed',String(savedOnly));els.savedVenuesFilter.textContent=savedOnly?'★ Saved organisers only':'☆ Saved organisers only';render()});
  els.list?.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(!target)return;const card=target.closest('.event-card'),item=eventFromCard(card);if(!item)return;if(target.dataset.action==='attend'){const status=statusFor(item);if(status==='attending'||status==='attended')openStatusSheet(item);else setStatus(item,'attending')}else if(target.dataset.action==='status')openStatusSheet(item);else if(target.dataset.action==='organiser')toggleOrganiser(item)});
  document.querySelectorAll('[data-set-status]').forEach(btn=>btn.addEventListener('click',()=>{if(!selectedEvent)return;setStatus(selectedEvent,btn.dataset.setStatus);closeStatusSheet()}));
  els.clearStatus?.addEventListener('click',()=>{if(!selectedEvent)return;clearStatus(selectedEvent);closeStatusSheet()});els.closeSheet?.addEventListener('click',closeStatusSheet);els.backdrop?.addEventListener('click',event=>{if(event.target===els.backdrop)closeStatusSheet()});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!els.backdrop?.classList.contains('hidden'))closeStatusSheet()});
  window.addEventListener('storage',()=>{selectedLocation=loadLocation();dataset&&render()});window.addEventListener('ptcg:local-change',()=>{selectedLocation=loadLocation();dataset&&render()});

  renderLocation();loadEvents();
})();