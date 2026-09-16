import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPublishedCalendar,publishedCalendarConfig} from '../scripts/load-published-calendar.mjs';

test('Meta generation can load the latest published Formats & Sets calendar',async()=>{
  let request=null;
  const registry={schemaVersion:1,revision:'synthetic-live-calendar'};
  const result=await loadPublishedCalendar({
    url:'https://example.supabase.co',
    key:'public-test-key',
    fetch:async(url,options)=>{
      request={url:String(url),options};
      return {ok:true,status:200,json:async()=>[{
        id:'calendar-live',version_number:12,status:'published',published_at:'2030-02-01T12:00:00Z',registry
      }]};
    }
  });
  const url=new URL(request.url);
  assert.equal(url.pathname,`/rest/v1/${publishedCalendarConfig.table}`);
  assert.equal(url.searchParams.get('status'),'eq.published');
  assert.equal(url.searchParams.get('order'),'version_number.desc');
  assert.equal(url.searchParams.get('limit'),'1');
  assert.equal(request.options.headers.apikey,'public-test-key');
  assert.equal(result.source,'published');
  assert.equal(result.versionNumber,12);
  assert.equal(result.publishedAt,'2030-02-01T12:00:00Z');
  assert.deepEqual(result.registry,registry);
});

test('published-calendar generation fails closed instead of silently using stale bootstrap data',async()=>{
  await assert.rejects(()=>loadPublishedCalendar({
    url:'https://example.supabase.co',key:'public-test-key',
    fetch:async()=>({ok:false,status:503,json:async()=>[]})
  }),/request failed \(503\)/);
  await assert.rejects(()=>loadPublishedCalendar({
    url:'https://example.supabase.co',key:'public-test-key',
    fetch:async()=>({ok:true,status:200,json:async()=>[]})
  }),/No published format calendar/);
});

test('all scheduled Meta generation workflows explicitly use the published calendar',()=>{
  for(const file of [
    '.github/workflows/update-meta.yml',
    '.github/workflows/update-irl-labs.yml',
    '.github/workflows/update-limitless-decks.yml'
  ]){
    const yaml=fs.readFileSync(file,'utf8');
    assert.match(yaml,/PTCG_FORMAT_SOURCE:\s*published/,file);
    assert.match(yaml,/scripts\/load-published-calendar\.mjs/,file);
  }
});
