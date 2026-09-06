(() => {
  'use strict';
  const engine=window.PTCGMetaBlend;
  window.MetaBlendedField={
    current:options=>engine.currentFromMeta(window.MetaData,options),
    mergeRows:engine.mergeRows,
    weightsForDays:engine.weightsForDays,
    policy:engine.policy,
  };

  function addStyle(){if(document.querySelector('link[data-blended-performance-style]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./blended-performance.css?v=1';link.dataset.blendedPerformanceStyle='1';document.head.appendChild(link)}
  function addScript(src,key){const selector=`script[data-meta-addon="${key}"]`;if(document.querySelector(selector))return;const script=document.createElement('script');script.src=src;script.async=false;script.dataset.metaAddon=key;document.head.appendChild(script)}
  function addSurface(){
    const grid=document.querySelector('.meta-explore-grid');
    if(grid&&!grid.querySelector('[data-meta-route="performance"]')){const button=document.createElement('button');button.className='meta-explore-card';button.type='button';button.dataset.metaRoute='performance';button.innerHTML='<b>Prediction performance</b><span>See forecast accuracy and Blended formula evidence.</span>';grid.appendChild(button)}
    const main=document.querySelector('main.wrap');
    if(main&&!document.getElementById('blendedPerformance')){const section=document.createElement('section');section.id='blendedPerformance';section.className='meta-child performance-page hidden';section.hidden=true;section.setAttribute('inert','');section.innerHTML='<header class="meta-child-header performance-intro"><button class="meta-back" type="button" data-meta-route="current">← Current meta</button><div class="meta-child-title"><div><div class="eyebrow">BLENDED MODEL</div><h1>Prediction performance</h1><p>How the final pre-Major forecast compared with the full Day 1 field.</p></div></div></header><div id="blendedPerformanceBody" class="performance-body"><div class="performance-empty app-card">Loading prediction evidence…</div></div>';main.appendChild(section)}
  }
  addStyle();addSurface();addScript('./blended-availability.js?v=1','blendedAvailability');addScript('./blended-performance.js?v=1','blendedPerformance');
})();