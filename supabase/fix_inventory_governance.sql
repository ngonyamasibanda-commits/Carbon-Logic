-- Carbon Logic — inventory governance for a paid organisation workspace.
--
-- Adds FTE, reporting year, residual mix, and year-end close. Closed years
-- cannot be edited until an administrator reopens them. Idempotent.
--
-- Paste this file (or supabase/fix_inventory_governance.sql) in the Supabase
-- SQL editor on the live project after 0006.

begin;

do $$
begin
  if to_regclass('public.organization_settings') is null
     or to_regclass('public.emission_entries') is null then
    raise exception
      'Run supabase/migrations/0006_saas_cloud_workspace.sql (or fix_saas_workspace.sql) before this file.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Organisation reporting profile
-- ---------------------------------------------------------------------------

alter table public.organization_settings
  add column if not exists employee_count double precision not null default 0,
  add column if not exists reporting_year integer not null default (extract(year from current_date))::integer,
  add column if not exists locked_years integer[] not null default '{}'::integer[],
  add column if not exists residual_mix_kg_per_kwh double precision not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Year-end close — database-authoritative, not only a UI flag
-- ---------------------------------------------------------------------------

create or replace function public.inventory_year_is_locked(p_org uuid, p_year integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p_year = any (s.locked_years)
      from public.organization_settings s
      where s.organization_id = p_org
    ),
    false
  );
$$;

create or replace function public.entry_reporting_year(p_date date, p_created timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from coalesce(p_date, (p_created at time zone 'utc')::date, current_date))::integer;
$$;

create or replace function public.enforce_inventory_period_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_year integer;
  v_old_year integer;
begin
  v_org := coalesce(new.organization_id, old.organization_id);
  if v_org is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_year := public.entry_reporting_year(old.activity_date, old.created_at);
  else
    v_year := public.entry_reporting_year(new.activity_date, new.created_at);
  end if;

  if tg_op = 'UPDATE' then
    v_old_year := public.entry_reporting_year(old.activity_date, old.created_at);
    if public.inventory_year_is_locked(v_org, v_old_year) then
      raise exception
        'Reporting year % is closed. Re-open it from Organisation settings before changing activities.',
        v_old_year;
    end if;
  end if;

  if public.inventory_year_is_locked(v_org, v_year) then
    raise exception
      'Reporting year % is closed. Re-open it from Organisation settings before changing activities.',
      v_year;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists emission_entries_period_lock on public.emission_entries;
create trigger emission_entries_period_lock
  before insert or update or delete on public.emission_entries
  for each row execute function public.enforce_inventory_period_lock();

create or replace function public.protect_locked_years()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.locked_years is distinct from old.locked_years
     and not public.has_org_role(new.organization_id, 'admin') then
    raise exception 'Only an administrator can close or reopen a reporting year.';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_settings_protect_locks on public.organization_settings;
create trigger organization_settings_protect_locks
  before update on public.organization_settings
  for each row execute function public.protect_locked_years();

create or replace function public.set_reporting_year_lock(
  p_organization_id uuid,
  p_year integer,
  p_locked boolean,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_years integer[];
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_year < 2000 or p_year > 2100 then
    raise exception 'Invalid reporting year';
  end if;
  if not public.has_org_role(p_organization_id, 'admin') then
    raise exception 'Only an administrator can close or reopen a reporting year.';
  end if;

  insert into public.organization_settings (organization_id, display_name)
  values (p_organization_id, '')
  on conflict (organization_id) do nothing;

  if p_locked then
    update public.organization_settings
    set
      locked_years = (
        select coalesce(array_agg(distinct y order by y), '{}'::integer[])
        from unnest(locked_years || p_year) as y
      ),
      updated_at = now()
    where organization_id = p_organization_id
    returning locked_years into v_years;
  else
    update public.organization_settings
    set
      locked_years = array_remove(locked_years, p_year),
      updated_at = now()
    where organization_id = p_organization_id
    returning locked_years into v_years;
  end if;

  insert into public.audit_log
    (organization_id, actor_id, actor_email, action, target_type, target_id, metadata)
  values (
    p_organization_id,
    v_user,
    (select email from public.profiles where id = v_user),
    case when p_locked then 'inventory.year_closed' else 'inventory.year_reopened' end,
    'reporting_year',
    p_year::text,
    jsonb_build_object('reason', coalesce(p_reason, ''), 'locked_years', to_jsonb(v_years))
  );

  return jsonb_build_object('organization_id', p_organization_id, 'locked_years', v_years);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Inventory audit trail (must not block the write if audit insert fails)
-- ---------------------------------------------------------------------------

create or replace function public.audit_emission_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_action text;
  v_id text;
begin
  v_org := coalesce(new.organization_id, old.organization_id);
  if v_org is null or v_user is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    v_action := 'inventory.entry_created';
    v_id := new.id::text;
  elsif tg_op = 'DELETE' then
    v_action := 'inventory.entry_deleted';
    v_id := old.id::text;
  else
    v_action := 'inventory.entry_updated';
    v_id := new.id::text;
  end if;
  begin
    insert into public.audit_log
      (organization_id, actor_id, actor_email, action, target_type, target_id, metadata)
    values (
      v_org,
      v_user,
      (select email from public.profiles where id = v_user),
      v_action,
      'emission_entry',
      v_id,
      jsonb_build_object(
        'category', coalesce(new.category, old.category),
        'tco2e', coalesce(new.emissions_tco2e, old.emissions_tco2e),
        'activity_date', coalesce(new.activity_date, old.activity_date)
      )
    );
  exception when others then
    null;
  end;
  return coalesce(new, old);
end;
$$;

drop trigger if exists emission_entries_audit on public.emission_entries;
create trigger emission_entries_audit
  after insert or update or delete on public.emission_entries
  for each row execute function public.audit_emission_entry();

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------

revoke all on function public.inventory_year_is_locked(uuid, integer) from public, anon;
revoke all on function public.set_reporting_year_lock(uuid, integer, boolean, text) from public, anon;
grant execute on function public.inventory_year_is_locked(uuid, integer) to authenticated;
grant execute on function public.set_reporting_year_lock(uuid, integer, boolean, text) to authenticated;

notify pgrst, 'reload schema';

commit;
