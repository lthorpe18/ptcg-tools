-- Split maintained-calendar read access by database role.
-- The previous combined anon/authenticated SELECT policy referenced ptcg_admins.
-- anon has no SELECT grant on ptcg_admins, so public REST reads failed with 42501/HTTP 401.

drop policy if exists maintained_calendar_public_read
  on public.ptcg_maintained_calendar_versions;

drop policy if exists maintained_calendar_anon_read_published
  on public.ptcg_maintained_calendar_versions;

drop policy if exists maintained_calendar_authenticated_read
  on public.ptcg_maintained_calendar_versions;

create policy maintained_calendar_anon_read_published
  on public.ptcg_maintained_calendar_versions
  for select
  to anon
  using (status = 'published');

create policy maintained_calendar_authenticated_read
  on public.ptcg_maintained_calendar_versions
  for select
  to authenticated
  using (
    status = 'published'
    or exists (
      select 1
      from public.ptcg_admins a
      where a.user_id = (select auth.uid())
    )
  );
