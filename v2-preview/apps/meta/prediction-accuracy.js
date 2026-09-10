(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const base=new URL('../../../data/meta/prediction-accuracy/',location.href);
  const state={records:[],selected:null,loaded:false,loading:null,request:0};
  const pct=value=>`${Number(value||0).toFixed(1)}%`;
  const pp=value=>`${Number(value||0)>=0?'+':''}${Number(value||0).toFixed(1)} pp`;
  const typeLabel=value=>({worlds:'Worlds',international:'International',special:'Special Championship',regional:'Regional'}[value]||value||'Major');
  const date=value=>{try{return new Date(`${String(value).slice(0,10)}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return value||'Unknown date';}};
  const fetchJson=async relative=>{const response=await fetch(new URL(relative,base),{cache:'no-store'});if(!response.ok)throw new Error(`Accuracy data ${response.status}`);return response.json();};

  function trendHtml(scored){
    if(!scored.length)return '<div class="accuracy-empty">A trend will appear after the first eligible post-snapshot major.</div>';
    const rows=[...scored].sort((a,b)=>a.dayOneDate.localeCompare(b.dayOneDate)),width=600,height=170,pad=32;
    const x=index=>rows.length===1?width/2:pad+index*(width-2*pad)/(rows.length-1),y=value=>height-pad-(Math.max(0,Math.min(100,value))*(height-2*pad)/100);
    const points=rows.map((row,index)=>`${x(index)},${y(row.evaluation.metrics.fieldAccuracy)}`).join(' ');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Field accuracy trend"><line class="accuracy-grid" x1="${pad}" y1="${y(100)}" x2="${width-pad}" y2="${y(100)}"/><line class="accuracy-grid" x1="${pad}" y1="${y(50)}" x2="${width-pad}" y2="${y(50)}"/><line class="accuracy-grid" x1="${pad}" y1="${y(0)}" x2="${width-pad}" y2="${y(0)}"/><text class="accuracy-axis" x="2" y="${y(100)+3}">100</text><text class="accuracy-axis" x="8" y="${y(50)+3}">50</text><text class="accuracy-axis" x="14" y="${y(0)+3}">0</text>${rows.length>1?`<polyline class="accuracy-line" points="${points}"/>`:''}${rows.map((row,index)=>`<circle class="accuracy-dot" cx="${x(index)}" cy="${y(row.evaluation.metrics.fieldAccuracy)}" r="5"><title>${esc(row.name)}: ${pct(row.evaluation.metrics.fieldAccuracy)}</title></circle>`).join('')}</svg>`;
  }

  function eventButton(row){
    const scored=row.status==='scored'&&row.evaluation,score=scored?pct(row.evaluation.metrics.fieldAccuracy):row.status==='unavailable'?'Unavailable':'Not scored';
    return `<button type="button" class="accuracy-event${state.selected===row.eventKey?' active':''}" data-accuracy-event="${esc(row.eventKey)}"><span><b>${esc(row.name)}</b><small>${date(row.dayOneDate)} · ${esc(row.format)} · ${esc(typeLabel(row.type))}</small></span><span class="accuracy-event-score${scored?'':' unscored'}">${score}</span><span aria-hidden="true">›</span></button>`;
  }

  function missHtml(title,rows,kind){
    return `<section class="accuracy-miss"><h3>${title}</h3>${rows.length?rows.map(row=>`<div class="accuracy-miss-row"><span>${esc(row.name)}</span><strong class="${kind}">${pp(row.variance)}</strong></div>`).join(''):'<div class="accuracy-miss-row"><span>No material misses</span></div>'}</section>`;
  }

  function detailHtml(row){
    if(!row)return '';
    const actual=row.actual,coverage=actual?pct(100*actual.coverage):'—';
    if(row.status!=='scored'||!row.evaluation)return `<section class="accuracy-card accuracy-detail"><div><div class="eyebrow">EVENT DETAIL</div><h2>${esc(row.name)}</h2><p>${date(row.dayOneDate)} · ${esc(row.format)}</p></div><div class="accuracy-stats"><div class="accuracy-stat"><b>${Number(actual?.classifiedEntries||0).toLocaleString()}</b><span>Classified entries</span></div><div class="accuracy-stat"><b>${Number(actual?.totalPlayers||0).toLocaleString()}</b><span>Total players</span></div><div class="accuracy-stat"><b>${coverage}</b><span>Classification coverage</span></div></div><div class="accuracy-notice"><b>${row.status==='unavailable'?'Accuracy unavailable':'Not scored'}</b><br>${esc(row.reason||'No eligible evaluation is available.')}</div></section>`;
    const evaluation=row.evaluation;
    return `<section class="accuracy-card accuracy-detail"><div><div class="eyebrow">EVENT DETAIL</div><h2>${esc(row.name)}</h2><p>${date(row.dayOneDate)} · ${esc(row.format)} · prediction published ${date(evaluation.snapshotPublishedAt)}</p></div><div class="accuracy-stats"><div class="accuracy-stat"><b>${pct(evaluation.metrics.fieldAccuracy)}</b><span>Field accuracy</span></div><div class="accuracy-stat"><b>${Number(evaluation.metrics.mae).toFixed(1)} pp</b><span>Mean absolute error</span></div><div class="accuracy-stat"><b>${coverage}</b><span>Classification coverage</span></div></div><div class="accuracy-misses">${missHtml('Largest over-predictions',evaluation.topOver,'positive')}${missHtml('Largest under-predictions',evaluation.topUnder,'negative')}</div><details class="accuracy-comparison"><summary>View full predicted vs actual field</summary><div class="accuracy-table-wrap"><table class="accuracy-table"><thead><tr><th>Exact variant</th><th>Predicted</th><th>Actual</th><th>Variance</th></tr></thead><tbody>${evaluation.rows.map(item=>`<tr><td>${esc(item.name)}</td><td>${pct(item.predicted)}</td><td>${pct(item.actual)}</td><td>${pp(item.variance)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
  }

  function render(){
    const host=$('accuracyContent');if(!host)return;
    const scored=state.records.filter(row=>row.status==='scored'&&row.evaluation).sort((a,b)=>b.dayOneDate.localeCompare(a.dayOneDate)),latest=scored[0],selected=state.records.find(row=>row.eventKey===state.selected)||state.records[0];
    const hero=latest?`<section class="accuracy-card accuracy-hero"><div><div class="eyebrow">LATEST SCORE</div><h2>${esc(latest.name)}</h2><p>${date(latest.dayOneDate)} · ${esc(latest.format)} · ${Number(latest.actual?.classifiedEntries||0).toLocaleString()} of ${Number(latest.actual?.totalPlayers||0).toLocaleString()} entries classified</p></div><div class="accuracy-score"><b>${pct(latest.evaluation.metrics.fieldAccuracy)}</b><span>Field accuracy · MAE ${Number(latest.evaluation.metrics.mae).toFixed(1)} pp</span></div></section>`:`<section class="accuracy-card accuracy-hero"><div><div class="eyebrow">TRACKING ACTIVE</div><h2>Waiting for the first score</h2><p>Predictions are now frozen before events. The first score will appear after the next compatible IRL major publishes a sufficiently complete Day 1 field.</p></div><div class="accuracy-score"><b>—</b><span>No eligible result yet</span></div></section>`;
    host.innerHTML=`<div class="accuracy-layout">${hero}<section class="accuracy-card accuracy-trend"><div class="accuracy-section-head"><div><h2>Accuracy trend</h2><p>${scored.length?`${scored.length} scored major${scored.length===1?'':'s'}`:'No scored majors yet'} · 100% means perfect overlap</p></div></div>${trendHtml(scored)}</section><section class="accuracy-card"><div class="accuracy-section-head"><div><h2>Event history</h2><p>IRL majors only · exact Day 1 variants</p></div></div><div class="accuracy-events">${state.records.length?state.records.map(eventButton).join(''):'<div class="accuracy-empty">No eligible IRL majors have been recorded.</div>'}</div></section>${detailHtml(selected)}</div>`;
    host.querySelectorAll?.('[data-accuracy-event]').forEach(button=>button.addEventListener('click',()=>{state.selected=button.dataset.accuracyEvent;render();}));
  }

  async function load(force=false){
    if(state.loaded&&!force){render();return;}
    if(state.loading)return state.loading;
    const request=++state.request,host=$('accuracyContent');if(host)host.innerHTML='<div class="meta-empty">Loading prediction history…</div>';
    state.loading=(async()=>{
      const index=await fetchJson('index.json');
      const records=await Promise.all((index.events||[]).map(async row=>{
        const actual=await fetchJson(`actuals/${encodeURIComponent(row.currentActualId)}.json`);
        const evaluation=row.currentEvaluationId?await fetchJson(`evaluations/${encodeURIComponent(row.currentEvaluationId)}.json`):null;
        return {...row,actual,evaluation};
      }));
      if(request!==state.request)return;
      state.records=records.sort((a,b)=>b.dayOneDate.localeCompare(a.dayOneDate));state.selected=state.selected&&records.some(row=>row.eventKey===state.selected)?state.selected:records[0]?.eventKey||null;state.loaded=true;render();
    })().catch(error=>{if(request!==state.request)return;console.warn('Prediction accuracy unavailable',error);if(host)host.innerHTML='<div class="accuracy-empty">Prediction accuracy could not be loaded.<button id="accuracyRetry" class="accuracy-retry" type="button">Try again</button></div>';$('accuracyRetry')?.addEventListener('click',()=>load(true));}).finally(()=>{state.loading=null});
    return state.loading;
  }
  window.addEventListener('meta:release-current',()=>{state.loaded=false;if(window.MetaRouter?.get?.().view==='accuracy')load(true);});
  window.MetaAccuracy={activate:()=>load(false),refresh:()=>load(true),render};
})();
