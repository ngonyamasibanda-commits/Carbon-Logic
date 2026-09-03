-- Repair: quotas, column-level grants, tighter RLS.
--
-- Paste this into the Supabase SQL editor after 0001_auth_and_tenancy.sql
-- (and after fix_rls.sql if you used that). Idempotent.
--
-- Quotas and plan live on organisation/usage tables, never on public.profiles.
-- Clients can read their own organisation's limits. They cannot insert, update,
-- or delete those rows. Counters only move through SECURITY DEFINER functions
-- whose limits are read from org_quotas (or hardcoded for user-scoped actions).
-- Invitation writes go only through RPCs, so a direct PostgREST insert cannot
-- skip the limiter.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables. Not profiles.
-- ---------------------------------------------------------------------------

create table if not exists public.org_quotas (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  -- Display-only. Stripe/webhooks (service_role) may change this later.
  -- Authenticated clients have no UPDATE policy and no UPDATE grant.
  plan text not null default 'free',
  entries_per_hour integer not null default 2000,
  invites_per_hour integer not null default 40,
  factor_writes_per_hour integer not null default 5000,
  updated_at timestamptz not null default now(),
  constraint org_quotas_entries_nonneg check (entries_per_hour >= 0),
  constraint org_quotas_invites_nonneg check (invites_per_hour >= 0),
  constraint org_quotas_factors_nonneg check (factor_writes_per_hour >= 0)
);

create table if not exists public.usage_windows (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (organization_id, action, window_start),
  constraint usage_windows_count_nonneg check (count >= 0)
);

create table if not exists public.user_usage_windows (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start),
  constraint user_usage_windows_count_nonneg check (count >= 0)
);

comment on table public.org_quotas is
  'Per-organisation plan and numeric limits. Clients may SELECT rows for orgs they belong to. They must not UPDATE. Never store this on profiles.';
comment on table public.usage_windows is
  'Hourly counters. Incremented only by consume_org_quota. Clients cannot write.';
comment on table public.user_usage_windows is
  'Per-user counters (org creation). Not a column on profiles.';

insert into public.org_quotas (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. RLS: readable inside the tenant, never writable by the client role
-- ---------------------------------------------------------------------------

alter table public.org_quotas enable row level security;
alter table public.usage_windows enable row level security;
alter table public.user_usage_windows enable row level security;
alter table public.org_quotas force row level security;
alter table public.usage_windows force row level security;
alter table public.user_usage_windows force row level security;

drop policy if exists "members read their organisation quota" on public.org_quotas;
create policy "members read their organisation quota" on public.org_quotas
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

drop policy if exists "admins read usage windows" on public.usage_windows;
create policy "admins read usage windows" on public.usage_windows
  for select to authenticated
  using (public.has_org_role(organization_id, 'admin'));

drop policy if exists "users read their own usage" on public.user_usage_windows;
create policy "users read their own usage" on public.user_usage_windows
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Fail closed for unclaimed emission rows: no authenticated policy should expose
-- organization_id IS NULL, even if a permissive policy is added later.
drop policy if exists "entries must belong to an organisation" on public.emission_entries;
create policy "entries must belong to an organisation" on public.emission_entries
  as restrictive
  for all to authenticated
  using (organization_id is not null)
  with check (organization_id is not null);

-- ---------------------------------------------------------------------------
-- 3. Limiters. Limits are never arguments the client can pass.
-- ---------------------------------------------------------------------------

create or replace function public.consume_org_quota(p_org uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_window timestamptz := date_bin('1 hour'::interval, now(), timestamptz '2000-01-01+00');
  v_count integer;
begin
  if p_org is null then
    return;
  end if;
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_org_role(p_org, 'viewer') then
    raise exception 'Not a member of this organisation';
  end if;

  select case p_action
    when 'entry_write' then entries_per_hour
    when 'invite' then invites_per_hour
    when 'factor_write' then factor_writes_per_hour
    else null
  end
    into v_limit
  from public.org_quotas
  where organization_id = p_org;

  if v_limit is null then
    v_limit := case p_action
      when 'entry_write' then 2000
      when 'invite' then 40
      when 'factor_write' then 5000
      else 60
    end;
  end if;

  insert into public.usage_windows (organization_id, action, window_start, count)
  values (p_org, p_action, v_window, 1)
  on conflict (organization_id, action, window_start)
  do update set count = public.usage_windows.count + 1
  returning count into v_count;

  if v_count > v_limit then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;
end;
$$;

-- User-scoped limits are constants in this function. There is no table column a
-- caller can UPDATE to raise them.
create or replace function public.consume_user_quota(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit integer;
  v_window timestamptz;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_action = 'org_create' then
    v_limit := 5;
    v_window := date_trunc('day', now());
  else
    v_limit := 30;
    v_window := date_bin('1 hour'::interval, now(), timestamptz '2000-01-01+00');
  end if;

  insert into public.user_usage_windows (user_id, action, window_start, count)
  values (v_user, p_action, v_window, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.user_usage_windows.count + 1
  returning count into v_count;

  if v_count > v_limit then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;
end;
$$;

revoke all on function public.consume_org_quota(uuid, text) from public, anon, authenticated;
revoke all on function public.consume_user_quota(text) from public, anon, authenticated;

create or replace function public.ensure_org_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.org_quotas (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_ensure_quota on public.organizations;
create trigger organizations_ensure_quota
  after insert on public.organizations
  for each row execute function public.ensure_org_quota();

create or replace function public.enforce_entry_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is not null then
    perform public.consume_org_quota(new.organization_id, 'entry_write');
  end if;
  return new;
end;
$$;

drop trigger if exists emission_entries_quota on public.emission_entries;
create trigger emission_entries_quota
  before insert on public.emission_entries
  for each row execute function public.enforce_entry_quota();

create or replace function public.enforce_factor_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is not null then
    perform public.consume_org_quota(new.organization_id, 'factor_write');
  end if;
  return new;
end;
$$;

drop trigger if exists emission_factors_quota on public.emission_factors;
create trigger emission_factors_quota
  before insert or update on public.emission_factors
  for each row execute function public.enforce_factor_quota();

-- ---------------------------------------------------------------------------
-- 4. Profile/org column locks — the "is_premium on the user table" class of bug
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'Those profile fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

create or replace function public.protect_organization_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Those organisation fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_columns on public.organizations;
create trigger organizations_protect_columns
  before update on public.organizations
  for each row execute function public.protect_organization_columns();

-- Invitation writes must go through invite_member / revoke_invitation so the
-- limiter cannot be skipped with supabase.from('invitations').insert(...).
drop policy if exists "admins insert invitations" on public.invitations;
drop policy if exists "admins update invitations" on public.invitations;
drop policy if exists "admins delete invitations" on public.invitations;

-- ---------------------------------------------------------------------------
-- 5. RPCs: seed quotas, consume limits, keep the same external signatures
-- ---------------------------------------------------------------------------

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

  perform public.consume_user_quota('org_create');

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
    raise exception 'Only admins and owners can invite members';
  end if;
  if public.role_rank(v_role) > public.role_rank(v_caller) then
    raise exception 'You cannot grant a role higher than your own';
  end if;

  perform public.consume_org_quota(p_org, 'invite');

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

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

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
grant execute on function public.invite_org_member(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Privileges: authenticated may not write quota/usage, and may only patch
--    the profile/org columns the UI is allowed to change.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['org_quotas', 'usage_windows', 'user_usage_windows']
  loop
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
      execute format('grant select on table public.%I to authenticated', t);
    end if;
  end loop;
end
$$;

revoke update on table public.profiles from authenticated;
grant update (full_name, job_title, last_seen_at) on table public.profiles to authenticated;

revoke update on table public.organizations from authenticated;
grant update (
  name,
  slug,
  allowed_email_domains,
  require_mfa,
  session_idle_minutes,
  session_absolute_hours
) on table public.organizations to authenticated;

notify pgrst, 'reload schema';

commit;
-- IP rate limits. Complements org/user quotas.
--
-- Run after 0002. Idempotent.
--
-- The client cannot supply the IP: it is read from the request headers that
-- PostgREST/Kong set (cf-connecting-ip, then x-real-ip, then x-forwarded-for).
-- Counters live on ip_usage_windows, not on profiles. Limits are constants in
-- consume_ip_quota, so there is no column a user can UPDATE to raise them.
-- When no IP is present (SQL editor, tests, local PGlite), this limiter is skipped
-- and the org/user quotas still apply.

begin;

create table if not exists public.ip_usage_windows (
  ip_hash text not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, action, window_start),
  constraint ip_usage_windows_count_nonneg check (count >= 0)
);

comment on table public.ip_usage_windows is
  'Hashed client IP buckets. Written only by consume_ip_quota. Not readable by clients.';

alter table public.ip_usage_windows enable row level security;
alter table public.ip_usage_windows force row level security;

drop policy if exists "clients cannot read ip usage" on public.ip_usage_windows;
create policy "clients cannot read ip usage" on public.ip_usage_windows
  for select to authenticated
  using (false);

create or replace function public.request_ip()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  if v_headers is null then
    return null;
  end if;
  v_ip := coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)
  );
  v_ip := trim(v_ip);
  if v_ip is null or v_ip = '' then
    return null;
  end if;
  return v_ip;
end;
$$;

create or replace function public.consume_ip_quota()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text := public.request_ip();
  v_hash text;
  v_minute timestamptz;
  v_hour timestamptz;
  v_count integer;
  -- Hardcoded. Not a table column. Per-user/org limits remain on org_quotas /
  -- user_usage_windows, which clients cannot UPDATE.
  v_per_minute constant integer := 90;
  v_per_hour constant integer := 2000;
begin
  if v_ip is null then
    return;
  end if;

  v_hash := md5(v_ip);
  v_minute := date_bin('1 minute'::interval, now(), timestamptz '2000-01-01+00');
  v_hour := date_bin('1 hour'::interval, now(), timestamptz '2000-01-01+00');

  insert into public.ip_usage_windows (ip_hash, action, window_start, count)
  values (v_hash, 'write_minute', v_minute, 1)
  on conflict (ip_hash, action, window_start)
  do update set count = public.ip_usage_windows.count + 1
  returning count into v_count;
  if v_count > v_per_minute then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;

  insert into public.ip_usage_windows (ip_hash, action, window_start, count)
  values (v_hash, 'write_hour', v_hour, 1)
  on conflict (ip_hash, action, window_start)
  do update set count = public.ip_usage_windows.count + 1
  returning count into v_count;
  if v_count > v_per_hour then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;
end;
$$;

revoke all on function public.request_ip() from public, anon, authenticated;
revoke all on function public.consume_ip_quota() from public, anon, authenticated;

create or replace function public.consume_org_quota(p_org uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_window timestamptz := date_bin('1 hour'::interval, now(), timestamptz '2000-01-01+00');
  v_count integer;
begin
  if p_org is null then
    return;
  end if;
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_org_role(p_org, 'viewer') then
    raise exception 'Not a member of this organisation';
  end if;

  perform public.consume_ip_quota();

  select case p_action
    when 'entry_write' then entries_per_hour
    when 'invite' then invites_per_hour
    when 'factor_write' then factor_writes_per_hour
    else null
  end
    into v_limit
  from public.org_quotas
  where organization_id = p_org;

  if v_limit is null then
    v_limit := case p_action
      when 'entry_write' then 2000
      when 'invite' then 40
      when 'factor_write' then 5000
      else 60
    end;
  end if;

  insert into public.usage_windows (organization_id, action, window_start, count)
  values (p_org, p_action, v_window, 1)
  on conflict (organization_id, action, window_start)
  do update set count = public.usage_windows.count + 1
  returning count into v_count;

  if v_count > v_limit then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;
end;
$$;

create or replace function public.consume_user_quota(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit integer;
  v_window timestamptz;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  perform public.consume_ip_quota();

  if p_action = 'org_create' then
    v_limit := 5;
    v_window := date_trunc('day', now());
  else
    v_limit := 30;
    v_window := date_bin('1 hour'::interval, now(), timestamptz '2000-01-01+00');
  end if;

  insert into public.user_usage_windows (user_id, action, window_start, count)
  values (v_user, p_action, v_window, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.user_usage_windows.count + 1
  returning count into v_count;

  if v_count > v_limit then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;
end;
$$;

do $$
begin
  revoke all on table public.ip_usage_windows from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.ip_usage_windows from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke insert, update, delete, truncate on table public.ip_usage_windows from authenticated;
    grant select on table public.ip_usage_windows to authenticated;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
