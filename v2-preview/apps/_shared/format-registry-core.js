(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PTCGFormatRegistryCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const CHANNEL_FIELDS={online:'onlineLegalDate',irl:'irlLegalDate'};
  const CODE_PATTERN=/^[A-Z0-9]{2,5}$/;
  const DATE_PATTERN=/^\d{4}-\d{2}-\d{2}$/;
  const PREPARED={
    schemaVersion:SCHEMA_VERSION,
    registry:{
      versionNumber:2,
      publishedAt:'2026-09-06T16:36:39.895Z',
      sets:[
        {setCode:'TEF',setTitle:'Temporal Forces',releaseOrder:1,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'TWM',setTitle:'Twilight Masquerade',releaseOrder:2,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'SFA',setTitle:'Shrouded Fable',releaseOrder:3,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'SCR',setTitle:'Stellar Crown',releaseOrder:4,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'SSP',setTitle:'Surging Sparks',releaseOrder:5,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'PRE',setTitle:'Prismatic Evolutions',releaseOrder:6,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'JTG',setTitle:'Journey Together',releaseOrder:7,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'DRI',setTitle:'Destined Rivals',releaseOrder:8,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'BLK',setTitle:'Black Bolt',releaseOrder:9,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'WHT',setTitle:'White Flare',releaseOrder:10,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'MEG',setTitle:'Mega Evolution',releaseOrder:11,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'PFL',setTitle:'Phantasmal Flames',releaseOrder:12,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'ASC',setTitle:'Ascended Heroes',releaseOrder:13,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'POR',setTitle:'Perfect Order',releaseOrder:14,onlineLegalDate:'2026-03-26',irlLegalDate:'2026-04-10',isRotationSet:true,rotationLowerSetCode:'TEF'},
        {setCode:'CRI',setTitle:'Chaos Rising',releaseOrder:15,onlineLegalDate:'2026-05-21',irlLegalDate:'2026-06-05',isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'PBL',setTitle:'Pitch Black',releaseOrder:16,onlineLegalDate:'2026-07-16',irlLegalDate:'2026-07-31',isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'30C',setTitle:'30th Celebration',releaseOrder:17,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null},
        {setCode:'DLR',setTitle:'Delta Reign',releaseOrder:18,onlineLegalDate:null,irlLegalDate:null,isRotationSet:false,rotationLowerSetCode:null}
      ]
    }
  };

  function freeze(value){
    if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
    Object.freeze(value);
    for(const child of Object.values(value))freeze(child);
    return value;
  }

  function dateOnly(value){
    if(typeof value!=='string'||!DATE_PATTERN.test(value))return null;
    const [year,month,day]=value.split('-').map(Number);
    const parsed=new Date(Date.UTC(year,month-1,day));
    if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)return null;
    return value;
  }

  function nullableDate(value){return value===null?null:dateOnly(value)}

  function normalizeSet(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('invalid-set');
    const setCode=typeof input.setCode==='string'?input.setCode.trim().toUpperCase():'';
    const setTitle=typeof input.setTitle==='string'?input.setTitle.trim():'';
    const releaseOrder=Number(input.releaseOrder);
    if(!CODE_PATTERN.test(setCode)||!setTitle||setTitle.length>120||!Number.isInteger(releaseOrder)||releaseOrder<1)throw new TypeError('invalid-set');
    if(input.onlineLegalDate!==null&&!dateOnly(input.onlineLegalDate))throw new TypeError('invalid-online-date');
    if(input.irlLegalDate!==null&&!dateOnly(input.irlLegalDate))throw new TypeError('invalid-irl-date');
    if(typeof input.isRotationSet!=='boolean')throw new TypeError('invalid-rotation-flag');
    const rotationLowerSetCode=input.rotationLowerSetCode===null?null:(typeof input.rotationLowerSetCode==='string'?input.rotationLowerSetCode.trim().toUpperCase():'');
    if(rotationLowerSetCode!==null&&!CODE_PATTERN.test(rotationLowerSetCode))throw new TypeError('invalid-rotation-lower-set');
    if(input.isRotationSet!==Boolean(rotationLowerSetCode))throw new TypeError('invalid-rotation-lower-set');
    return {setCode,setTitle,releaseOrder,onlineLegalDate:nullableDate(input.onlineLegalDate),irlLegalDate:nullableDate(input.irlLegalDate),isRotationSet:input.isRotationSet,rotationLowerSetCode};
  }

  function normalizeConfig(input){
    if(!input||typeof input!=='object'||Number(input.schemaVersion)!==SCHEMA_VERSION)throw new TypeError('invalid-schema-version');
    const source=input.registry;
    if(!source||typeof source!=='object'||!Number.isInteger(Number(source.versionNumber))||Number(source.versionNumber)<1||!Array.isArray(source.sets)||!source.sets.length)throw new TypeError('invalid-registry');
    const sets=source.sets.map(normalizeSet).sort((a,b)=>a.releaseOrder-b.releaseOrder);
    const codes=new Set(),orders=new Set();
    for(const set of sets){
      if(codes.has(set.setCode)||orders.has(set.releaseOrder))throw new TypeError('duplicate-set');
      codes.add(set.setCode);orders.add(set.releaseOrder);
    }
    const byCode=new Map(sets.map(set=>[set.setCode,set]));
    for(const set of sets){
      if(!set.isRotationSet)continue;
      const lower=byCode.get(set.rotationLowerSetCode);
      if(!lower||lower.releaseOrder>set.releaseOrder)throw new TypeError('invalid-rotation-lower-set');
    }
    const publishedAt=source.publishedAt==null?null:String(source.publishedAt);
    if(publishedAt!==null&&!Number.isFinite(Date.parse(publishedAt)))throw new TypeError('invalid-published-at');
    return freeze({schemaVersion:SCHEMA_VERSION,registry:{versionNumber:Number(source.versionNumber),publishedAt,sets}});
  }

  function fingerprint(input){
    const config=normalizeConfig(input);
    return JSON.stringify({schemaVersion:config.schemaVersion,versionNumber:config.registry.versionNumber,sets:config.registry.sets});
  }

  function unavailable(reason,channel,date,version){
    return freeze({available:false,formatId:null,lowerSetCode:null,upperSetCode:null,channel:channel||null,effectiveDate:null,requestedDate:date||null,registryVersion:version||null,reason});
  }

  function resolveFormat(input,options){
    let config;
    try{config=normalizeConfig(input)}catch{return unavailable('invalid-registry',options&&options.channel,options&&options.date,null)}
    const channel=options&&options.channel;
    const requested=dateOnly(options&&options.date);
    if(!Object.prototype.hasOwnProperty.call(CHANNEL_FIELDS,channel))return unavailable('invalid-channel',channel,options&&options.date,config.registry.versionNumber);
    if(!requested)return unavailable('invalid-date',channel,options&&options.date,config.registry.versionNumber);
    const field=CHANNEL_FIELDS[channel],sets=config.registry.sets;
    const firstDated=sets.find(set=>set[field]!==null);
    const baselineLimit=firstDated?firstDated.releaseOrder:Number.POSITIVE_INFINITY;
    const legal=sets.filter(set=>(set[field]===null&&set.releaseOrder<baselineLimit)||(set[field]!==null&&set[field]<=requested));
    if(!legal.length)return unavailable('no-legal-format',channel,requested,config.registry.versionNumber);
    const upper=legal[legal.length-1];
    let lower=sets[0];
    for(const set of legal){
      if(!set.isRotationSet)continue;
      const candidate=sets.find(row=>row.setCode===set.rotationLowerSetCode);
      if(candidate)lower=candidate;
    }
    if(lower.releaseOrder>upper.releaseOrder)return unavailable('no-legal-format',channel,requested,config.registry.versionNumber);
    return freeze({
      available:true,
      formatId:`${lower.setCode}-${upper.setCode}`,
      lowerSetCode:lower.setCode,
      upperSetCode:upper.setCode,
      channel,
      effectiveDate:upper[field],
      requestedDate:requested,
      registryVersion:config.registry.versionNumber,
      reason:null
    });
  }

  const prepared=normalizeConfig(PREPARED);
  return freeze({SCHEMA_VERSION,preparedConfig:()=>prepared,normalizeConfig,fingerprint,resolveFormat,dateOnly});
});
