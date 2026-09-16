(function(global){
  'use strict';

  const STORAGE_KEY='ptcg-kanto-151-v1';
  const catalog=global.PTCGCardCatalog;
  const images=global.PTCGCardImages;

  function classify(saved){
    if(!saved?.card?.id)return 'unselected';
    return saved.owned?'owned':'wanted';
  }

  function visibleFor(status,filter){
    if(filter==='wanted')return status==='wanted';
    if(filter==='owned')return status==='owned';
    return true;
  }

  function sortOrder(number,status,mode){
    const n=Number(number)||0;
    if(mode==='wanted'){
      const group=status==='wanted'?0:status==='owned'?1:2;
      return group*1000+n;
    }
    if(mode==='owned'){
      const group=status==='owned'?0:status==='wanted'?1:2;
      return group*1000+n;
    }
    return n;
  }

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'?parsed:{};
    }catch{return {};}
  }

  function wantedEntries(state){
    return Object.entries(state||{})
      .filter(([,saved])=>classify(saved)==='wanted')
      .map(([number,saved])=>({number:Number(number)||0,saved}))
      .sort((a,b)=>a.number-b.number);
  }

  function uniqueNames(values){
    const seen=new Set();
    const result=[];
    (values||[]).forEach(value=>{
      const text=String(value||'').trim();
      const key=text.toLocaleLowerCase('en');
      if(!text||seen.has(key))return;
      seen.add(key);
      result.push(text);
    });
    return result;
  }

  function cardmarketTerms(card){
    return uniqueNames([
      ...(card?.abilities||[]).map(item=>item?.name),
      ...(card?.attacks||[]).map(item=>item?.name)
    ]);
  }

  function formatCardmarketLine(card){
    const name=String(card?.name||'').trim();
    if(!name)return '';
    const terms=cardmarketTerms(card);
    const setName=String(card?.set?.name||'').trim();
    return `1x ${name}${terms.length?` ${terms.join(' ')}`:''}${setName?` (${setName})`:''}`;
  }

  function wantedImageLayout(count){
    const total=Math.max(0,Number(count)||0);
    if(!total)return {columns:0,rows:0,width:0,height:0,cardWidth:200,cardHeight:280,gap:16,margin:32,headerHeight:96};
    const columns=total<=4?total:5;
    const rows=Math.ceil(total/columns);
    const cardWidth=200;
    const cardHeight=280;
    const gap=16;
    const margin=32;
    const headerHeight=96;
    return {
      columns,rows,cardWidth,cardHeight,gap,margin,headerHeight,
      width:(margin*2)+(columns*cardWidth)+(Math.max(0,columns-1)*gap),
      height:(margin*2)+headerHeight+(rows*cardHeight)+(Math.max(0,rows-1)*gap)
    };
  }

  const api={classify,visibleFor,sortOrder,wantedEntries,cardmarketTerms,formatCardmarketLine,wantedImageLayout};
  global.PTCGKantoCollectionControls=api;

  const grid=document.getElementById('pokedex-grid');
  const filterButtons=[...document.querySelectorAll('[data-collection-filter]')];
  const sortSelect=document.getElementById('collection-sort');
  const copyButton=document.getElementById('copy-wanted');
  const copyStatus=document.getElementById('collection-copy-status');
  const allCount=document.getElementById('collection-count-all');
  const wantedCount=document.getElementById('collection-count-wanted');
  const ownedCount=document.getElementById('collection-count-owned');
  if(!grid||!filterButtons.length||!sortSelect||!copyButton)return;

  const generateButton=document.getElementById('generate-wanted-image')||(()=>{
    const button=document.createElement('button');
    button.id='generate-wanted-image';
    button.className='secondary-button';
    button.type='button';
    button.textContent='Generate wanted image';
    copyButton.insertAdjacentElement('afterend',button);
    return button;
  })();

  const imageDialog=document.getElementById('wanted-image-dialog')||(()=>{
    const dialog=document.createElement('dialog');
    dialog.id='wanted-image-dialog';
    dialog.className='wanted-image-dialog';
    dialog.innerHTML=`<div class="wanted-image-panel">
      <header class="wanted-image-header">
        <div><strong>Wanted cards image</strong><span id="wanted-image-summary"></span></div>
        <button id="close-wanted-image" class="icon-button" type="button" aria-label="Close wanted cards image">×</button>
      </header>
      <img id="wanted-image-preview" alt="Generated grid of wanted Pokémon cards">
      <div class="wanted-image-actions">
        <button id="copy-wanted-image" class="primary-button" type="button">Copy image</button>
        <button id="save-wanted-image" class="secondary-button" type="button">Save PNG</button>
      </div>
    </div>`;
    document.body.appendChild(dialog);
    return dialog;
  })();

  const imagePreview=imageDialog.querySelector('#wanted-image-preview');
  const imageSummary=imageDialog.querySelector('#wanted-image-summary');
  const copyImageButton=imageDialog.querySelector('#copy-wanted-image');
  const saveImageButton=imageDialog.querySelector('#save-wanted-image');
  const closeImageButton=imageDialog.querySelector('#close-wanted-image');

  let filterMode='all';
  let wantedImageBlob=null;
  let wantedImageUrl='';

  function stateCounts(state){
    let wanted=0,owned=0;
    for(const saved of Object.values(state||{})){
      const status=classify(saved);
      if(status==='wanted')wanted++;
      else if(status==='owned')owned++;
    }
    return {all:151,wanted,owned};
  }

  function applyView(){
    const state=loadState();
    const counts=stateCounts(state);
    if(allCount)allCount.textContent=String(counts.all);
    if(wantedCount)wantedCount.textContent=String(counts.wanted);
    if(ownedCount)ownedCount.textContent=String(counts.owned);
    copyButton.disabled=counts.wanted===0;
    generateButton.disabled=counts.wanted===0;

    filterButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.collectionFilter===filterMode)));

    grid.querySelectorAll('.dex-slot[data-number]').forEach(slot=>{
      const number=Number(slot.dataset.number)||0;
      const status=classify(state[String(number)]);
      slot.hidden=!visibleFor(status,filterMode);
      slot.style.order=String(sortOrder(number,status,sortSelect.value));
    });
  }

  async function detailsFor(entry){
    const compact=entry?.saved?.card||null;
    if(!compact?.id)return compact;
    try{return await catalog?.card?.(compact.id)||compact;}catch{return compact;}
  }

  async function writeClipboard(text){
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea=document.createElement('textarea');
    textarea.value=text;
    textarea.setAttribute('readonly','');
    textarea.style.position='fixed';
    textarea.style.opacity='0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied=document.execCommand?.('copy');
    textarea.remove();
    if(!copied)throw new Error('Clipboard unavailable');
  }

  async function copyWanted(){
    const entries=wantedEntries(loadState());
    if(!entries.length)return;
    copyButton.disabled=true;
    copyStatus.textContent='Preparing Cardmarket list…';
    try{
      const details=await Promise.all(entries.map(detailsFor));
      let lowConfidence=0;
      const lines=details.map((detail,index)=>{
        const card=detail||entries[index].saved.card;
        if(!cardmarketTerms(card).length)lowConfidence++;
        return formatCardmarketLine(card);
      }).filter(Boolean);
      await writeClipboard(lines.join('\n'));
      copyStatus.textContent=`Copied ${lines.length} wanted card${lines.length===1?'':'s'}${lowConfidence?` · ${lowConfidence} may need manual matching`:''}.`;
    }catch(error){
      copyStatus.textContent=error?.message||'Could not copy wanted list.';
    }finally{
      applyView();
    }
  }

  function uniqueUrls(values){
    return [...new Set((values||[]).map(value=>String(value||'').trim()).filter(Boolean))];
  }

  async function imageCandidates(card){
    const candidates=[];
    if(images?.resolve){
      try{
        const resolved=await images.resolve(card,{catalog,quality:'low'});
        candidates.push(...(resolved?.candidates||[]));
      }catch{}
    }
    const root=String(card?.image||'').trim().replace(/\/$/,'');
    if(root){
      candidates.push(`${root}/low.webp`,`${root}/high.webp`);
    }
    return uniqueUrls(candidates);
  }

  function loadCanvasImage(url){
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.crossOrigin='anonymous';
      image.decoding='async';
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('Image unavailable'));
      image.src=url;
    });
  }

  async function loadFirstImage(candidates){
    for(const url of candidates){
      try{return await loadCanvasImage(url);}catch{}
    }
    return null;
  }

  function drawPlaceholder(ctx,x,y,width,height,entry,card){
    ctx.fillStyle='#202630';
    ctx.fillRect(x,y,width,height);
    ctx.strokeStyle='#394455';
    ctx.lineWidth=2;
    ctx.strokeRect(x+1,y+1,width-2,height-2);
    ctx.fillStyle='#f4f6f8';
    ctx.font='700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`#${String(entry.number).padStart(3,'0')}`,x+14,y+34,width-28);
    ctx.font='700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(String(card?.name||entry?.saved?.card?.name||'Card'),x+14,y+62,width-28);
    ctx.fillStyle='#9ba7b7';
    ctx.font='14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Image unavailable',x+14,y+88,width-28);
  }

  function canvasToPng(canvas){
    return new Promise((resolve,reject)=>{
      try{
        canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create PNG.')),'image/png');
      }catch(error){reject(error);}
    });
  }

  async function generateWantedImage(){
    const entries=wantedEntries(loadState());
    if(!entries.length)return;
    const layout=wantedImageLayout(entries.length);
    generateButton.disabled=true;
    copyStatus.textContent=`Generating wanted image… 0/${entries.length}`;

    try{
      const canvas=document.createElement('canvas');
      canvas.width=layout.width;
      canvas.height=layout.height;
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Image generation is unavailable.');

      ctx.fillStyle='#101319';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#f4f6f8';
      ctx.font='800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('Kanto 151 · Wanted cards',layout.margin,layout.margin+36);
      ctx.fillStyle='#9ba7b7';
      ctx.font='600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`${entries.length} card${entries.length===1?'':'s'}`,layout.margin,layout.margin+66);

      let unavailable=0;
      const batchSize=4;
      for(let start=0;start<entries.length;start+=batchSize){
        const batch=entries.slice(start,start+batchSize);
        const prepared=await Promise.all(batch.map(async entry=>{
          const card=await detailsFor(entry)||entry.saved.card;
          const candidateUrls=await imageCandidates(card);
          const image=await loadFirstImage(candidateUrls);
          return {entry,card,image};
        }));

        prepared.forEach(({entry,card,image},offset)=>{
          const index=start+offset;
          const column=index%layout.columns;
          const row=Math.floor(index/layout.columns);
          const x=layout.margin+column*(layout.cardWidth+layout.gap);
          const y=layout.margin+layout.headerHeight+row*(layout.cardHeight+layout.gap);
          if(image){
            ctx.drawImage(image,x,y,layout.cardWidth,layout.cardHeight);
          }else{
            unavailable++;
            drawPlaceholder(ctx,x,y,layout.cardWidth,layout.cardHeight,entry,card);
          }
        });
        copyStatus.textContent=`Generating wanted image… ${Math.min(start+batch.length,entries.length)}/${entries.length}`;
      }

      const blob=await canvasToPng(canvas);
      if(wantedImageUrl)URL.revokeObjectURL(wantedImageUrl);
      wantedImageBlob=blob;
      wantedImageUrl=URL.createObjectURL(blob);
      imagePreview.src=wantedImageUrl;
      imageSummary.textContent=`${entries.length} wanted card${entries.length===1?'':'s'}${unavailable?` · ${unavailable} image${unavailable===1?'':'s'} unavailable`:''}`;
      copyStatus.textContent='Wanted image generated.';
      imageDialog.showModal();
    }catch(error){
      copyStatus.textContent=error?.message||'Could not generate wanted image.';
    }finally{
      applyView();
    }
  }

  async function copyGeneratedImage(){
    if(!wantedImageBlob)return;
    if(!navigator.clipboard?.write||typeof global.ClipboardItem!=='function'){
      imageSummary.textContent='Image copy is not supported in this browser. Use Save PNG instead.';
      return;
    }
    try{
      await navigator.clipboard.write([new global.ClipboardItem({'image/png':wantedImageBlob})]);
      imageSummary.textContent='Copied image to clipboard.';
    }catch(error){
      imageSummary.textContent=error?.message||'Could not copy image. Use Save PNG instead.';
    }
  }

  function saveGeneratedImage(){
    if(!wantedImageBlob||!wantedImageUrl)return;
    const link=document.createElement('a');
    link.href=wantedImageUrl;
    link.download='kanto-151-wanted.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  filterButtons.forEach(button=>button.addEventListener('click',()=>{
    filterMode=button.dataset.collectionFilter||'all';
    applyView();
  }));
  sortSelect.addEventListener('change',applyView);
  copyButton.addEventListener('click',copyWanted);
  generateButton.addEventListener('click',generateWantedImage);
  copyImageButton?.addEventListener('click',copyGeneratedImage);
  saveImageButton?.addEventListener('click',saveGeneratedImage);
  closeImageButton?.addEventListener('click',()=>imageDialog.close());
  imageDialog.addEventListener('click',event=>{if(event.target===imageDialog)imageDialog.close();});

  const observer=new MutationObserver(()=>applyView());
  observer.observe(grid,{childList:true});
  applyView();
})(window);
