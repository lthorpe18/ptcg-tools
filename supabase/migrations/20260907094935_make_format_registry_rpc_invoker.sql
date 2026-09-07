begin;

-- Allow the public read RPC to run as its caller without exposing creator IDs,
-- notes, primary keys or draft rows. RLS still limits anon to published rows.
grant select (version_number, status, sets, published_at)
on table public.ptcg_format_registry_versions to anon;

create or replace function public.get_ptcg_format_registry()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'registry', pg_catalog.jsonb_build_object(
      'versionNumber', r.version_number,
      'publishedAt', r.published_at,
      'sets', r.sets
    )
  )
  from public.ptcg_format_registry_versions r
  where r.status = 'published'
  order by r.version_number desc
  limit 1
$$;

revoke all on function public.get_ptcg_format_registry() from public;
grant execute on function public.get_ptcg_format_registry() to anon, authenticated, service_role;

create index if not exists ptcg_format_registry_versions_created_by_idx
on public.ptcg_format_registry_versions (created_by);

commit;
