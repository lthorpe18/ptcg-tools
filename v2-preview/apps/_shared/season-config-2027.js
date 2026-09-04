(function(global){
  'use strict';

  const season={
    id:'pokemon-2027',
    label:'2027 Championship Series',
    startDate:'2026-09-01',
    endDate:null,
    rulesetId:'pokemon-tcg-2027-cp',
    boundaryStatus:'start-verified-end-pending',
    provenance:{
      source:'The Pokemon Company International — Play! Pokemon',
      authority:'official',
      verifiedAt:'2026-09-04',
      note:'Season start is official. Whole-season end boundary is intentionally unset until directly verified.'
    }
  };

  global.PTCGCompetitiveSeasons={
    ...(global.PTCGCompetitiveSeasons||{}),
    pokemon2027:season
  };
})(window);
