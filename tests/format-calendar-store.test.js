const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const store=require('../v2-preview/apps/_shared/format-calendar-store.js');
const format=require('../v2-preview/apps/_shared/format-resolver.js');
const fallback=JSON.parse(fs.readFileSync('data/formats/maintained-calendar.json','utf8'));

function memoryStorage(seed={}){
  const values=new Map(Object.entries(seed));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    dump:()=>Object.fromEntries(values)
  };
}

function publishedClient(row,{user={id:'admin-1'}}={}){
  return {
    auth:{getUser:async()=>({data:{user},error:null})},
    from(table){
      assert.equal(table,store.TABLE);
      return {
        select(){return this},eq(){return this},order(){return this},limit(){return this},
        maybeSingle:async()=>({data:row,error:null})
      };
    }
  };
}

function failingClient(){
  return {
    from(){return {select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle:async()=>({data:null,error:new Error('offline')})}}
  };
}

function clone(value){return JSON.parse(JSON.stringify(value))}

const remoteRow={
  id:'calendar-v1',version_number:1,status:'published',registry:fallback,
  notes:'bootstrap',created_at:'2026-09-13T09:45:00Z',published_at:'2026-09-13T09:45:00Z'
};

test('published shared calendar is validated, preferred and cached as last-known-good',async()=>{
  const storage=memoryStorage();
  const result=await store.load({client:publishedClient(remoteRow),storage,format});
  assert.equal(result.source,'shared');
  assert.equal(result.registry.revision,fallback.revision);
  const cached=JSON.parse(storage.getItem(store.LKG_KEY));
  assert.equal(cached.versionNumber,1);
  assert.equal(cached.registry.revision,fallback.revision);
});

test('remote failure uses a previously validated last-known-good calendar',async()=>{
  const storage=memoryStorage();
  store._writeLkg(storage,remoteRow,format);
  const result=await store.load({client:failingClient(),storage,format,fetch:async()=>{throw new Error('fallback should not be needed')}});
  assert.equal(result.source,'lkg');
  assert.equal(result.registry.revision,fallback.revision);
  assert.match(result.remoteError.message,/offline/);
});

test('without remote or LKG the checked-in calendar is the bootstrap fallback',async()=>{
  const storage=memoryStorage();
  let requested='';
  const result=await store.load({
    client:null,storage,format,fallbackUrl:'calendar.json',
    fetch:async url=>{requested=String(url);return {ok:true,status:200,json:async()=>clone(fallback)}}
  });
  assert.equal(requested,'calendar.json');
  assert.equal(result.source,'fallback');
  assert.equal(result.registry.sets[0].legality.online.value,'2026-09-15');
  assert.equal(result.registry.sets[0].legality.irl.value,'2026-09-24');
  assert.ok(storage.getItem(store.LKG_KEY));
});

test('an invalid shared row cannot replace a valid LKG',async()=>{
  const storage=memoryStorage();
  store._writeLkg(storage,remoteRow,format);
  const invalid=clone(remoteRow);
  invalid.registry.sets[0].legality.online.value='not-a-date';
  const result=await store.load({client:publishedClient(invalid),storage,format});
  assert.equal(result.source,'lkg');
  assert.equal(result.registry.sets[0].legality.online.value,'2026-09-15');
  assert.ok(result.remoteError instanceof Error);
});

test('draft writes validate the full maintained registry before touching shared persistence',async()=>{
  let writes=0;
  const client={
    auth:{getUser:async()=>({data:{user:{id:'admin-1'}},error:null})},
    from(){writes++;throw new Error('invalid registry must fail before DB write')}
  };
  const invalid=clone(fallback);
  invalid.schemaVersion=99;
  await assert.rejects(()=>store.createDraft(invalid,'bad',{client,format}),/Unsupported schemaVersion/);
  assert.equal(writes,0);
});

test('admin draft creation stores the canonical registry as a draft owned by the signed-in maintainer',async()=>{
  let inserted=null;
  const client={
    auth:{getUser:async()=>({data:{user:{id:'admin-1'}},error:null})},
    from(table){
      assert.equal(table,store.TABLE);
      return {
        insert(value){inserted=value;return this},select(){return this},
        single:async()=>({data:{id:'draft-1',version_number:2,...inserted,created_at:'2026-09-13T10:00:00Z',published_at:null},error:null})
      };
    }
  };
  const row=await store.createDraft(fallback,'next calendar',{client,format});
  assert.equal(inserted.status,'draft');
  assert.equal(inserted.created_by,'admin-1');
  assert.equal(inserted.registry.revision,fallback.revision);
  assert.equal(row.status,'draft');
});

test('publish uses the controlled RPC and promotes the returned registry into LKG',async()=>{
  const storage=memoryStorage();
  let call=null;
  const client={
    rpc:async(name,args)=>{
      call={name,args};
      return {data:{...remoteRow,id:'draft-1',version_number:3,published_at:'2026-09-13T10:05:00Z'},error:null};
    }
  };
  const row=await store.publish('draft-1',{client,storage,format});
  assert.deepEqual(call,{name:store.PUBLISH_RPC,args:{p_id:'draft-1'}});
  assert.equal(row.version_number,3);
  assert.equal(JSON.parse(storage.getItem(store.LKG_KEY)).versionNumber,3);
});
