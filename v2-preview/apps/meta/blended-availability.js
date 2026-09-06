(() => {
  'use strict';
  function sync(){
    const result=window.MetaBlendedField?.current?.()||window.PTCGMetaBlend?.currentFromCore?.(window.MetaRelease?.core?.())||{available:false};
    document.querySelectorAll('[data-current-source="blend"]').forEach(button=>{button.disabled=!result.available;button.setAttribute('aria-disabled',String(!result.available));button.title=result.available?'':result.reason||'Blended unavailable'});
    document.querySelectorAll('select').forEach(select=>{const option=[...select.options].find(row=>row.value==='blend');if(!option)return;option.disabled=!result.available;option.textContent=result.available?`Blended current field${result.format?` · ${result.format}`:''}`:'Blended unavailable'});
    const pill=document.querySelector('.format-context');if(pill){const runtime=window.PTCGFormatRuntime?.current?.(),online=runtime?.online?.label||result.format,irl=runtime?.irl?.label;if(online)pill.querySelector('span:last-child').textContent=online===irl?`${online} · Standard`:`Online ${online} · IRL ${irl||'—'}`;}
    const active=document.querySelector('[data-current-source="blend"].active');
    if(active&&!result.available){const stats=document.getElementById('currentMetaStats'),list=document.getElementById('currentMetaList'),more=document.getElementById('currentMetaMore');if(stats)stats.innerHTML=`<div><b>—</b><span>IRL weight</span></div><div><b>—</b><span>Online weight</span></div><div class="wide"><b>Blended unavailable</b><span>${String(result.reason||'Waiting for current-format evidence.')}</span></div>`;if(list)list.innerHTML='<div class="meta-empty">Choose Online or IRL to continue while Blended is unavailable.</div>';if(more)more.hidden=true;}
    const fieldSelect=document.getElementById('playFieldSource'),context=document.getElementById('playSourceContext');if(fieldSelect?.value==='blend'&&context){const field=context.querySelector('div:first-child span');if(field)field.textContent=result.available?`Blended current field · ${result.formula?.versionKey||''} · ${Math.round(100*Number(result.weights?.online||0))}% Online / ${Math.round(100*Number(result.weights?.irl||0))}% IRL${result.earlyFormat?' · Early format':''}`:`Blended unavailable · ${result.reason||'Waiting for current-format evidence.'}`;}
    window.dispatchEvent(new CustomEvent('meta:blend-availability',{detail:result}));
  }
  document.getElementById('playFieldSource')?.addEventListener('change',()=>setTimeout(sync,0));
  ['meta:data-changed','meta:release-core','ptcg:format-config'].forEach(name=>window.addEventListener(name,()=>setTimeout(sync,0)));
  window.PTCGFormatRuntime?.ready?.().then(sync);setTimeout(sync,0);
  window.MetaBlendAvailability={sync};
})();
