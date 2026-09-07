begin;

-- Keep the public read path independent of the private admin allowlist. This
-- lets the invoker RPC read published rows without granting anon any access to
-- ptcg_admins.
drop policy if exists "format_registry_read_published_or_admin"
on public.ptcg_format_registry_versions;

create policy "format_registry_read_published"
on public.ptcg_format_registry_versions for select to anon, authenticated
using (status = 'published');

create policy "format_registry_admin_read_all"
on public.ptcg_format_registry_versions for select to authenticated
using (
  exists (select 1 from public.ptcg_admins a where a.user_id = (select auth.uid()))
);

commit;
