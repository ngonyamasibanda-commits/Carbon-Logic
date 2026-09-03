-- Repair invites AND attach the founder to a real organisation.
--
-- The app shows "running locally" when memberships cannot be read, so invites
-- cannot be saved. Paste this entire file into the Supabase SQL editor and Run.
-- You should see function rows plus a Carbon Logic / owner row at the bottom.

grant execute on function public.user_org_ids() to authenticated;
grant execute on function public.user_role_in(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role) to authenticated;
grant execute on function public.visible_user_ids() to authenticated;

grant select, insert, update, delete on table public.organizations to authenticated;
grant select, insert, update, delete on table public.memberships to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.invitations to authenticated;

-- Own memberships must be readable even if user_org_ids() is mis-granted.
drop policy if exists "read memberships in your organizations" on public.memberships;
create policy "read memberships in your organizations" on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or organization_id in (select public.user_org_ids())
  );

drop policy if exists "members read their organizations" on public.organizations;
create policy "members read their organizations" on public.organizations
  for select to authenticated
  using (
    id in (select public.user_org_ids())
    or created_by = (select auth.uid())
  );

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('invite_member', 'invite_org_member', 'create_organization')
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end
$$;

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

create or replace function public.invite_member(
  p_org uuid,
  p_email text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_caller public.org_role := public.user_role_in(p_org);
  v_role public.org_role;
  v_id uuid;
  v_existing uuid;
  v_current public.org_role;
begin
  begin
    v_role := p_role::public.org_role;
  exception when invalid_text_representation then
    raise exception 'Invalid role';
  end;

  if not public.has_org_role(p_org, 'admin') then
    raise exception 'Only managers and owners can invite members';
  end if;
  if public.role_rank(v_role) > public.role_rank(v_caller) then
    raise exception 'You cannot grant a role higher than your own';
  end if;

  if to_regprocedure('public.consume_org_quota(uuid, text)') is not null then
    perform public.consume_org_quota(p_org, 'invite');
  end if;

  select p.id into v_existing
  from public.profiles p
  where lower(p.email) = lower(p_email)
  limit 1;

  if v_existing is not null then
    select role into v_current
    from public.memberships
    where organization_id = p_org and user_id = v_existing;

    if v_current is not null then
      if public.role_rank(v_current) > public.role_rank(v_caller) then
        raise exception 'You cannot change the access of someone above you';
      end if;
      if v_current = 'owner' and v_role <> 'owner' then
        if (select count(*) from public.memberships
            where organization_id = p_org and role = 'owner') <= 1 then
          raise exception 'An organization must keep at least one owner';
        end if;
      end if;
    end if;

    insert into public.memberships (organization_id, user_id, role, invited_by)
    values (p_org, v_existing, v_role, v_user)
    on conflict (organization_id, user_id) do update
      set role = excluded.role
    returning id into v_id;

    update public.invitations
    set accepted_at = now(), role = v_role
    where organization_id = p_org
      and lower(email) = lower(p_email)
      and accepted_at is null;

    insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
    values (p_org, v_user, 'member.added', 'membership', v_id::text,
            jsonb_build_object('email', lower(p_email), 'role', v_role, 'user_id', v_existing));

    return v_id;
  end if;

  insert into public.invitations (organization_id, email, role, invited_by)
  values (p_org, lower(p_email), v_role, v_user)
  on conflict (organization_id, lower(email)) do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        expires_at = now() + interval '7 days',
        accepted_at = null
  returning id into v_id;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (p_org, v_user, 'member.invited', 'invitation', v_id::text,
          jsonb_build_object('email', lower(p_email), 'role', v_role));

  return v_id;
end;
$$;

-- Unique name so leftover invite_member overloads cannot hide this from PostgREST.
create or replace function public.invite_org_member(
  p_org uuid,
  p_email text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.invite_member(p_org, p_email, p_role);
end;
$$;

revoke all on function public.invite_member(uuid, text, text) from public;
revoke all on function public.invite_org_member(uuid, text, text) from public;
revoke all on function public.create_organization(text) from public;
revoke all on function public.is_platform_owner() from public;
grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.invite_org_member(uuid, text, text) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.is_platform_owner() to authenticated;

-- Attach the signed-up founder to Carbon Logic (idempotent).
do $$
declare
  v_email text := 'ngonyamasibanda@gmail.com';
  v_org_name text := 'Carbon Logic';
  v_user uuid;
  v_org uuid;
  v_slug text := 'carbon-logic';
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise notice 'No auth user for %, skip bootstrap.', v_email;
    return;
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_user, v_email, split_part(v_email, '@', 1))
  on conflict (id) do update set email = excluded.email;

  select o.id into v_org
  from public.organizations o
  where lower(o.name) = lower(v_org_name) or o.slug = v_slug
  limit 1;

  if v_org is null then
    if exists (select 1 from public.organizations where slug = v_slug) then
      v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;
    insert into public.organizations (name, slug, created_by)
    values (v_org_name, v_slug, v_user)
    returning id into v_org;
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, v_user, 'owner')
  on conflict (organization_id, user_id) do update set role = 'owner';
end
$$;

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');

select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('invite_member', 'invite_org_member', 'create_organization')
order by 1;

select o.name as organisation, m.role::text as role, u.email
from public.memberships m
join public.organizations o on o.id = m.organization_id
join auth.users u on u.id = m.user_id
where lower(u.email) = 'ngonyamasibanda@gmail.com';
