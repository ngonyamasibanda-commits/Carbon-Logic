-- Assign ngonyamasibanda@gmail.com as owner of Carbon Logic.
-- Run this in the Supabase SQL editor AFTER 0001_auth_and_tenancy.sql,
-- and AFTER that address has signed up once so a row exists in auth.users.

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
    raise exception 'No user with email %. Sign up in the app first, then run this again.', v_email;
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_user, v_email, split_part(v_email, '@', 1))
  on conflict (id) do update
    set email = excluded.email;

  select o.id into v_org
  from public.organizations o
  where lower(o.name) = lower(v_org_name)
     or o.slug = v_slug
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

  update public.emission_entries
  set organization_id = v_org, owner_id = coalesce(owner_id, v_user)
  where organization_id is null;

  insert into public.audit_log (organization_id, actor_id, actor_email, action, target_type, target_id)
  values (v_org, v_user, v_email, 'organization.bootstrapped', 'organization', v_org::text);

  raise notice 'Carbon Logic is ready. Owner % now has access.', v_email;
end
$$;
