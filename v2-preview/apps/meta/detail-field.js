(() => {
  'use strict';
  const copies=new Map();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=value=>Number.isFinite(value)?`${(100*value).toFixed(1)}%`:'Unknown';
  function save(value) {
    const id=typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const copy=clone({...value,version:1});copies.set(id,copy);
    try { sessionStorage.setItem('ptcg:detail-field:'+id,JSON.stringify(copy)); } catch {}
    return id;
  }
  function missing() { return {version:1,source:'expected',definition:{source:'expected',format:null,available:false,reason:'This field snapshot is unavailable in this tab. Choose a field to continue.',rows:[],provenance:{label:'Unavailable field snapshot'}},rows:[],matchupSource:'combined',onlineScope:'30'}; }
  function get(id) {
    if (!id || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return missing();
    try {
      const value=copies.get(id) || JSON.parse(sessionStorage.getItem('ptcg:detail-field:'+id));
      return value?.version===1 && value.definition && Array.isArray(value.rows) ? clone(value) : missing();
    } catch { return missing(); }
  }
  function fromDefinition(definition, expectedField=null) {
    const all=definition.rows || [], names=new Set((definition.source==='expected' ? all : window.PTCGMetaField.selectCoverage(all,.9).rows).map(row=>row.name));
    return {source:definition.source,definition,expectedField,rows:all.map(row=>({...row,originalShare:row.share,included:names.has(row.name),defaultIncluded:names.has(row.name),pinned:false})),touched:false,showAll:false,matchupSource:'combined',onlineScope:window.MetaState?.get?.().onlineScope || '30'};
  }
  function create(source, format, savedId) {
    const expectedField=savedId?window.SavedMetas?.get?.(savedId):null;
    const definition=window.MetaWSIPSource.resolve({source,format,expectedField});
    const snapshot=fromDefinition(definition,expectedField);
    const editor=window.SavedMetas?.editorState?.(expectedField);
    if(editor){snapshot.rows=editor.rows;snapshot.touched=!!editor.touched;}
    return save(snapshot);
  }
  function capture() {
    return save({...window.PrepField.capture(),matchupSource:document.getElementById('playMatchupSource')?.value || 'combined',onlineScope:window.MetaState?.get?.().onlineScope || '30'});
  }
  function restore(id) {
    const snapshot=get(id);
    if (document.getElementById('playMatchupSource')) document.getElementById('playMatchupSource').value=snapshot.matchupSource || 'combined';
    // Keep the evaluation scope with the definition, independent of later browsing.
    snapshot.definition.onlineScope=snapshot.onlineScope;
    window.PrepField.restore(snapshot);
  }
  function fieldRows(snapshot) { return window.PTCGMetaField.normalizeRows(snapshot.rows.filter(row=>row.included && row.share>0)); }
  function analyse(id, name) {
    const snapshot=get(id),definition={...snapshot.definition,onlineScope:snapshot.onlineScope};
    const inputs=window.MetaWSIPSource.inputs(definition,snapshot.matchupSource);
    const model=window.PTCGRecommendation.analyse({fieldRows:definition.available===false?[]:fieldRows(snapshot),candidates:[{name}],evidence:inputs.evidence,matchupSource:snapshot.matchupSource});
    return {snapshot,model,row:model.all.find(row=>row.name===name)};
  }
  let loadKey='',loading=null,error=null,generation=0;
  function route() { const route=window.MetaRouter?.get?.();return route?.view==='detail'?route.detail:null; }
  async function render(force=false) {
    const next=route(),host=document.getElementById('detailFieldPanel');
    if(!next || !host)return;
    const id=next.fieldContext,snapshot=get(id),format=snapshot.definition.format || snapshot.definition.provenance?.targetFormat;
    const key=JSON.stringify([window.MetaData.release(),id]);
    if(force || key!==loadKey) {
      loadKey=key;error=null;const token=++generation;
      const envs=snapshot.matchupSource==='combined'?['online','irl']:[snapshot.matchupSource || 'online'];
      const request=Promise.all(envs.map(env=>window.MetaData.ensureForFormat(env,format)));
      loading=request;
      request.catch(e=>{if(token===generation)error=e}).finally(()=>{if(token===generation){loading=null;render()}});
    }
    const source=snapshot.expectedField?.id?'saved:'+snapshot.expectedField.id:snapshot.source;
    const predictions=window.MetaBlendedField.predictions();
    const formats=snapshot.source==='blend'?predictions.map(row=>({format:row.format,available:row.available})):(snapshot.source==='online'||snapshot.source==='irl')?window.MetaWSIPSource.formats(snapshot.source):[];
    if(format && !formats.some(row=>row.format===format))formats.push({format,available:true});
    const saved=window.SavedMetas?.list?.() || [];
    if(snapshot.expectedField?.id && !saved.some(row=>row.id===snapshot.expectedField.id))saved.push(snapshot.expectedField);
    const options=[['blend','Blended'],['online','Online field'],['irl','IRL field'],...saved.map(row=>['saved:'+row.id,window.SavedMetas.label?.(row) || row.name])];
    if(!options.some(([value])=>value===source))options.push([source,'Selected field']);
    const controls=`<div class="child-source-row"><label>Field<select id="detailFieldSource">${options.map(([value,label])=>`<option value="${esc(value)}" ${value===source?'selected':''} ${value==='blend'&&!predictions.some(row=>row.available)?'disabled':''}>${esc(label)}</option>`).join('')}</select></label><label>Format<select id="detailFieldFormat" ${['expected','custom'].includes(snapshot.source)?'disabled':''}>${formats.length?formats.map(row=>`<option value="${esc(row.format)}" ${row.format===format?'selected':''} ${row.available?'':'disabled'}>${esc(row.format)}${row.available?'':' · unavailable'}</option>`).join(''):'<option>Unknown format</option>'}</select></label><label>Evaluation H2H<select id="detailFieldH2H">${[['combined','Online + IRL'],['online','Online only'],['irl','IRL only']].map(([value,label])=>`<option value="${value}" ${value===snapshot.matchupSource?'selected':''}>${label}</option>`).join('')}</select></label></div>`;
    const {row}=analyse(id,next.deckName);
    const status=snapshot.definition.available===false?esc(snapshot.definition.reason || 'Selected field unavailable'):error?'Compatible H2H could not load.':loading?'Loading compatible H2H…':!row?'No decisive compatible H2H for this variant.':`<b>${Number(row.expectedWR).toFixed(1)}% covered-field estimate</b> · ${pct(row.coverage)} H2H coverage · ${esc(row.evidenceLabel || row.evidenceLevel)}`;
    const breakdown=!error&&!loading&&row?`<details><summary>Matchups against this field</summary><div class="wsip-matchup-list">${row.matchups.map(item=>`<div><span><b>${esc(item.opponent)}</b><small>${pct(item.share)} of selected field · ${item.known?item.decisiveGames+' decisive games':'Unknown'}</small></span><strong>${item.known?Number(item.estimate).toFixed(1)+'%':'Unknown'}</strong></div>`).join('')}</div></details>`:'';
    host.innerHTML=`<section class="play-surface"><h2>Against your selected field</h2>${controls}<p>${esc(snapshot.definition.provenance?.label || snapshot.source)} · ${esc(format || 'Unknown format')}${snapshot.touched?' · edited field':''}</p><p>${status}</p>${error?'<button type="button" id="detailFieldRetry">Retry evidence</button>':''}${breakdown}<p class="advanced-method">Predicted performance against the selected composition, using the shared 12-game prior. Unknown matchups remain unknown. Observed tournament statistics are separate below.</p><button type="button" id="detailToWSIP" class="text-button">Use this field in What should I play?</button></section>`;
  }
  const host=document.getElementById('detailFieldPanel');
  let selectionGeneration=0;
  host?.addEventListener('change',async event=>{
    const next=route();if(!next)return;
    const old=get(next.fieldContext),controlId=event.target.id,value=event.target.value,token=++selectionGeneration;let id;
    if(controlId!=='detailFieldH2H'){
      try {await window.MetaBlendedField.ensure()} catch {error=new Error('Field evidence unavailable');render();return}
      if(token!==selectionGeneration || route()?.fieldContext!==next.fieldContext || route()?.deckName!==next.deckName)return;
    }
    if(controlId==='detailFieldH2H')id=save({...old,matchupSource:value});
    else if(controlId==='detailFieldSource'){
      const source=value.startsWith('saved:')?'expected':value;
      const formats=window.MetaWSIPSource.formats(source);
      const format=formats.some(row=>row.format===old.definition.format&&row.available)?old.definition.format:window.MetaWSIPSource.target(source);
      id=create(source,format,value.startsWith('saved:')?value.slice(6):null);
    } else if(controlId==='detailFieldFormat')id=create(old.source,value);
    if(id)window.MetaRouter.setFieldContext(id);
  });
  host?.addEventListener('click',event=>{
    if(event.target.closest('#detailFieldRetry'))render(true);
    if(event.target.closest('#detailToWSIP'))window.MetaRouter.detailToWSIP();
  });
  window.MetaDetailField={save,get,create,capture,restore,fieldRows,analyse,render};
})();
