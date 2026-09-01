(function(global){
  'use strict';

  const PARSER_VERSION=1;
  const SUPPORT_POKEMON=new Set(['budew','cleffa','fezandipiti ex','lumineon v','manaphy','mew ex','pidgeot ex','radiant greninja','rotom v','squawkabilly ex']);
  const ARCHETYPE_RULES=[
    {terms:['gimmighoul','gholdengo ex'],label:'Gholdengo'},
    {terms:['dreepy','dragapult ex'],label:'Dragapult'},
    {terms:['ralts','gardevoir ex'],label:'Gardevoir'},
    {terms:['charmander','charizard ex'],label:'Charizard'},
    {terms:['frigibax','chien-pao ex'],label:'Chien-Pao'},
    {terms:['raging bolt ex','teal mask ogerpon ex'],label:'Raging Bolt / Ogerpon'},
    {terms:['grimmsnarl ex','froslass'],label:'Grimmsnarl / Froslass'},
    {terms:['ceruledge ex'],label:'Ceruledge'},
    {terms:['greninja ex'],label:'Greninja'},
    {terms:['miraidon ex'],label:'Miraidon'},
    {terms:['iron thorns ex'],label:'Iron Thorns'},
    {terms:['roaring moon ex'],label:'Roaring Moon'},
    {terms:['hydreigon ex'],label:'Hydreigon'},
    {terms:['joltik','galvantula ex'],label:'Galvantula'},
    {terms:['natu','xatu'],label:'Xatu'},
    {terms:['tarountula','spidops ex'],label:'Spidops'},
    {terms:['zorua','zoroark'],label:'Zoroark'}
  ];

  function unique(values){return [...new Set(values.filter(Boolean))]}
  function escapeRegExp(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function canonicalLog(raw){return String(raw||'').replace(/\r/g,'').split('\n').map(line=>line.trimEnd()).filter(line=>line.trim()).join('\n').trim()}
  function lines(raw){return canonicalLog(raw).split('\n').map(line=>line.trim()).filter(Boolean)}
  function cleanCard(value){
    return String(value||'').trim().replace(/^[-•]\s*/,'').replace(/[.!]$/,'').replace(/\s+/g,' ');
  }
  function normaliseCardName(value){return cleanCard(value).toLowerCase().replace(/[’]/g,"'")}

  function turnPlayer(line){
    return String(line||'').replace(/^Turn #\s*\d+\s*-\s*/i,'').replace(/^-\s*/,'').match(/^(.+?)'s Turn$/i)?.[1]?.trim()||null;
  }

  function getPlayers(logLines){
    const names=[];
    for(const line of logLines){
      const setup=line.match(/^(.+?) drew 7 cards for the opening hand\.?$/i)?.[1];
      const turn=turnPlayer(line);
      const name=(setup||turn||'').trim();
      if(name&&!names.some(existing=>existing.toLowerCase()===name.toLowerCase()))names.push(name);
    }
    if(names.length!==2)throw new Error(`Expected two players; found ${names.length||'none'}`);
    return names;
  }

  function getWinner(logLines,players){
    for(let index=logLines.length-1;index>=0;index--){
      const line=logLines[index];
      const direct=line.match(/(.+?) wins\.?$/i)?.[1]?.split(/\.\s/).pop()?.trim();
      const older=line.match(/^(.+?) won the game\.?$/i)?.[1]?.trim();
      const candidate=direct||older;
      if(!candidate)continue;
      const player=players.find(name=>name.toLowerCase()===candidate.toLowerCase());
      if(player)return player;
    }
    throw new Error('No winner found in this PTCGL log');
  }

  function splitCardList(value){
    const cleaned=cleanCard(value);
    if(!cleaned.includes(','))return [cleaned];
    return cleaned.split(',').map(cleanCard).filter(Boolean);
  }

  function analysePlayers(logLines,playerNames){
    const records=new Map(playerNames.map(name=>[name,{name,cards:[],pokemon:[],privateCards:[],privateRevealCount:0}]));
    let openingPlayer=null,currentActor=null;

    function recordFor(name){return playerNames.find(player=>player.toLowerCase()===String(name||'').toLowerCase())}
    function add(record,values,{pokemon=false,privateReveal=false}={}){
      for(const raw of values){
        const card=cleanCard(raw);
        if(!card||/^\d+ (?:drawn )?cards?$/i.test(card)||/^(?:a|one) card$/i.test(card))continue;
        record.cards.push(card);
        if(pokemon)record.pokemon.push(card);
        if(privateReveal){record.privateCards.push(card);record.privateRevealCount++}
      }
    }

    for(const line of logLines){
      const opening=line.match(/^(.+?) drew 7 cards for the opening hand\.?$/i)?.[1];
      if(opening){openingPlayer=recordFor(opening);currentActor=openingPlayer;continue}

      const bullet=line.match(/^[-•]\s*(.+)$/)?.[1];
      if(bullet){
        const values=splitCardList(bullet);
        if(openingPlayer&&values.length>1){add(records.get(openingPlayer),values,{privateReveal:true});openingPlayer=null}
        else if(currentActor&&values.length>1)add(records.get(currentActor),values);
        continue;
      }
      openingPlayer=null;

      currentActor=playerNames.find(name=>line.toLowerCase().startsWith(name.toLowerCase()))||currentActor;
      for(const player of playerNames){
        const record=records.get(player),escaped=escapeRegExp(player);
        let match=line.match(new RegExp(`^${escaped} drew (.+?)\\.$`,'i'));
        if(match&&!/^(?:a|one|\d+) cards?$/i.test(match[1]))add(record,splitCardList(match[1]),{privateReveal:true});

        match=line.match(new RegExp(`^${escaped} played (.+?)(?: to the (?:Active Spot|Bench|Stadium spot)|\\.)`,'i'));
        if(match)add(record,[match[1]],{pokemon:/Active Spot|Bench/i.test(line)});

        match=line.match(new RegExp(`^${escaped} evolved .+? to (.+?)(?: on| in) `,'i'));
        if(match)add(record,[match[1]],{pokemon:true});

        match=line.match(new RegExp(`^${escaped}'s (.+?) used `,'i'));
        if(match)add(record,[match[1]],{pokemon:true});

        match=line.match(new RegExp(`^${escaped}'s (.+?) is now in the Active Spot`,'i'));
        if(match)add(record,[match[1]],{pokemon:true});

        match=line.match(new RegExp(`^${escaped} attached (.+?) to `,'i'));
        if(match)add(record,[match[1]]);
      }
    }

    return playerNames.map(name=>{
      const record=records.get(name);
      record.cards=unique(record.cards);
      record.pokemon=unique(record.pokemon);
      record.privateCards=unique(record.privateCards);
      return record;
    });
  }

  function inferOwner(players){
    const ranked=[...players].sort((a,b)=>b.privateRevealCount-a.privateRevealCount);
    return ranked[0].privateRevealCount>ranked[1].privateRevealCount?ranked[0].name:null;
  }

  function inferArchetype(cards){
    const names=unique((cards||[]).map(normaliseCardName));
    for(const rule of ARCHETYPE_RULES){if(rule.terms.some(term=>names.some(name=>name.includes(term))))return rule.label}
    const distinctive=names.filter(name=>!SUPPORT_POKEMON.has(name)&&!/basic .+ energy|energy$/i.test(name));
    const ex=distinctive.filter(name=>/\b(?:ex|vstar|vmax|v)\b/i.test(name));
    const choices=(ex.length?ex:distinctive).slice(0,2).map(name=>name.replace(/\b(ex|vstar|vmax|v)\b/ig,match=>match.toUpperCase()).replace(/\b\w/g,char=>char.toUpperCase()));
    return choices.join(' / ')||null;
  }

  function parse(raw){
    const rawLog=String(raw||'').trim();
    if(!rawLog||!/^Setup\b/im.test(rawLog))throw new Error('This does not look like an English PTCGL battle log');
    const logLines=lines(rawLog),playerNames=getPlayers(logLines),winner=getWinner(logLines,playerNames);
    const players=analysePlayers(logLines,playerNames).map(player=>({...player,suggestedArchetype:inferArchetype(player.pokemon)}));
    const turnPlayers=logLines.map(turnPlayer).filter(Boolean);
    return {
      parserVersion:PARSER_VERSION,
      language:'en',
      players,
      winner,
      firstPlayer:turnPlayers[0]||null,
      ownerPlayer:inferOwner(players),
      turnCount:turnPlayers.length,
      rawLog
    };
  }

  function perspective(parsed,playerName){
    const player=parsed.players.find(item=>item.name.toLowerCase()===String(playerName||'').toLowerCase());
    if(!player)throw new Error('Choose which PTCGL player was you');
    const opponent=parsed.players.find(item=>item!==player);
    return {
      player,
      opponent,
      result:parsed.winner.toLowerCase()===player.name.toLowerCase()?'win':'loss',
      wentFirst:parsed.firstPlayer?parsed.firstPlayer.toLowerCase()===player.name.toLowerCase():null
    };
  }

  function scoreDeck(rawText,cardNames){
    if(!global.PTCGDeckParser)return {score:0,matched:0,total:0};
    const deckNames=new Set(global.PTCGDeckParser.parseDeck(rawText||'').cards.map(card=>normaliseCardName(card.name)));
    const seen=unique((cardNames||[]).map(normaliseCardName));
    const matched=seen.filter(card=>deckNames.has(card)).length;
    return {score:matched,matched,total:seen.length};
  }

  async function hash(raw){
    const canonical=canonicalLog(raw);
    if(global.crypto?.subtle&&global.TextEncoder){
      const bytes=await global.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
      return `sha256:${[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}`;
    }
    let value=2166136261;
    for(let index=0;index<canonical.length;index++){value^=canonical.charCodeAt(index);value=Math.imul(value,16777619)}
    return `fnv1a:${(value>>>0).toString(16).padStart(8,'0')}`;
  }

  global.PTCGPTCGLLogParser={PARSER_VERSION,canonicalLog,parse,perspective,inferArchetype,scoreDeck,hash,normaliseCardName};
})(window);
