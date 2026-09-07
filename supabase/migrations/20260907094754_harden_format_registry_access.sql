begin;

-- The failed rollout inherited broad table defaults. RLS protects row
-- operations, but it does not apply to TRUNCATE, so remove every browser-role
-- privilege and re-grant only the operations used by the application.
revoke all on table
  public.ptcg_admins,
  public.ptcg_format_registry_versions,
  public.ptcg_blended_formula_versions,
  public.ptcg_blended_live_formula,
  public.ptcg_blended_formula_activations,
  public.ptcg_blended_review_state
from public, anon, authenticated;

revoke all on sequence public.ptcg_blended_formula_activations_id_seq
from public, anon, authenticated;

grant select on table public.ptcg_admins to authenticated;
grant select, insert, update on table public.ptcg_format_registry_versions to authenticated;
grant select, insert, update on table public.ptcg_blended_formula_versions to authenticated;
grant select, insert, update on table public.ptcg_blended_live_formula to authenticated;
grant select, insert on table public.ptcg_blended_formula_activations to authenticated;
grant select, insert, update, delete on table public.ptcg_blended_review_state to authenticated;
grant usage on sequence public.ptcg_blended_formula_activations_id_seq to authenticated;

-- PostgreSQL grants function execution to PUBLIC by default. Admin RPCs remain
-- callable only by signed-in users and still verify the database allowlist.
revoke all on function public.publish_format_registry(uuid) from public, anon;
revoke all on function public.publish_blended_formula(uuid) from public, anon;
revoke all on function public.activate_blended_formula(uuid) from public, anon;
grant execute on function public.publish_format_registry(uuid) to authenticated, service_role;
grant execute on function public.publish_blended_formula(uuid) to authenticated, service_role;
grant execute on function public.activate_blended_formula(uuid) to authenticated, service_role;

create or replace function public.ptcg_format_sets_valid(p_sets jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  item jsonb;
  other jsonb;
  code text;
  lower_code text;
  date_text text;
  item_order integer;
  lower_order integer;
  codes text[] := array[]::text[];
  orders integer[] := array[]::integer[];
begin
  if pg_catalog.jsonb_typeof(p_sets) <> 'array' or pg_catalog.jsonb_array_length(p_sets) = 0 then
    return false;
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p_sets)
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
      or not (item ?& array['setCode','setTitle','releaseOrder','onlineLegalDate','irlLegalDate','isRotationSet','rotationLowerSetCode'])
      or pg_catalog.jsonb_typeof(item->'setCode') <> 'string'
      or pg_catalog.jsonb_typeof(item->'setTitle') <> 'string'
      or pg_catalog.jsonb_typeof(item->'releaseOrder') <> 'number'
      or pg_catalog.jsonb_typeof(item->'isRotationSet') <> 'boolean'
    then return false;
    end if;

    code := item->>'setCode';
    if code !~ '^[A-Z0-9]{2,5}$' or pg_catalog.length(pg_catalog.btrim(item->>'setTitle')) = 0
      or (item->>'releaseOrder') !~ '^[1-9][0-9]*$'
    then return false;
    end if;
    item_order := (item->>'releaseOrder')::integer;
    if code = any(codes) or item_order = any(orders) then return false; end if;
    codes := pg_catalog.array_append(codes,code);
    orders := pg_catalog.array_append(orders,item_order);

    foreach lower_code in array array['onlineLegalDate','irlLegalDate']
    loop
      if item->lower_code <> 'null'::jsonb then
        if pg_catalog.jsonb_typeof(item->lower_code) <> 'string' then return false; end if;
        date_text := item->>lower_code;
        if date_text !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
        perform date_text::date;
      end if;
    end loop;

    if (item->>'isRotationSet')::boolean then
      if item->'rotationLowerSetCode' = 'null'::jsonb
        or pg_catalog.jsonb_typeof(item->'rotationLowerSetCode') <> 'string'
        or (item->>'rotationLowerSetCode') !~ '^[A-Z0-9]{2,5}$'
      then return false;
      end if;
    elsif item->'rotationLowerSetCode' <> 'null'::jsonb then
      return false;
    end if;
  end loop;

  for item in select value from pg_catalog.jsonb_array_elements(p_sets)
  loop
    if (item->>'isRotationSet')::boolean then
      lower_code := item->>'rotationLowerSetCode';
      lower_order := null;
      for other in select value from pg_catalog.jsonb_array_elements(p_sets)
      loop
        if other->>'setCode' = lower_code then lower_order := (other->>'releaseOrder')::integer; exit; end if;
      end loop;
      if lower_order is null or lower_order > (item->>'releaseOrder')::integer then return false; end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.ptcg_format_sets_valid(jsonb) from public, anon, authenticated;

alter table public.ptcg_format_registry_versions
  add constraint ptcg_format_registry_versions_sets_shape_check
  check (public.ptcg_format_sets_valid(sets));

drop policy if exists "format_registry_admin_update_draft" on public.ptcg_format_registry_versions;
create policy "format_registry_admin_update_draft"
on public.ptcg_format_registry_versions for update to authenticated
using (
  status = 'draft'
  and exists (select 1 from public.ptcg_admins a where a.user_id = (select auth.uid()))
)
with check (
  status = 'draft'
  and exists (select 1 from public.ptcg_admins a where a.user_id = (select auth.uid()))
);

create or replace function public.ptcg_protect_published_format_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'Published format registry versions are immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.ptcg_protect_published_format_version() from public, anon, authenticated;

create trigger ptcg_format_registry_versions_immutable
before update or delete on public.ptcg_format_registry_versions
for each row execute function public.ptcg_protect_published_format_version();

create or replace function public.publish_format_registry(p_version_id uuid)
returns public.ptcg_format_registry_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.ptcg_format_registry_versions;
begin
  if v_user is null or not exists (
    select 1 from public.ptcg_admins where user_id = v_user
  ) then raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.ptcg_format_registry_versions
  set status = 'published', published_at = pg_catalog.now()
  where id = p_version_id and status = 'draft'
  returning * into v_row;
  if v_row.id is null then raise exception 'Draft format registry not found'; end if;
  return v_row;
end;
$$;

revoke all on function public.publish_format_registry(uuid) from public, anon;
grant execute on function public.publish_format_registry(uuid) to authenticated, service_role;

create or replace function public.get_ptcg_format_registry()
returns jsonb
language sql
stable
security definer
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

commit;
