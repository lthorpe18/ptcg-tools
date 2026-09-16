create table if not exists public.kanto_151_collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint kanto_151_collections_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.kanto_151_collections enable row level security;

revoke all on table public.kanto_151_collections from anon;
grant select, insert, update, delete on table public.kanto_151_collections to authenticated;

create policy "kanto_151_select_own"
on public.kanto_151_collections
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "kanto_151_insert_own"
on public.kanto_151_collections
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "kanto_151_update_own"
on public.kanto_151_collections
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "kanto_151_delete_own"
on public.kanto_151_collections
for delete
to authenticated
using ((select auth.uid()) = user_id);
