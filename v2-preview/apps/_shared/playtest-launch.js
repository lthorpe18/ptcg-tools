(function(global){
  'use strict';

  const KEY='ptcg-tools.playtest.launch.v1';
  const CONTRACT_VERSION=1;
  const DEFAULT_TARGET='../decklists/playtest-v2.html';

  function clean(value){return String(value==null?'':value).trim()}
  function read(){
    try{
      const parsed=JSON.parse(sessionStorage.getItem(KEY)||'null');
      return parsed&&parsed.contractVersion===CONTRACT_VERSION?parsed:null;
    }catch{return null}
  }
  function clear(){try{sessionStorage.removeItem(KEY)}catch{}}

  async function build(options={}){
    if(!global.PTCGDeckStore||!global.PTCGDeckParser)throw new Error('Deck infrastructure unavailable');
    const deckId=clean(options.deckId);
    if(!deckId)throw new Error('Choose a deck before starting Playtest');
    const deck=await global.PTCGDeckStore.get(deckId);
    if(!deck)throw new Error('This deck could not be found');

    const deckVersionId=clean(options.deckVersionId)||null;
    const version=deckVersionId?global.PTCGDeckStore.getVersion(deck,deckVersionId):null;
    if(deckVersionId&&!version)throw new Error('This saved DeckVersion could not be found');

    const rawText=typeof options.rawText==='string'
      ? options.rawText
      : version
        ? version.rawText
        : deck.rawText;
    const parsed=global.PTCGDeckParser.parseDeck(rawText||'');
    if(!parsed.totalCards)throw new Error('Add cards to this list before starting Playtest');

    const listHash=clean(options.listHash)||(version?.listHash||deck.listHash||await global.PTCGDeckParser.hashDecklist(rawText));
    return {
      contractVersion:CONTRACT_VERSION,
      createdAt:new Date().toISOString(),
      source:clean(options.source)|| (version?'deck-version':'working-list'),
      returnUrl:clean(options.returnUrl)||null,
      identity:{
        deckId:deck.id,
        deckVersionId:version?.id||null,
        listHash,
        deckName:deck.name||'Deck',
        versionLabel:version?(version.label||`V${version.ordinal||1}`):null
      },
      rawText
    };
  }

  function freshTarget(target){
    const url=new URL(clean(target)||DEFAULT_TARGET,global.location.href);
    url.searchParams.set('_pt',Date.now().toString());
    return url.href;
  }

  async function open(options={}){
    const payload=await build(options);
    try{sessionStorage.setItem(KEY,JSON.stringify(payload))}catch{}
    global.location.href=freshTarget(clean(options.targetUrl)||DEFAULT_TARGET);
    return payload;
  }

  global.PTCGPlaytestLaunch={KEY,CONTRACT_VERSION,DEFAULT_TARGET,read,clear,build,open,freshTarget};
})(window);
