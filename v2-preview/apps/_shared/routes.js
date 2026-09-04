(function(global){
'use strict';
const TOURNAMENT_DAY_REV='td-9';
function tournamentDay(participationId){
  const params=new URLSearchParams();
  if(participationId)params.set('participation',participationId);
  params.set('rev',TOURNAMENT_DAY_REV);
  return `./tournament-day.html?${params.toString()}`;
}
function reviseTournamentDayHref(href){
  try{
    const url=new URL(href,location.href);
    if(!/\/tournament-day\.html$/.test(url.pathname))return href;
    url.searchParams.set('rev',TOURNAMENT_DAY_REV);
    return `${url.pathname.split('/').pop()}?${url.searchParams.toString()}`;
  }catch{return href}
}
document.addEventListener('click',event=>{
  const link=event.target?.closest?.('a[href]');
  if(!link)return;
  const revised=reviseTournamentDayHref(link.getAttribute('href'));
  if(revised!==link.getAttribute('href'))link.setAttribute('href',revised);
},true);
global.PTCGRoutes={...(global.PTCGRoutes||{}),TOURNAMENT_DAY_REV,tournamentDay,reviseTournamentDayHref};
})(window);
