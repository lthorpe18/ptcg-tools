const DEFAULT_SUPABASE_URL='https://naylqcyrnhjvqodjpjsg.supabase.co';
const DEFAULT_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5heWxxY3lybmhqdnFvZGpwanNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTQxNzQsImV4cCI6MjEwMzgzMDE3NH0.DAaeax-UngOhcGn7oINpo-dP0HefGexeaPgEYItUmuQ';
const TABLE='ptcg_maintained_calendar_versions';

const clone=value=>JSON.parse(JSON.stringify(value));

export async function loadPublishedCalendar(options={}) {
  const fetcher=options.fetch||globalThis.fetch;
  const base=options.url||process.env.PTCG_SUPABASE_URL||DEFAULT_SUPABASE_URL;
  const key=options.key||process.env.PTCG_SUPABASE_ANON_KEY||DEFAULT_ANON_KEY;
  if(typeof fetcher!=='function')throw new Error('Published format calendar requires fetch');
  if(!base||!key)throw new Error('Published format calendar endpoint is not configured');

  const url=new URL(`/rest/v1/${TABLE}`,base);
  url.searchParams.set('select','id,version_number,status,registry,published_at');
  url.searchParams.set('status','eq.published');
  url.searchParams.set('order','version_number.desc');
  url.searchParams.set('limit','1');

  const response=await fetcher(url,{headers:{
    apikey:key,
    Authorization:`Bearer ${key}`,
    accept:'application/json'
  }});
  if(!response?.ok)throw new Error(`Published format calendar request failed${response?` (${response.status})`:''}`);
  const rows=await response.json();
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row?.registry)throw new Error('No published format calendar is available');
  return {
    source:'published',
    id:row.id||null,
    versionNumber:Number(row.version_number||0)||null,
    publishedAt:row.published_at||null,
    registry:clone(row.registry),
  };
}

export const publishedCalendarConfig=Object.freeze({table:TABLE,url:DEFAULT_SUPABASE_URL,auth:'anon-jwt'});
