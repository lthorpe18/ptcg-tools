(function(global){
'use strict';
const TOURNAMENT_DAY_REV='td-9';
function tournamentDay(participationId){
  const params=new URLSearchParams();
  if(participationId)params.set('participation',participationId);
  params.set('rev',TOURNAMENT_DAY_REV);
  return `./tournament-day.html?${params.toString()}`;
}
global.PTCGRoutes={...(global.PTCGRoutes||{}),TOURNAMENT_DAY_REV,tournamentDay};
})(window);
