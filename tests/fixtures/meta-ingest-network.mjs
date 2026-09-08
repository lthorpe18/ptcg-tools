// TEST ONLY: synthetic tournament records on the owner-supplied real boundary.
// No network requests leave this process. Never import this in application code.
const RealDate=Date;
globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:['2026-09-15T03:17:00Z']))}static now(){return new RealDate('2026-09-15T03:17:00Z').getTime()}};
globalThis.fetch=async input=>{
 const url=new URL(input);
 if(url.pathname==='/api/tournaments')return Response.json([
  {id:'synthetic-new',name:'SYNTHETIC new-format tournament',date:'2026-09-15T01:00:00Z',players:50},
  {id:'synthetic-outgoing-late',name:'SYNTHETIC outgoing late tournament',date:'2026-09-14T20:00:00Z',players:50},
 ]);
 if(url.pathname.endsWith('/standings'))return Response.json(Array.from({length:50},(_,i)=>({player:'synthetic-'+i,placing:i+1,deck:{name:'Synthetic Deck'},record:{wins:2,losses:1,ties:0}})));
 if(url.pathname.endsWith('/pairings'))return Response.json([]);
 throw new Error('Unexpected test network request '+url.pathname);
};
