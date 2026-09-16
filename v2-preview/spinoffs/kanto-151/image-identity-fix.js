(function(global){
  'use strict';

  const catalog=global.PTCGCardCatalog;
  const images=global.PTCGCardImages;
  if(!catalog||!images?.resolve)return;

  const originalResolve=images.resolve.bind(images);
  const originalImage=typeof catalog.image==='function'?catalog.image.bind(catalog):null;

  function rawNumber(card){
    return String(card?.localId??card?.number??'').trim().toUpperCase().replace(/\s+/g,'');
  }

  function alphanumericVariants(value){
    const raw=String(value||'').trim().toUpperCase().replace(/\s+/g,'');
    if(!/[A-Z]/.test(raw))return [];
    const match=raw.match(/^([A-Z]+)(\d+)([A-Z]*)$/);
    if(!match)return [raw];
    const compact=`${match[1]}${String(Number(match[2]))}${match[3]}`;
    return [...new Set([compact,raw])];
  }

  function limitlessCandidates(setCode,numbers,quality='low'){
    const set=String(setCode||'').trim().toUpperCase();
    if(!set||!numbers?.length)return [];
    const hosts=[
      'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com',
      'https://limitlesstcg.nyc3.digitaloceanspaces.com'
    ];
    const suffixes=quality==='high'?['_R_EN_LG.png','_R_EN.png']:['_R_EN.png','_R_EN_LG.png'];
    return hosts.flatMap(host=>numbers.flatMap(number=>suffixes.map(suffix=>
      `${host}/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(number)}${suffix}`
    )));
  }

  catalog.image=function(card,quality='low'){
    if(alphanumericVariants(rawNumber(card)).length)return '';
    return originalImage?originalImage(card,quality):'';
  };

  images.resolve=async function(card,options={}){
    const variants=alphanumericVariants(rawNumber(card));
    if(!variants.length)return originalResolve(card,options);

    let identity=null;
    try{identity=await catalog.exactDeckIdentity?.(card);}catch{}
    if(!identity?.set)return originalResolve(card,options);

    let original=null;
    try{original=await originalResolve(card,options);}catch{}
    const quality=options.quality==='high'?'high':'low';
    const canonical=limitlessCandidates(identity.set,variants,quality);
    const tcgdexFallbacks=(original?.candidates||[]).filter(url=>String(url).includes('tcgdex'));
    const candidates=images.registerFallbackChain?
      images.registerFallbackChain([...canonical,...tcgdexFallbacks]):
      [...canonical,...tcgdexFallbacks];

    return {
      ...(original||{}),
      primary:candidates[0]||'',
      fallback:candidates[1]||'',
      candidates,
      source:candidates[0]?.includes('limitlesstcg')?'limitless':original?.source||'',
      card:original?.card||card
    };
  };

  global.PTCGKantoImageIdentity={rawNumber,alphanumericVariants,limitlessCandidates};
})(window);
