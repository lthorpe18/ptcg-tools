(function(global){
  'use strict';

  const RULESET_VERSION='2027.1';
  const VERIFIED_AT='2026-09-04';

  const OFFICIAL_SOURCES=[
    'https://championships.pokemon.com/en-gb/about/league-challenges-and-league-cup',
    'https://championships.pokemon.com/en-gb/about/pokemon-regional-and-special-championships?pillar=tcg',
    'https://championships.pokemon.com/en-gb/about/international-championships?pillar=tcg'
  ];

  function awards(rows){
    return rows.map(([minPlacement,maxPlacement,minPlayers,cp])=>({
      minPlacement,
      maxPlacement,
      minPlayers,
      cp
    }));
  }

  const championshipPointRuleset={
    id:'pokemon-tcg-2027-cp',
    version:RULESET_VERSION,
    game:'tcg',
    seasonId:'pokemon-2027',
    eventRules:[
      {
        eventType:'league-challenge',
        awards:awards([
          [1,1,0,15],
          [2,2,4,12],
          [3,4,8,10],
          [5,8,14,8],
          [9,16,25,6],
          [17,32,48,4]
        ])
      },
      {
        eventType:'league-cup',
        awards:awards([
          [1,1,0,50],
          [2,2,4,40],
          [3,4,8,32],
          [5,8,17,25],
          [9,16,48,20],
          [17,32,80,16],
          [33,64,128,13]
        ])
      },
      {
        eventType:'regional',
        awards:awards([
          [1,1,0,350],
          [2,2,4,325],
          [3,4,8,300],
          [5,8,17,280],
          [9,16,33,200],
          [17,32,65,160],
          [33,64,129,120],
          [65,128,257,80],
          [129,256,513,60],
          [257,512,1025,45],
          [513,1024,2049,22]
        ])
      },
      {
        eventType:'special',
        awards:awards([
          [1,1,0,350],
          [2,2,4,325],
          [3,4,8,300],
          [5,8,17,280],
          [9,16,33,200],
          [17,32,65,160],
          [33,64,129,120],
          [65,128,257,80],
          [129,256,513,60],
          [257,512,1025,45],
          [513,1024,2049,22]
        ])
      },
      {
        eventType:'international',
        awards:awards([
          [1,1,0,500],
          [2,2,4,480],
          [3,4,8,420],
          [5,8,17,380],
          [9,16,33,300],
          [17,32,65,240],
          [33,64,129,180],
          [65,128,257,140],
          [129,256,513,100],
          [257,512,1025,85],
          [513,1024,2049,42]
        ])
      }
    ],
    bestFinishLimits:[
      {
        id:'league-challenge-bfl',
        eventTypes:['league-challenge'],
        limit:4
      },
      {
        id:'league-cup-bfl',
        eventTypes:['league-cup'],
        limit:4
      },
      {
        id:'major-events-bfl',
        eventTypes:['regional','special','international'],
        limit:5
      }
    ],
    provenance:{
      source:'The Pokemon Company International — Pokemon Championship Series',
      authority:'official',
      verifiedAt:VERIFIED_AT,
      urls:OFFICIAL_SOURCES.slice()
    }
  };

  global.PTCGSeasonRules={
    ...(global.PTCGSeasonRules||{}),
    pokemon2027:championshipPointRuleset
  };
})(window);
