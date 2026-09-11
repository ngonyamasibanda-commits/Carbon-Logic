-- Carbon Logic — SaaS cloud workspace.
--
-- Moves facilities, organisation settings, and inventory extras out of the
-- browser. Raises write limits so a paying company can log a year of activity
-- and invite its staff without hitting a storage or hourly cap. Idempotent.

begin;

do $$
begin
  if to_regclass('public.org_quotas') is null
     or to_regclass('public.usage_windows') is null then
    raise exception
      'Quota tables are missing (public.org_quotas). This file is only migration 0006. Paste supabase/fix_live_database.sql to apply 0002–0006, or run 0002_quotas_and_hardening.sql first.';
  end if;
  if to_regclass('public.ip_usage_windows') is null then
    raise exception
      'public.ip_usage_windows is missing. Run supabase/migrations/0003_ip_rate_limits.sql or supabase/fix_live_database.sql before this file.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Inventory columns that used to live only in localStorage
-- ---------------------------------------------------------------------------

alter table public.emission_entries
  add column if not exists site text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists activity_date date not null default current_date;

update public.emission_entries
set activity_date = coalesce((created_at at time zone 'utc')::date, current_date)
where created_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Facilities (sites) — organisation-owned, shared by every member
-- ---------------------------------------------------------------------------

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type text not null default 'office',
  region text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists sites_org_idx on public.sites (organization_id);

alter table public.sites enable row level security;
alter table public.sites force row level security;

drop policy if exists "members read sites" on public.sites;
create policy "members read sites" on public.sites
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

drop policy if exists "editors insert sites" on public.sites;
create policy "editors insert sites" on public.sites
  for insert to authenticated
  with check (public.has_org_role(organization_id, 'editor'));

drop policy if exists "editors update sites" on public.sites;
create policy "editors update sites" on public.sites
  for update to authenticated
  using (public.has_org_role(organization_id, 'editor'))
  with check (public.has_org_role(organization_id, 'editor'));

drop policy if exists "editors delete sites" on public.sites;
create policy "editors delete sites" on public.sites
  for delete to authenticated
  using (public.has_org_role(organization_id, 'editor'));

-- ---------------------------------------------------------------------------
-- 3. Organisation settings — baseline, revenue, SBTi, reporting profile
-- ---------------------------------------------------------------------------

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  display_name text not null default '',
  country text not null default 'United Kingdom',
  intensity_metric text not null default 'tCO2e per £m turnover',
  baseline_ytd_tco2e double precision not null default 0,
  annual_revenue double precision not null default 0,
  sbti_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.organization_settings enable row level security;
alter table public.organization_settings force row level security;

drop policy if exists "members read organisation settings" on public.organization_settings;
create policy "members read organisation settings" on public.organization_settings
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

drop policy if exists "editors insert organisation settings" on public.organization_settings;
create policy "editors insert organisation settings" on public.organization_settings
  for insert to authenticated
  with check (public.has_org_role(organization_id, 'editor'));

drop policy if exists "editors update organisation settings" on public.organization_settings;
create policy "editors update organisation settings" on public.organization_settings
  for update to authenticated
  using (public.has_org_role(organization_id, 'editor'))
  with check (public.has_org_role(organization_id, 'editor'));

create or replace function public.ensure_org_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_settings (organization_id, display_name)
  values (new.id, new.name)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_ensure_settings on public.organizations;
create trigger organizations_ensure_settings
  after insert on public.organizations
  for each row execute function public.ensure_org_settings();

insert into public.organization_settings (organization_id, display_name)
select o.id, o.name
from public.organizations o
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Memberships → profiles so People & Access can embed colleague rows
--
-- Live databases often have memberships for people whose profile row was
-- never created (sign-up before the trigger, a failed insert, or a restored
-- dump). Adding the FK first raises 23503.
--
-- Hosted Supabase's SQL editor runs as the table owner, not a superuser.
-- These tables use FORCE ROW LEVEL SECURITY, so a plain INSERT/DELETE is
-- either rejected or matches zero rows. Turn RLS off for this transaction,
-- backfill, add the constraint, then put FORCE RLS back. If anything fails,
-- the outer transaction rolls back and RLS stays on.
-- ---------------------------------------------------------------------------

alter table public.profiles no force row level security;
alter table public.memberships no force row level security;
alter table public.profiles disable row level security;
alter table public.memberships disable row level security;

insert into public.profiles (id, email, full_name)
select
  u.id,
  coalesce(nullif(u.email, ''), u.id::text || '@unknown.local'),
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(u.email, 'user'), '@', 1)
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

delete from public.memberships m
where not exists (select 1 from public.profiles p where p.id = m.user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memberships_user_id_profiles_fkey'
      and conrelid = 'public.memberships'::regclass
  ) then
    alter table public.memberships
      add constraint memberships_user_id_profiles_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
end
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;

-- ---------------------------------------------------------------------------
-- 5. SaaS write limits — a company logging a year of invoices, or inviting
--    its staff, must not hit a hobby-app cap.
-- ---------------------------------------------------------------------------

alter table public.org_quotas
  alter column entries_per_hour set default 50000,
  alter column invites_per_hour set default 500,
  alter column factor_writes_per_hour set default 20000;

update public.org_quotas
set
  entries_per_hour = greatest(entries_per_hour, 50000),
  invites_per_hour = greatest(invites_per_hour, 500),
  factor_writes_per_hour = greatest(factor_writes_per_hour, 20000);

alter table public.invitations
  alter column expires_at set default (now() + interval '30 days');

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
  v_per_minute constant integer := 400;
  v_per_hour constant integer := 8000;
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
      when 'entry_write' then 50000
      when 'invite' then 500
      when 'factor_write' then 20000
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

-- ---------------------------------------------------------------------------
-- 6. Invite existing users immediately; 30-day expiry; redeem on every login
-- ---------------------------------------------------------------------------

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

  if v_existing is null then
    select u.id into v_existing
    from auth.users u
    where lower(u.email) = lower(p_email)
    limit 1;

    if v_existing is not null then
      insert into public.profiles (id, email, full_name)
      values (
        v_existing,
        lower(p_email),
        split_part(p_email, '@', 1)
      )
      on conflict (id) do nothing;
    end if;
  end if;

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

  insert into public.invitations (organization_id, email, role, invited_by, expires_at)
  values (p_org, lower(p_email), v_role, v_user, now() + interval '30 days')
  on conflict (organization_id, lower(email)) do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        expires_at = now() + interval '30 days',
        accepted_at = null
  returning id into v_id;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (p_org, v_user, 'member.invited', 'invitation', v_id::text,
          jsonb_build_object('email', lower(p_email), 'role', v_role));

  return v_id;
end;
$$;

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

create or replace function public.redeem_my_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user;
  if v_email is null then
    return 0;
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_user, v_email, split_part(v_email, '@', 1))
  on conflict (id) do nothing;

  insert into public.memberships (organization_id, user_id, role, invited_by)
  select i.organization_id, v_user, i.role, i.invited_by
  from public.invitations i
  where lower(i.email) = lower(v_email)
    and i.accepted_at is null
    and i.expires_at > now()
  on conflict (organization_id, user_id) do nothing;

  get diagnostics v_count = row_count;

  update public.invitations
  set accepted_at = now()
  where lower(email) = lower(v_email)
    and accepted_at is null
    and expires_at > now();

  return v_count;
end;
$$;

create or replace function public.list_org_members(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_rows jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_org_role(p_org, 'viewer') then
    raise exception 'Not a member of this organisation';
  end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at), '[]'::jsonb)
    into v_rows
  from (
    select
      m.id as membership_id,
      m.user_id,
      p.email,
      coalesce(p.full_name, '') as full_name,
      m.role,
      m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org
  ) x;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Persist site / tags / activity date with every logged activity
-- ---------------------------------------------------------------------------

-- Shared by 0005, 0006, and fix_entry_save.sql.
-- Live Table Editor can show leftover columns (activity_type, activity_amount)
-- as the first fields, and FORCE RLS hides every row from the postgres role.
-- This writes both the app columns and those leftovers, and lets the dashboard
-- owner see organisation rows without turning RLS off for clients.

alter table public.emission_entries add column if not exists category text;
alter table public.emission_entries add column if not exists scope text;
alter table public.emission_entries add column if not exists emissions_tco2e double precision not null default 0;
alter table public.emission_entries add column if not exists details text;
alter table public.emission_entries add column if not exists amount double precision;
alter table public.emission_entries add column if not exists unit text;
alter table public.emission_entries add column if not exists comment text;
alter table public.emission_entries add column if not exists link text;
alter table public.emission_entries add column if not exists created_at timestamptz default now();
alter table public.emission_entries add column if not exists organization_id uuid;
alter table public.emission_entries add column if not exists owner_id uuid;

do $$
declare
  v_has_category boolean;
  v_has_activity_type boolean;
  v_has_activity_amount boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'category'
  ) into v_has_category;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'activity_type'
  ) into v_has_activity_type;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'activity_amount'
  ) into v_has_activity_amount;

  if v_has_category and v_has_activity_type then
    execute $q$
      update public.emission_entries
      set category = coalesce(nullif(category, ''), activity_type)
      where category is null or category = ''
    $q$;
    execute $q$
      update public.emission_entries
      set activity_type = coalesce(nullif(activity_type, ''), category, 'unknown')
      where activity_type is null or activity_type = ''
    $q$;
  elsif v_has_activity_type then
    execute $q$
      update public.emission_entries
      set activity_type = coalesce(activity_type, 'unknown')
      where activity_type is null
    $q$;
  end if;

  if v_has_activity_type then
    execute 'alter table public.emission_entries alter column activity_type set default ''''';
  end if;
  if v_has_activity_amount then
    execute $q$
      update public.emission_entries
      set activity_amount = coalesce(activity_amount, 0)
      where activity_amount is null
    $q$;
    execute 'alter table public.emission_entries alter column activity_amount set default 0';
  end if;
end
$$;

drop policy if exists "postgres dashboard manages emission entries" on public.emission_entries;
create policy "postgres dashboard manages emission entries"
  on public.emission_entries
  for all
  to postgres
  using (current_user = 'postgres')
  with check (current_user = 'postgres');

create or replace function public.normalize_emission_entry_row(p jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p || pg_catalog.jsonb_build_object(
    'category', coalesce(p->>'category', p->>'activity_type', ''),
    'amount', coalesce(
      nullif(p->>'amount', '')::double precision,
      nullif(p->>'activity_amount', '')::double precision
    ),
    'emissions_tco2e', coalesce(
      nullif(p->>'emissions_tco2e', '')::double precision,
      nullif(p->>'emissions', '')::double precision,
      0
    ),
    'details', coalesce(p->>'details', ''),
    'scope', coalesce(p->>'scope', ''),
    'unit', coalesce(p->>'unit', ''),
    'comment', coalesce(p->>'comment', ''),
    'link', coalesce(p->>'link', ''),
    'site', coalesce(p->>'site', ''),
    'activity_date', coalesce(p->>'activity_date', left(coalesce(p->>'created_at', ''), 10))
  );
$$;

create or replace function public.insert_logged_emission_entry(
  p_organization_id uuid,
  p_owner_id uuid,
  p_category text,
  p_scope text,
  p_emissions_tco2e double precision,
  p_details text default '',
  p_amount double precision default null,
  p_unit text default '',
  p_comment text default '',
  p_link text default '',
  p_site text default '',
  p_tags text[] default '{}',
  p_custom_fields jsonb default '[]'::jsonb,
  p_activity_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_cols text[];
  v_col_sql text;
  v_sel_sql text;
  v_inserted jsonb;
  v_att record;
  v_user_id_type text;
begin
  v_payload := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'organization_id', p_organization_id,
    'owner_id', p_owner_id,
    'category', p_category,
    'activity_type', p_category,
    'scope', p_scope,
    'emissions_tco2e', p_emissions_tco2e,
    'emissions', p_emissions_tco2e,
    'details', p_details,
    'amount', p_amount,
    'activity_amount', p_amount,
    'unit', coalesce(p_unit, ''),
    'comment', p_comment,
    'link', p_link,
    'site', coalesce(p_site, ''),
    'tags', pg_catalog.to_jsonb(coalesce(p_tags, '{}'::text[])),
    'custom_fields', coalesce(p_custom_fields, '[]'::jsonb),
    'activity_date', coalesce(p_activity_date, current_date)
  ));

  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_user_id_type
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.emission_entries'::regclass
    and a.attname = 'user_id'
    and a.attnum > 0
    and not a.attisdropped;

  if v_user_id_type is not null then
    if v_user_id_type like '%uuid%' then
      v_payload := v_payload || pg_catalog.jsonb_build_object('user_id', p_owner_id);
    else
      v_payload := v_payload || pg_catalog.jsonb_build_object('user_id', p_owner_id::text);
    end if;
  end if;

  for v_att in
    select a.attname::text as attname, t.typname, t.typcategory
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_type t on t.oid = a.atttypid
    where a.attrelid = 'public.emission_entries'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attnotnull
      and not a.atthasdef
      and a.attidentity = ''
      and a.attgenerated = ''
      and a.attname <> 'id'
  loop
    if not (v_payload ? v_att.attname) then
      v_payload := v_payload || pg_catalog.jsonb_build_object(
        v_att.attname,
        case
          when v_att.typcategory = 'A' then '[]'::jsonb
          when v_att.typname in ('int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'money') then pg_catalog.to_jsonb(0)
          when v_att.typname = 'bool' then pg_catalog.to_jsonb(false)
          when v_att.typname = 'jsonb' then '[]'::jsonb
          when v_att.typname = 'date' then pg_catalog.to_jsonb(current_date)
          when v_att.typname in ('timestamp', 'timestamptz') then pg_catalog.to_jsonb(clock_timestamp())
          else pg_catalog.to_jsonb(''::text)
        end
      );
    end if;
  end loop;

  select coalesce(pg_catalog.array_agg(a.attname::text order by a.attnum), '{}')
  into v_cols
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.emission_entries'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attidentity = ''
    and a.attgenerated = ''
    and v_payload ? a.attname::text;

  if v_cols is null or pg_catalog.array_length(v_cols, 1) is null then
    raise exception 'emission_entries has no matching columns to insert';
  end if;

  select
    pg_catalog.string_agg(pg_catalog.quote_ident(c), ', '),
    pg_catalog.string_agg('r.' || pg_catalog.quote_ident(c), ', ')
  into v_col_sql, v_sel_sql
  from pg_catalog.unnest(v_cols) as c;

  execute pg_catalog.format(
    'insert into public.emission_entries (%s)
     select %s
     from pg_catalog.jsonb_populate_record(null::public.emission_entries, $1) r
     returning pg_catalog.to_jsonb(public.emission_entries.*)',
    v_col_sql,
    v_sel_sql
  )
  into v_inserted
  using v_payload;

  return public.normalize_emission_entry_row(v_inserted)
    || pg_catalog.jsonb_build_object(
         'category', p_category,
         'scope', coalesce(p_scope, ''),
         'emissions_tco2e', p_emissions_tco2e,
         'details', coalesce(p_details, ''),
         'amount', p_amount,
         'unit', coalesce(p_unit, ''),
         'comment', coalesce(p_comment, ''),
         'link', coalesce(p_link, ''),
         'site', coalesce(p_site, ''),
         'tags', pg_catalog.to_jsonb(coalesce(p_tags, '{}'::text[])),
         'custom_fields', coalesce(p_custom_fields, '[]'::jsonb),
         'activity_date', coalesce(p_activity_date, current_date),
         'organization_id', p_organization_id,
         'owner_id', p_owner_id
       );
end;
$$;

drop function if exists public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text);
drop function if exists public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text, text, text[], jsonb, date);

create or replace function public.log_emission_entry(
  p_organization_id uuid,
  p_category text,
  p_scope text,
  p_emissions_tco2e double precision,
  p_details text default '',
  p_amount double precision default null,
  p_unit text default '',
  p_comment text default '',
  p_link text default '',
  p_site text default '',
  p_tags text[] default '{}',
  p_custom_fields jsonb default '[]'::jsonb,
  p_activity_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid := p_organization_id;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_org is null then
    select m.organization_id into v_org
    from public.memberships m
    where m.user_id = v_user
    order by m.created_at
    limit 1;
  end if;

  if v_org is null then
    raise exception 'Not a member of this organisation';
  end if;

  if not public.has_org_role(v_org, 'editor') then
    raise exception 'Not a member of this organisation';
  end if;

  return public.insert_logged_emission_entry(
    v_org,
    v_user,
    p_category,
    p_scope,
    p_emissions_tco2e,
    p_details,
    p_amount,
    p_unit,
    p_comment,
    p_link,
    p_site,
    p_tags,
    p_custom_fields,
    p_activity_date
  );
end;
$$;

create or replace function public.list_emission_entries(p_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_rows jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_organization_id is not null and not public.has_org_role(p_organization_id, 'viewer') then
    raise exception 'Not a member of this organisation';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      public.normalize_emission_entry_row(pg_catalog.to_jsonb(e))
      order by e.created_at desc
    ),
    '[]'::jsonb
  )
    into v_rows
  from public.emission_entries e
  where e.organization_id in (select public.user_org_ids())
    and (p_organization_id is null or e.organization_id = p_organization_id);

  return v_rows;
end;
$$;

create or replace function public.delete_emission_entry(p_id bigint)
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

  delete from public.emission_entries e
  where e.id = p_id
    and e.organization_id in (select public.user_org_ids())
    and public.has_org_role(e.organization_id, 'editor');

  if not found then
    raise exception 'Not allowed';
  end if;
end;
$$;

revoke all on function public.normalize_emission_entry_row(jsonb) from public, anon, authenticated;
revoke all on function public.insert_logged_emission_entry(uuid, uuid, text, text, double precision, text, double precision, text, text, text, text, text[], jsonb, date) from public, anon, authenticated;
revoke all on function public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text, text, text[], jsonb, date) from public, anon;
revoke all on function public.list_emission_entries(uuid) from public, anon;
revoke all on function public.delete_emission_entry(bigint) from public, anon;
grant execute on function public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text, text, text[], jsonb, date) to authenticated;
grant execute on function public.list_emission_entries(uuid) to authenticated;
grant execute on function public.delete_emission_entry(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['sites', 'organization_settings']
  loop
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    end if;
  end loop;
end
$$;

revoke all on function public.redeem_my_invitations() from public, anon;
revoke all on function public.list_org_members(uuid) from public, anon;
revoke all on function public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text, text, text[], jsonb, date) from public, anon;
grant execute on function public.redeem_my_invitations() to authenticated;
grant execute on function public.list_org_members(uuid) to authenticated;
grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.invite_org_member(uuid, text, text) to authenticated;
grant execute on function public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text, text, text[], jsonb, date) to authenticated;

notify pgrst, 'reload schema';

commit;
