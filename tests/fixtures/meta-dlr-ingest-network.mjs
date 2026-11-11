// TEST ONLY: simulate a delayed DLR rollover where the previous TEF-30C archive
// already contains online tournaments played after the new set became legal.
const RealDate=Date;
globalThis.Date=class extends RealDate {
  constructor(...args){super(...(args.length?args:['2026-11-11T11:00:00Z']))}
  static now(){return new RealDate('2026-11-11T11:00:00Z').getTime()}
};
globalThis.fetch=async input=>{
  const url=new URL(input);
  if(url.pathname==='/api/tournaments')return Response.json([
    {id:'synthetic-dlr',name:'SYNTHETIC DLR tournament',date:'2026-11-06T19:00:00Z',players:50},
    {id:'synthetic-late',name:'SYNTHETIC 5 Nov after Live activation',date:'2026-11-05T19:00:00Z',players:50},
    {id:'synthetic-early',name:'SYNTHETIC 5 Nov before Live activation',date:'2026-11-05T11:30:00Z',players:50},
    {id:'synthetic-30c',name:'SYNTHETIC 30C tournament',date:'2026-11-04T19:00:00Z',players:50},
  ]);
  if(url.pathname.endsWith('/standings'))return Response.json(Array.from({length:50},(_,i)=>({
    player:'synthetic-'+i,placing:i+1,deck:{name:'Synthetic Deck'},record:{wins:2,losses:1,ties:0}
  })));
  if(url.pathname.endsWith('/pairings'))return Response.json([]);
  throw new Error('Unexpected test network request '+url.pathname);
};
