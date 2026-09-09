(function(){
'use strict';
const $=id=>document.getElementById(id);
const participationId=new URLSearchParams(location.search).get('participation');
let participation=null,meta=null,decks=[],candidates=[],analysis=null,activeField=null,baselineField=[],field=[];
let resolver=null,eventContext=null,edited=false,evidenceError=null,evidenceLoading=false,generation=0,ready=false,selectionTouched=false,releaseGeneration=0;
const F=window.EventPrepField;
const locked=()=>participation?.prep?.lockedSnapshot || null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct=v=>`${(Number(v||0)*100).toFixed(1)}%`;
function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.add('hidden'),2200)}
function saveLabel(text){$('saveState').textContent=text}
function eventName(){const s=participation?.eventSnapshot||{};return s.name||s.venue||s.city||'Event'}
function cleanField(rows){return window.SavedMetas.cleanField(rows)}
function cloneField(rows){return cleanField(rows).map(row=>({...row}))}
function loadParticipation(){participation=window.PTCGStorage?.getParticipation?.(participationId);if(!participation)throw new Error('This event participation could not be found.');if(participation.attendanceStatus!=='attending')throw new Error('Event Prep opens from an Attending event. Mark this event as Attending first.')}
function renderEvent(){const s=participation.eventSnapshot||{};$('eventTitle').textContent=eventName();$('headerEvent').textContent=eventName();const bits=[];if(s.startDate)bits.push(new Date(`${s.startDate}T12:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}));if(s.venue)bits.push(s.venue);else if(s.city)bits.push(s.city);$('eventMeta').textContent=bits.join(' · ')||'Attending event';$('baselineLabel').textContent='Event field'}
async function loadMeta(){
 const core=await window.MetaRelease.ready();if(!core)throw new Error('Meta release is unavailable');
 await window.MetaBlendedField.ensure();meta={core};
}
function suggestedField(){return F.automatic(eventContext,meta?window.MetaBlendedField.predictions():[])}
function matchingSavedField(){const id=participation?.prep?.expectedFieldId || participation?.prep?.baselineExpectedFieldId;return id?window.SavedMetas.get(id):null}
function fieldSnapshot(){return F.snapshot(activeField,field,baselineField,eventContext,{override:$('fieldOverride').checked,note:$('fieldNote').value.trim(),edited})}
function restoreField(){
 const snap=locked()?.fieldSnapshot || participation?.prep?.expectedFieldSnapshot;
 const savedId=participation?.prep?.expectedFieldId || participation?.prep?.baselineExpectedFieldId;
 activeField=snap?JSON.parse(JSON.stringify(snap)):matchingSavedField() || (savedId?{expectedFieldId:savedId,name:'Missing saved field',field:[],format:null,reason:'The selected saved field is unavailable. Choose a field to continue.'}:suggestedField());
 baselineField=cloneField(activeField.baselineField?.length?activeField.baselineField:activeField.field);
 field=cloneField(activeField.field);edited=!!activeField.provenance?.edited;
 $('fieldNote').value=activeField.note || '';applyOverride();
}
function applyOverride(){const check=F.compatibility(activeField,eventContext);$('fieldOverride').checked=check.mismatch && F.overrideValid(activeField,eventContext)}
function canUseField(){return field.length>0 && (!F.compatibility(activeField,eventContext).mismatch || $('fieldOverride').checked)}
function updateParticipation(mutator){participation=window.PTCGStorage.updateParticipation(participation.id,row=>{mutator(row);row.prep=row.prep||{id:`prep-${Date.now().toString(36)}`,participationId:row.id,createdAt:new Date().toISOString()};row.prep.updatedAt=new Date().toISOString();return row});saveLabel(locked()?'Locked':'Saved');return participation}
function saveEventField(){
 if(locked())return null;
 try{const snapshot=fieldSnapshot();selectionTouched=true;updateParticipation(row=>{row.prep=row.prep||{};row.prep.expectedFieldId=snapshot.expectedFieldId;row.prep.baselineExpectedFieldId=snapshot.expectedFieldId;row.prep.expectedFieldSnapshot=snapshot;row.prep.eventFieldNote=snapshot.note});activeField=snapshot;renderFieldSelect();renderFieldSummary();renderCandidates();renderLock();return snapshot}catch(error){toast(error.message);return null}
}
function renderFieldSelect(){
 const saved=window.SavedMetas.list(),selected=activeField?.id || activeField?.expectedFieldId || '';
 const snapshotOnly=selected && !saved.some(row=>row.id===selected);
 $('savedFieldSelect').innerHTML=`<option value="">Suggested Blended · ${esc(eventContext.format || 'Unknown format')}</option>${snapshotOnly?`<option value="${esc(selected)}">${esc(activeField.name)} · stored copy</option>`:''}${saved.map(row=>`<option value="${esc(row.id)}">${esc(window.SavedMetas.label(row))}</option>`).join('')}`;
 $('savedFieldSelect').value=selected;
}
function renderFieldSummary(){
 const check=F.compatibility(activeField,eventContext),isLocked=!!locked();
 $('fieldStatus').textContent=isLocked?'Locked':!field.length?'Unavailable':check.mismatch?'Override required':participation?.prep?.expectedFieldSnapshot?'Set for event':field.length?'Suggested':'Unavailable';
 if(check.mismatch && $('fieldOverride').checked)$('fieldStatus').textContent=isLocked?'Locked · override':'Format override';
 const provenance=activeField?.provenance || {},weights=provenance.weights;
 const split=weights?` · ${Math.round(weights.irl*100)}% IRL / ${Math.round(weights.online*100)}% Online`:'';
 $('fieldEvidence').textContent=field.length?`${activeField.name} · ${check.fieldFormat || 'Unknown format'}${split}${edited?' · edited':''}${provenance.asOf?' · prediction '+provenance.asOf:''}`:activeField?.reason || 'Selected field unavailable.';
 $('eventFormat').textContent=eventContext.format?`Event: ${eventContext.format} · ${eventContext.date} · maintained IRL schedule`:eventContext.reason;
 $('overrideControl').classList.toggle('hidden',!check.mismatch || !field.length);
 $('overrideText').textContent=`${check.reason} Use this field anyway; recommendations are not validated for the event’s format.`;
 const visible=field.slice(0,8);$('fieldSummary').innerHTML=visible.map(row=>`<div class="field-chip"><span>${esc(row.name)}</span><b>${pct(row.share)}</b></div>`).join('')+(field.length>8?`<div class="field-more">+${field.length-8} more</div>`:'');
 for(const id of ['savedFieldSelect','fieldOverride','fieldNote','resetAdjust'])$(id).disabled=isLocked;
 for(const id of ['looksRight','saveEventField'])$(id).disabled=isLocked || !canUseField();
 $('toggleAdjust').disabled=isLocked || !field.length;renderAdjustRows();renderLock();
}
function renderAdjustRows(){$('fieldAdjustRows').innerHTML=field.map((row,i)=>`<label class="adjust-row"><span>${esc(row.name)}</span><span class="adjust-value"><input data-field-index="${i}" type="number" min="0" max="100" step="0.5" value="${(row.share*100).toFixed(1)}" ${locked()?'disabled':''}><b>%</b></span></label>`).join('');$('fieldAdjustRows').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{if(locked())return;selectionTouched=true;edited=true;const i=Number(input.dataset.fieldIndex);field[i].share=Math.max(0,Number(input.value||0))/100;field=cleanField(field);renderFieldSummary();renderCandidates();saveLabel('Unsaved event adjustment')}))}
function useSavedField(){
 if(locked())return;
 selectionTouched=true;const id=$('savedFieldSelect').value;activeField=id?window.SavedMetas.get(id):suggestedField();
 if(!activeField){restoreField();return}
 baselineField=cloneField(activeField.field);field=cloneField(baselineField);edited=false;$('fieldNote').value='';applyOverride();renderFieldSummary();refreshEvidence();saveLabel('Unsaved field choice');
}
function resetAdjustment(){if(locked())return;selectionTouched=true;field=cloneField(baselineField);edited=false;$('fieldNote').value='';renderFieldSummary();renderCandidates();saveLabel('Unsaved baseline restoration')}
async function refreshRelease(){
 const token=++releaseGeneration;try{await loadMeta()}catch{}
 if(token!==releaseGeneration)return;
 if(!locked() && !selectionTouched && !participation?.prep?.expectedFieldSnapshot && !matchingSavedField()){restoreField();renderFieldSelect();renderFieldSummary()}
 refreshEvidence();
}
async function refreshEvidence(){
 const token=++generation,release=window.MetaData.release(),format=F.compatibility(activeField,eventContext).fieldFormat;
 evidenceError=null;evidenceLoading=!!format;renderCandidates();
 try{if(format)await Promise.all(['online','irl'].map(env=>window.MetaData.ensureForFormat(env,format)))}catch(error){if(token===generation)evidenceError=error}
 if(token!==generation || release!==window.MetaData.release())return;
 evidenceLoading=false;renderCandidates();
}
function candidateState(name){const state=participation?.prep?.candidates?.[name];const funnel=state?.funnelState||'Considering';return funnel==='Leading choice'?'leading':funnel==='Dropped'?'no':'maybe'}
function buildCandidates(){
 const format=F.compatibility(activeField,eventContext).fieldFormat,inputs=window.MetaWSIPSource.inputs({format,available:canUseField(),onlineScope:'30'});
 const owned=new Set(decks.map(d=>d.archetype).filter(Boolean));
 analysis=window.PTCGRecommendation.analyse({fieldRows:!evidenceError&&!evidenceLoading&&canUseField()?field:[],candidates:inputs.candidates,evidence:inputs.evidence,matchupSource:'combined'});
 candidates=analysis.ranked.slice(0,4).map(row=>({...row,owned:owned.has(row.name)}));
}
function persistCandidate(name,state){if(locked())return;const funnelState=state==='leading'?'Leading choice':state==='no'?'Dropped':'Considering';updateParticipation(row=>{row.prep=row.prep||{};row.prep.candidates=row.prep.candidates||{};if(state==='leading'){for(const key of Object.keys(row.prep.candidates))if(key!==name&&row.prep.candidates[key].funnelState==='Leading choice')row.prep.candidates[key].funnelState='Considering'}row.prep.candidates[name]={...(row.prep.candidates[name]||{}),funnelState,updatedAt:new Date().toISOString()}});renderCandidates();renderPlan()}
function renderCandidates(){buildCandidates();const stateLabel={strong:'Strong recommendation',close:'Close call',leading:'Best current fit',promising:'Promising, weak evidence',insufficient:'Insufficient evidence'}[analysis.state];$('candidateEvidence').textContent=evidenceLoading?'Loading compatible H2H…':evidenceError?'Compatible matchup evidence could not load.':!canUseField()?'Select a field and confirm any override. Personal deck planning remains available.':`${stateLabel} · ${F.compatibility(activeField,eventContext).fieldFormat || 'Unknown format'} H2H · Online 30 days + IRL.${F.compatibility(activeField,eventContext).mismatch?' Format override: not validated for this event.':''}`;$('retryEvidence').classList.toggle('hidden',!evidenceError);if(!candidates.length){$('candidateRows').innerHTML='<div class="prep-empty">Not enough coverage and sample quality for a useful shortlist.</div>';return}$('candidateRows').innerHTML=candidates.map(c=>{const state=candidateState(c.name);return `<article class="candidate-card"><div class="candidate-main"><div class="candidate-title"><strong>${esc(c.name)}${c.owned?'<small>Your deck</small>':''}</strong><span>≈${Math.round(c.expectedWR)}%</span></div><div class="candidate-evidence">${pct(c.coverage)} field coverage · ${pct(c.evidenceQuality)} sample quality · ${esc(c.evidenceLabel)}</div><div class="candidate-buttons"><button type="button" data-candidate="${esc(c.name)}" ${locked()?'disabled':''} data-state="leading" class="${state==='leading'?'active':''}">Leading</button><button type="button" data-candidate="${esc(c.name)}" ${locked()?'disabled':''} data-state="maybe" class="${state==='maybe'?'active':''}">Maybe</button><button type="button" data-candidate="${esc(c.name)}" ${locked()?'disabled':''} data-state="no" class="${state==='no'?'active':''}">No</button></div></div></article>`}).join('');$('candidateRows').querySelectorAll('[data-candidate]').forEach(button=>button.addEventListener('click',()=>persistCandidate(button.dataset.candidate,button.dataset.state)))}
async function loadDecks(){decks=await window.PTCGDeckStore.all();renderCandidates();renderPlan();renderLock()}
function selectedDeck(){return decks.find(d=>d.id===$('deckSelect').value)||null}
function leadingCandidate(){const rows=participation?.prep?.candidates||{};return Object.entries(rows).find(([,s])=>s.funnelState==='Leading choice')?.[0]||null}
function plannedDetails(){const saved=locked()?.deckSnapshot;if(saved)return {deck:saved,version:saved.version};const planned=participation?.plannedDeckRef;if(!planned)return null;const deck=decks.find(d=>d.id===planned.deckId);const version=deck&&window.PTCGDeckStore.getVersion(deck,planned.deckVersionId);return deck&&version?{deck,version}:null}
function renderPlan(){const leading=leadingCandidate();const planned=plannedDetails();$('planStatus').textContent=locked()?'Locked':planned?'Planned':leading?'Leading selected':'Not chosen';$('planHint').textContent=leading&&!planned?`${leading} is your leading option.`:'';if(planned){$('plannedSummary').classList.remove('hidden');$('planEditor').classList.add('hidden');$('plannedSummary').innerHTML=`<div><strong>${esc(planned.deck.name)} · ${esc(planned.version.label||`V${planned.version.ordinal||1}`)}</strong>${planned.deck.archetype?`<span>${esc(planned.deck.archetype)}</span>`:''}</div>${locked()?'':'<button id="changePlan" type="button" class="secondary-button">Change</button>'}`;$('changePlan')?.addEventListener('click',()=>{$('plannedSummary').classList.add('hidden');$('planEditor').classList.remove('hidden')})}else{$('plannedSummary').classList.add('hidden');$('planEditor').classList.remove('hidden')}
 const sorted=[...decks].sort((a,b)=>{const am=leading&&a.archetype===leading?0:1,bm=leading&&b.archetype===leading?0:1;return am-bm||(b.updatedAt||0)-(a.updatedAt||0)});const prior=$('deckSelect').value||participation?.plannedDeckRef?.deckId||'';$('deckSelect').innerHTML=`<option value="">Choose a personal deck</option>${sorted.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}${d.archetype?` · ${esc(d.archetype)}`:''}</option>`).join('')}`;if(sorted.some(d=>d.id===prior))$('deckSelect').value=prior;renderVersions()}
function renderVersions(){const deck=selectedDeck();const planned=participation?.plannedDeckRef||null;const versions=deck?.versions||[];const plannedVersionId=planned&&deck&&planned.deckId===deck.id?planned.deckVersionId:'';const prior=$('versionSelect').value||plannedVersionId||deck?.currentVersionId||'';$('versionSelect').innerHTML=`<option value="">Choose an exact version</option>${versions.slice().reverse().map(v=>`<option value="${esc(v.id)}">${esc(v.label||`V${v.ordinal||1}`)}${v.name?` · ${esc(v.name)}`:''}</option>`).join('')}`;if(versions.some(v=>v.id===prior))$('versionSelect').value=prior;const version=versions.find(v=>v.id===$('versionSelect').value);$('versionMeta').textContent=version?(version.name||version.listHash||'Saved version'):(deck&&!versions.length?'This deck has no saved version yet.':'')}
function savePlan(){if(locked())return;const deck=selectedDeck();const version=deck&&window.PTCGDeckStore.getVersion(deck,$('versionSelect').value);if(!deck||!version||!version.listHash){toast('Choose a saved DeckVersion first');return}updateParticipation(row=>{row.plannedDeckRef={deckId:deck.id,deckVersionId:version.id,listHash:version.listHash,plannedAt:new Date().toISOString()};row.prep=row.prep||{};row.prep.plannedArchetype=deck.archetype||null});renderPlan();renderLock();toast('Event plan saved')}
function renderLock(){
 const saved=locked();$('lockPrep').classList.toggle('hidden',!!saved);$('unlockPrep').classList.toggle('hidden',!saved);
 $('lockPrep').disabled=!canUseField() || !plannedDetails();
 $('lockStatus').textContent=saved?`Locked ${new Date(saved.lockedAt).toLocaleDateString('en-GB')} · field and exact deck version retained. Unlocking keeps this copy in the event’s history.`:'Lock saves the displayed field and your planned exact deck version. Later updates cannot change this copy.';
}
function lockPrep(){
 if(locked())return;
 try{const selected=fieldSnapshot(),details=plannedDetails(),snapshot=F.lock(participation,selected,details?.deck,details?.version,eventContext);
 updateParticipation(row=>{row.prep=row.prep||{};row.prep.expectedFieldSnapshot=selected;row.prep.expectedFieldId=selected.expectedFieldId;row.prep.lockedSnapshot=snapshot});restoreField();renderFieldSelect();renderFieldSummary();renderCandidates();renderPlan();toast('Preparation locked')
 }catch(error){toast(error.message)}
}
function unlockPrep(){if(!locked())return;updateParticipation(row=>{row.prep.lockHistory=[...(row.prep.lockHistory || []),row.prep.lockedSnapshot];row.prep.lockedSnapshot=null});eventContext=F.eventContext(participation.eventSnapshot,resolver);restoreField();renderFieldSummary();renderPlan();refreshEvidence();toast('Preparation unlocked; previous lock retained')}
function bind(){
 $('savedFieldSelect').addEventListener('change',useSavedField);
 $('fieldOverride').addEventListener('change',()=>{if(locked())return;selectionTouched=true;renderFieldSummary();renderCandidates();saveLabel('Unsaved override')});
 $('looksRight').addEventListener('click',()=>{if(saveEventField())toast('Field set for this event')});
 $('toggleAdjust').addEventListener('click',()=>{if(!locked())$('adjustPanel').classList.toggle('hidden')});
 $('resetAdjust').addEventListener('click',resetAdjustment);
 $('saveEventField').addEventListener('click',()=>{if(saveEventField()){toast('Event adjustment saved');$('adjustPanel').classList.add('hidden')}});
 $('deckSelect').addEventListener('change',renderVersions);$('versionSelect').addEventListener('change',renderVersions);$('savePlan').addEventListener('click',savePlan);
 $('lockPrep').addEventListener('click',lockPrep);$('unlockPrep').addEventListener('click',unlockPrep);
 $('retryEvidence').addEventListener('click',refreshRelease);
 window.addEventListener('savedmetas:updated',renderFieldSelect);
 window.addEventListener('meta:release-core',()=>{if(ready)refreshRelease()});
}
async function init(){
 try{
 loadParticipation();renderEvent();
 const results=await Promise.allSettled([F.loadResolver(),loadMeta(),window.PTCGDeckStore.open()]);
 resolver=results[0].status==='fulfilled'?results[0].value:null;
 eventContext=locked()?.eventContext || F.eventContext(participation.eventSnapshot,resolver);
 restoreField();renderFieldSelect();renderFieldSummary();
 // Field evidence failure must not prevent access to the user's personal decks.
 if(results[2].status==='fulfilled')await loadDecks();else{renderPlan();$('planHint').textContent='Personal decks could not load. Reopen Prep to retry.'}
 bind();ready=true;$('workspace').classList.remove('hidden');saveLabel(locked()?'Locked':'Saved');refreshEvidence();
 }catch(error){console.error(error);$('fatal').textContent=error.message;$('fatal').classList.remove('hidden');saveLabel('Unavailable')}
}
init();
})();
