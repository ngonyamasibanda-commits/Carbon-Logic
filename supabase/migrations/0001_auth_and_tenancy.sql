-- Carbon Logic — authentication, multi-tenancy and access control.
--
-- Run this once in the Supabase SQL editor. It is idempotent, so re-running is safe.
--
-- Authorization is enforced here rather than in the browser. The React app holds an
-- anon key that anyone can read from the bundle, so every rule that matters is a Row
-- Level Security policy or a SECURITY DEFINER function. Client-side guards are UX only.

begin;

-- ---------------------------------------------------------------------------
-- 1. Core tenancy tables
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('owner', 'admin', 'editor', 'viewer');
  end if;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- Only these email domains may join without an explicit invitation.
  allowed_email_domains text[] not null default '{}',
  require_mfa boolean not null default false,
  session_idle_minutes integer not null default 30,
  session_absolute_hours integer not null default 12,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  job_title text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists invitations_org_email_idx
  on public.invitations (organization_id, lower(email));

-- Append-only trail. No update or delete policy is granted to clients.
create table if not exists public.audit_log (
  id bigserial primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx
  on public.audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Membership helpers
--
-- These are SECURITY DEFINER so that reading memberships from inside a policy on
-- memberships does not re-enter that policy (Postgres error 42P17, infinite
-- recursion). search_path is pinned to '' and every name is schema-qualified,
-- which closes the search-path hijack hole that SECURITY DEFINER otherwise opens.
-- ---------------------------------------------------------------------------

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
$$;

create or replace function public.user_role_in(org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.memberships
  where user_id = (select auth.uid())
    and organization_id = org
$$;

create or replace function public.role_rank(r public.org_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
    else 0
  end
$$;

create or replace function public.has_org_role(org uuid, minimum public.org_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.role_rank(public.user_role_in(org)) >= public.role_rank(minimum),
    false
  )
$$;

-- Everyone who shares at least one organization with the caller.
create or replace function public.visible_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id
  from public.memberships m
  where m.organization_id in (
    select organization_id
    from public.memberships
    where user_id = (select auth.uid())
  )
$$;

revoke all on function public.user_org_ids() from public;
revoke all on function public.user_role_in(uuid) from public;
revoke all on function public.has_org_role(uuid, public.org_role) from public;
revoke all on function public.visible_user_ids() from public;

grant execute on function public.user_org_ids() to authenticated;
grant execute on function public.user_role_in(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role) to authenticated;
grant execute on function public.visible_user_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Provisioning: profile creation and invitation redemption on sign-up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- Redeem any outstanding invitation for this address.
  insert into public.memberships (organization_id, user_id, role, invited_by)
  select i.organization_id, new.id, i.role, i.invited_by
  from public.invitations i
  where lower(i.email) = lower(new.email)
    and i.accepted_at is null
    and i.expires_at > now()
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now();

  -- Domain-based joining, for organizations that opted into it.
  insert into public.memberships (organization_id, user_id, role)
  select o.id, new.id, 'viewer'
  from public.organizations o
  where split_part(new.email, '@', 2) = any (o.allowed_email_domains)
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Privileged membership operations
--
-- Membership writes never go through RLS directly. A policy can check who you are
-- but expressing "you may not grant a role above your own" and "the last owner may
-- not be removed" is far clearer as a function.
-- ---------------------------------------------------------------------------

-- Only these Carbon Logic operators may create organisations. Tenant owners
-- manage people inside an org they already belong to; they cannot spin up more.
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

  v_slug := regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  -- Keep slugs unique without failing the caller.
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

-- Role arguments are text (not org_role) so PostgREST can match the RPC from JSON.
drop function if exists public.invite_member(uuid, text, public.org_role);
drop function if exists public.invite_member(uuid, text, text);

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
    raise exception 'Only admins and owners can invite members';
  end if;
  -- No privilege escalation: you cannot hand out a role above your own.
  if public.role_rank(v_role) > public.role_rank(v_caller) then
    raise exception 'You cannot grant a role higher than your own';
  end if;

  -- If they already have an account, grant access now instead of waiting for sign-up.
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

drop function if exists public.set_member_role(uuid, public.org_role);
drop function if exists public.set_member_role(uuid, text);

create or replace function public.set_member_role(
  p_membership uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_target_user uuid;
  v_target_role public.org_role;
  v_caller public.org_role;
  v_role public.org_role;
begin
  begin
    v_role := p_role::public.org_role;
  exception when invalid_text_representation then
    raise exception 'Invalid role';
  end;

  select organization_id, user_id, role
    into v_org, v_target_user, v_target_role
  from public.memberships where id = p_membership;

  if v_org is null then
    raise exception 'Membership not found';
  end if;

  v_caller := public.user_role_in(v_org);

  if not public.has_org_role(v_org, 'admin') then
    raise exception 'Only admins and owners can change roles';
  end if;
  if public.role_rank(v_role) > public.role_rank(v_caller) then
    raise exception 'You cannot grant a role higher than your own';
  end if;
  if public.role_rank(v_target_role) > public.role_rank(v_caller) then
    raise exception 'You cannot change the role of someone above you';
  end if;
  -- An organization must always retain at least one owner.
  if v_target_role = 'owner' and v_role <> 'owner' then
    if (select count(*) from public.memberships
        where organization_id = v_org and role = 'owner') <= 1 then
      raise exception 'An organization must keep at least one owner';
    end if;
  end if;

  update public.memberships set role = v_role where id = p_membership;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, v_user, 'member.role_changed', 'membership', p_membership::text,
          jsonb_build_object('from', v_target_role, 'to', v_role, 'user_id', v_target_user));
end;
$$;

create or replace function public.remove_member(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_target_user uuid;
  v_target_role public.org_role;
  v_caller public.org_role;
begin
  select organization_id, user_id, role
    into v_org, v_target_user, v_target_role
  from public.memberships where id = p_membership;

  if v_org is null then
    raise exception 'Membership not found';
  end if;

  v_caller := public.user_role_in(v_org);

  -- Leaving on your own account is always allowed; removing someone else is not.
  if v_target_user <> v_user then
    if not public.has_org_role(v_org, 'admin') then
      raise exception 'Only admins and owners can remove members';
    end if;
    if public.role_rank(v_target_role) > public.role_rank(v_caller) then
      raise exception 'You cannot remove someone above you';
    end if;
  end if;

  if v_target_role = 'owner' then
    if (select count(*) from public.memberships
        where organization_id = v_org and role = 'owner') <= 1 then
      raise exception 'An organization must keep at least one owner';
    end if;
  end if;

  delete from public.memberships where id = p_membership;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, v_user, 'member.removed', 'membership', p_membership::text,
          jsonb_build_object('user_id', v_target_user, 'role', v_target_role));
end;
$$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_email text;
  v_role public.org_role;
begin
  select organization_id, email, role
    into v_org, v_email, v_role
  from public.invitations
  where id = p_invitation;

  if v_org is null then
    raise exception 'Invitation not found';
  end if;
  if not public.has_org_role(v_org, 'admin') then
    raise exception 'Only managers and owners can revoke invitations';
  end if;

  delete from public.invitations where id = p_invitation;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, v_user, 'member.invite_revoked', 'invitation', p_invitation::text,
          jsonb_build_object('email', v_email, 'role', v_role));
end;
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
  if v_user is null or not exists (
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

revoke all on function public.create_organization(text) from public;
revoke all on function public.is_platform_owner() from public;
revoke all on function public.invite_member(uuid, text, text) from public;
revoke all on function public.set_member_role(uuid, text) from public;
revoke all on function public.remove_member(uuid) from public;
revoke all on function public.record_audit_event(uuid, text, text, text, jsonb) from public;

revoke all on function public.revoke_invitation(uuid) from public;

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

revoke all on function public.invite_org_member(uuid, text, text) from public;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.invite_org_member(uuid, text, text) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.record_audit_event(uuid, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.memberships force row level security;
alter table public.invitations force row level security;
alter table public.audit_log force row level security;

drop policy if exists "members read their organizations" on public.organizations;
create policy "members read their organizations" on public.organizations
  for select to authenticated
  using (id in (select public.user_org_ids()));

drop policy if exists "owners update their organization" on public.organizations;
create policy "owners update their organization" on public.organizations
  for update to authenticated
  using (public.has_org_role(id, 'owner'))
  with check (public.has_org_role(id, 'owner'));

drop policy if exists "read own and colleague profiles" on public.profiles;
create policy "read own and colleague profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or id in (select public.visible_user_ids()));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Memberships are readable by colleagues but only writable through the functions above.
drop policy if exists "read memberships in your organizations" on public.memberships;
create policy "read memberships in your organizations" on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or organization_id in (select public.user_org_ids())
  );

drop policy if exists "admins read invitations" on public.invitations;
create policy "admins read invitations" on public.invitations
  for select to authenticated
  using (public.has_org_role(organization_id, 'admin'));

drop policy if exists "admins insert invitations" on public.invitations;
create policy "admins insert invitations" on public.invitations
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, 'admin')
    and public.role_rank(role) <= public.role_rank(public.user_role_in(organization_id))
  );

drop policy if exists "admins update invitations" on public.invitations;
create policy "admins update invitations" on public.invitations
  for update to authenticated
  using (public.has_org_role(organization_id, 'admin'))
  with check (
    public.has_org_role(organization_id, 'admin')
    and public.role_rank(role) <= public.role_rank(public.user_role_in(organization_id))
  );

drop policy if exists "admins delete invitations" on public.invitations;
create policy "admins delete invitations" on public.invitations
  for delete to authenticated
  using (public.has_org_role(organization_id, 'admin'));

drop policy if exists "admins read the audit log" on public.audit_log;
create policy "admins read the audit log" on public.audit_log
  for select to authenticated
  using (public.has_org_role(organization_id, 'admin'));

-- ---------------------------------------------------------------------------
-- 6. Move emission data off the shared 'default_user' identity
-- ---------------------------------------------------------------------------

alter table public.emission_entries
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade,
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

create index if not exists emission_entries_org_idx
  on public.emission_entries (organization_id, created_at desc);

-- user_id only ever held the literal 'default_user', so once organization_id and
-- owner_id exist it carries no information. Drop it only if that is still true.
do $$
declare
  v_has_other_owners boolean;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  ) then
    -- EXECUTE keeps the reference to user_id from being planned on a later run,
    -- once the column no longer exists.
    execute $q$
      select exists (
        select 1 from public.emission_entries where user_id is distinct from 'default_user'
      )
    $q$ into v_has_other_owners;

    if not v_has_other_owners then
      alter table public.emission_entries drop column user_id;
    end if;
  end if;
end
$$;

alter table public.emission_factors
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

-- activity_type was globally unique, which would stop two organizations holding
-- different values for the same factor. Scope uniqueness to the organization, and
-- treat NULL (the shared published catalogue) as a single tenant rather than as many
-- distinct rows.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'emission_factors_activity_type_key'
      and conrelid = 'public.emission_factors'::regclass
  ) then
    alter table public.emission_factors drop constraint emission_factors_activity_type_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'emission_factors_activity_org_key'
      and conrelid = 'public.emission_factors'::regclass
  ) then
    alter table public.emission_factors
      add constraint emission_factors_activity_org_key
      unique nulls not distinct (activity_type, organization_id);
  end if;
end
$$;

-- Remove the open anon policies that let anyone with the bundled key read and write
-- every row. Names come from the original supabase_schema.sql plus common variants.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('emission_entries', 'emission_factors')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end
$$;

drop policy if exists "Allow anon read emission_entries" on public.emission_entries;
drop policy if exists "Allow anon insert emission_entries" on public.emission_entries;
drop policy if exists "Allow anon delete emission_entries" on public.emission_entries;
drop policy if exists "Allow anon update emission_entries" on public.emission_entries;
drop policy if exists "Allow anon read emission_factors" on public.emission_factors;
drop policy if exists "Allow anon insert emission_factors" on public.emission_factors;
drop policy if exists "Allow anon update emission_factors" on public.emission_factors;
drop policy if exists "Allow anon delete emission_factors" on public.emission_factors;

alter table public.emission_entries enable row level security;
alter table public.emission_factors enable row level security;
alter table public.emission_entries force row level security;
alter table public.emission_factors force row level security;

drop policy if exists "read entries in your organizations" on public.emission_entries;
create policy "read entries in your organizations" on public.emission_entries
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

drop policy if exists "editors create entries" on public.emission_entries;
create policy "editors create entries" on public.emission_entries
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, 'editor')
    and owner_id = (select auth.uid())
  );

drop policy if exists "editors update entries" on public.emission_entries;
create policy "editors update entries" on public.emission_entries
  for update to authenticated
  using (public.has_org_role(organization_id, 'editor'))
  with check (public.has_org_role(organization_id, 'editor'));

drop policy if exists "editors delete entries" on public.emission_entries;
create policy "editors delete entries" on public.emission_entries
  for delete to authenticated
  using (public.has_org_role(organization_id, 'editor'));

-- Factors with a null organization are the shared published catalogue.
drop policy if exists "read shared and own factors" on public.emission_factors;
create policy "read shared and own factors" on public.emission_factors
  for select to authenticated
  using (
    organization_id is null
    or organization_id in (select public.user_org_ids())
  );

-- Replaces the old FOR ALL policy so SELECT is not duplicated and writes stay
-- scoped to organisation-owned rows (never the shared catalogue).
drop policy if exists "admins write own factors" on public.emission_factors;
drop policy if exists "admins insert own factors" on public.emission_factors;
create policy "admins insert own factors" on public.emission_factors
  for insert to authenticated
  with check (organization_id is not null and public.has_org_role(organization_id, 'admin'));

drop policy if exists "admins update own factors" on public.emission_factors;
create policy "admins update own factors" on public.emission_factors
  for update to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, 'admin'))
  with check (organization_id is not null and public.has_org_role(organization_id, 'admin'));

drop policy if exists "admins delete own factors" on public.emission_factors;
create policy "admins delete own factors" on public.emission_factors
  for delete to authenticated
  using (organization_id is not null and public.has_org_role(organization_id, 'admin'));

-- The publishable key is in the browser bundle. Table grants to anon are a
-- second lock besides RLS: even a leftover USING (true) policy cannot be used
-- if anon cannot SELECT/INSERT the table.
do $$
declare
  t text;
  seq text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'memberships', 'invitations',
    'audit_log', 'emission_entries', 'emission_factors'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        t
      );
    end if;
  end loop;

  foreach seq in array array[
    'audit_log_id_seq', 'emission_entries_id_seq', 'emission_factors_id_seq'
  ]
  loop
    if to_regclass('public.' || seq) is null then
      continue;
    end if;
    execute format('revoke all on sequence public.%I from public', seq);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on sequence public.%I from anon', seq);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant usage, select on sequence public.%I to authenticated', seq);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    alter default privileges in schema public revoke all on tables from anon;
    alter default privileges in schema public revoke all on sequences from anon;
  end if;
end
$$;

-- Make PostgREST pick up new/changed RPCs without restarting the API.
notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------------------------
-- 7. One-time bootstrap — RUN THIS SEPARATELY
--
-- Do this AFTER the first person has signed up through the app, because it needs a
-- row in auth.users to attach ownership to. Replace the email, then run the block.
-- It creates the organization, makes that user the owner, and hands over every
-- legacy row that was previously filed under 'default_user'.
-- ---------------------------------------------------------------------------

-- do $$
-- declare
--   v_email text := 'you@yourcompany.com';   -- <<< change this
--   v_org_name text := 'Carbon Logic';        -- <<< and this
--   v_user uuid;
--   v_org uuid;
-- begin
--   select id into v_user from auth.users where lower(email) = lower(v_email);
--   if v_user is null then
--     raise exception 'No user with email %. Sign up in the app first.', v_email;
--   end if;
--
--   select o.id into v_org from public.organizations o where o.name = v_org_name;
--   if v_org is null then
--     insert into public.organizations (name, slug, created_by)
--     values (v_org_name, regexp_replace(lower(v_org_name), '[^a-z0-9]+', '-', 'g'), v_user)
--     returning id into v_org;
--   end if;
--
--   insert into public.memberships (organization_id, user_id, role)
--   values (v_org, v_user, 'owner')
--   on conflict (organization_id, user_id) do update set role = 'owner';
--
--   update public.emission_entries
--   set organization_id = v_org, owner_id = coalesce(owner_id, v_user)
--   where organization_id is null;
--
--   raise notice 'Organization % ready, owner %, % legacy entries claimed.',
--     v_org, v_email, (select count(*) from public.emission_entries where organization_id = v_org);
-- end
-- $$;
