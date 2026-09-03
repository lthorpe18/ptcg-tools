(function(global){
  'use strict';

  const KEY='ptcg-tools.playtest.launch.v1';
  const LOCAL_KEY='ptcg-tools.playtest.launch-fallback.v1';
  const CONTRACT_VERSION=1;
  const MAX_FALLBACK_AGE_MS=10*60*1000;
  const DEFAULT_TARGET='../decklists/playtest-v2.html';

  function clean(value){return String(value==null?'':value).trim()}
  function valid(parsed){
    return !!(parsed&&parsed.contractVersion===CONTRACT_VERSION&&parsed.identity?.deckId&&parsed.rawText);
  }
  function readStore(storage,key){
    try{const parsed=JSON.parse(storage.getItem(key)||'null');return valid(parsed)?parsed:null}catch{return null}
  }
  function read(){
    const session=readStore(sessionStorage,KEY);if(session)return session;
    const local=readStore(localStorage,LOCAL_KEY);if(!local)return null;
    const created=Date.parse(local.createdAt||'');
    if(!Number.isFinite(created)||Date.now()-created>MAX_FALLBACK_AGE_MS){try{localStorage.removeItem(LOCAL_KEY)}catch{}return null}
    return local;
  }
  function clear(){try{sessionStorage.removeItem(KEY)}catch{}try{localStorage.removeItem(LOCAL_KEY)}catch{}}

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

  function freshTarget(target,payload){
    const url=new URL(clean(target)||DEFAULT_TARGET,global.location.href);
    url.searchParams.set('_pt',Date.now().toString());
    if(payload?.identity?.deckId)url.searchParams.set('deck',payload.identity.deckId);
    if(payload?.identity?.deckVersionId)url.searchParams.set('version',payload.identity.deckVersionId);
    if(payload?.identity?.listHash)url.searchParams.set('list',payload.identity.listHash);
    return url.href;
  }

  async function open(options={}){
    const payload=await build(options),text=JSON.stringify(payload);
    try{sessionStorage.setItem(KEY,text)}catch{}
    try{localStorage.setItem(LOCAL_KEY,text)}catch{}
    global.location.href=freshTarget(clean(options.targetUrl)||DEFAULT_TARGET,payload);
    return payload;
  }

  global.PTCGPlaytestLaunch={KEY,LOCAL_KEY,CONTRACT_VERSION,DEFAULT_TARGET,read,clear,build,open,freshTarget};
})(window);
