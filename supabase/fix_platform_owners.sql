-- Paste into the Supabase SQL editor and Run.
-- Lets the three Carbon Logic owner emails view every organisation, invite and
-- remove people in them, and delete organisations.


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

create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.memberships
  where user_id = (select auth.uid())
  union
  select id
  from public.organizations
  where public.is_platform_owner()
$$;

create or replace function public.user_role_in(org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_platform_owner() then 'owner'::public.org_role
    else (
      select role
      from public.memberships
      where user_id = (select auth.uid())
        and organization_id = org
    )
  end
$$;

create or replace function public.visible_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id
  from public.memberships m
  where m.organization_id in (select public.user_org_ids())
$$;

create or replace function public.record_audit_event(
  p_org uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_platform_owner() and not exists (
    select 1 from public.memberships
    where user_id = v_user and organization_id = p_org
  ) then
    raise exception 'Not a member of this organization';
  end if;

  insert into public.audit_log
    (organization_id, actor_id, actor_email, action, target_type, target_id, metadata)
  values (
    p_org,
    v_user,
    (select email from public.profiles where id = v_user),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.delete_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_platform_owner() then
    raise exception 'Only Carbon Logic owners can delete organisations';
  end if;

  select name into v_name from public.organizations where id = p_org;
  if v_name is null then
    raise exception 'Organisation not found';
  end if;

  insert into public.audit_log (organization_id, actor_id, actor_email, action, target_type, target_id, metadata)
  values (
    null,
    v_user,
    (select email from public.profiles where id = v_user),
    'organization.deleted',
    'organization',
    p_org::text,
    jsonb_build_object('name', v_name)
  );

  delete from public.organizations where id = p_org;
end;
$$;

revoke all on function public.is_platform_owner() from public;
revoke all on function public.user_org_ids() from public;
revoke all on function public.user_role_in(uuid) from public;
revoke all on function public.visible_user_ids() from public;
revoke all on function public.record_audit_event(uuid, text, text, text, jsonb) from public;
revoke all on function public.delete_organization(uuid) from public;

grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.user_org_ids() to authenticated;
grant execute on function public.user_role_in(uuid) to authenticated;
grant execute on function public.visible_user_ids() to authenticated;
grant execute on function public.record_audit_event(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.delete_organization(uuid) to authenticated;



notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
