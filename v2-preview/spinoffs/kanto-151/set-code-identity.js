(function(global){
  'use strict';

  const catalog=global.PTCGCardCatalog;
  if(!catalog?.exactDeckIdentity)return;

  const exactDeckIdentity=catalog.exactDeckIdentity.bind(catalog);

  function withSetId(card){
    if(!card||card.set?.id)return card;
    const id=String(card.id||'').trim();
    const localId=String(card.localId??'').trim();
    if(!id||!localId)return card;
    const suffix=`-${localId}`;
    if(!id.endsWith(suffix))return card;
    const setId=id.slice(0,-suffix.length);
    if(!setId)return card;
    return {...card,set:{...(card.set||{}),id:setId}};
  }

  catalog.exactDeckIdentity=card=>exactDeckIdentity(withSetId(card));
})(window);
