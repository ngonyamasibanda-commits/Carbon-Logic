-- Restrict create_organization to Carbon Logic operators.
-- Paste into the Supabase SQL editor and Run.

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower((select email from auth.users where id = (select auth.uid())))
    in (
      'ngonyamasibanda@gmail.com',
      'founders@usecarbonlogic.com',
      'founders@carbonlogichq.com'
    ),
    false
  );
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_slug text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_platform_owner() then
    raise exception 'Only Carbon Logic owners can create organisations';
  end if;

  if to_regprocedure('public.consume_user_quota(text)') is not null then
    perform public.consume_user_quota('org_create');
  end if;

  v_slug := regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.organizations (name, slug, created_by)
  values (p_name, v_slug, v_user)
  returning id into v_id;

  insert into public.memberships (organization_id, user_id, role)
  values (v_id, v_user, 'owner');

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id)
  values (v_id, v_user, 'organization.created', 'organization', v_id::text);

  return v_id;
end;
$$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
