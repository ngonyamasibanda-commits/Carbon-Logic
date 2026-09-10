-- Fix emission entries so they belong to the organisation, not the browser session.
--
-- Paste this file into the Supabase SQL editor and run it once when:
--   * logging an activity fails with "Could not save this activity to your
--     organisation", or
--   * the app shows the activity but Table Editor for public.emission_entries
--     is empty (including a table whose first columns are activity_type /
--     activity_amount).
--
-- Safe to re-run. After it succeeds, hard-refresh the app so any
-- "on this device only" rows are pushed into Postgres.
--
-- What this does:
--   1. Keeps the hourly quota trigger from aborting a save when quota tables
--      were never created (that failure was silently falling back to the browser).
--   2. Adds log/list/delete functions the app uses so a save is not dependent on
--      PostgREST column cache / insert-then-select RLS.
--   3. Stores and lists rows by organisation, so every member sees the same
--      inventory after logout or when signing in with a different account.
--   4. Fills leftover live columns (activity_type, activity_amount) so a NOT NULL
--      leftover schema cannot abort the insert.
--   5. Lets the Table Editor postgres role see organisation rows under FORCE RLS.

begin;

create table if not exists public.emission_entries (
    id bigserial primary key,
    user_id text not null default 'default_user',
    category text not null,
    scope text,
    emissions_tco2e double precision not null default 0,
    details text,
    amount double precision,
    unit text,
    comment text,
    link text,
    created_at timestamptz default now()
);

alter table public.emission_entries add column if not exists organization_id uuid;
alter table public.emission_entries add column if not exists owner_id uuid;
alter table public.emission_entries
  add column if not exists site text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists activity_date date not null default current_date;

create index if not exists emission_entries_org_idx
  on public.emission_entries (organization_id, created_at desc);
create index if not exists emission_entries_owner_idx
  on public.emission_entries (owner_id, created_at desc);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  ) then
    execute $q$
      alter table public.emission_entries
        alter column user_id set default 'default_user'
    $q$;
  end if;
end
$$;

create or replace function public.enforce_entry_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null then
    return new;
  end if;
  begin
    perform public.consume_org_quota(new.organization_id, 'entry_write');
  exception
    when undefined_table then
      null;
    when undefined_function then
      null;
    when others then
      if sqlerrm ilike '%rate limit%' then
        raise;
      end if;
      -- Missing quota infra must not discard a logged activity.
      null;
  end;
  return new;
end;
$$;

drop trigger if exists emission_entries_quota on public.emission_entries;
create trigger emission_entries_quota
  before insert on public.emission_entries
  for each row execute function public.enforce_entry_quota();

-- Recover rows that were saved against the user instead of the organisation.
update public.emission_entries e
set organization_id = s.organization_id
from (
  select distinct on (user_id) user_id, organization_id
  from public.memberships
  order by user_id, created_at asc
) s
where e.organization_id is null
  and e.owner_id = s.user_id;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  ) then
    execute $q$
      update public.emission_entries e
      set organization_id = s.organization_id,
          owner_id = coalesce(e.owner_id, s.user_id)
      from (
        select distinct on (user_id) user_id, organization_id
        from public.memberships
        order by user_id, created_at asc
      ) s
      where e.organization_id is null
        and e.user_id = s.user_id::text
    $q$;
  end if;
end
$$;

alter table public.emission_entries enable row level security;

drop policy if exists "read entries in your organizations" on public.emission_entries;
drop policy if exists "read own emission entries" on public.emission_entries;
drop policy if exists "editors create entries" on public.emission_entries;
drop policy if exists "editors update entries" on public.emission_entries;
drop policy if exists "editors delete entries" on public.emission_entries;
drop policy if exists "entries must belong to an organisation" on public.emission_entries;

create policy "read entries in your organizations" on public.emission_entries
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

create policy "editors create entries" on public.emission_entries
  for insert to authenticated
  with check (
    organization_id is not null
    and public.has_org_role(organization_id, 'editor')
    and owner_id = (select auth.uid())
  );

create policy "editors update entries" on public.emission_entries
  for update to authenticated
  using (public.has_org_role(organization_id, 'editor'))
  with check (public.has_org_role(organization_id, 'editor'));

create policy "editors delete entries" on public.emission_entries
  for delete to authenticated
  using (public.has_org_role(organization_id, 'editor'));

create policy "entries must belong to an organisation" on public.emission_entries
  as restrictive
  for all to authenticated
  using (organization_id is not null)
  with check (organization_id is not null);

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

grant select, insert, update, delete on table public.emission_entries to authenticated;
do $$
begin
  if to_regclass('public.emission_entries_id_seq') is not null then
    execute 'grant usage, select on sequence public.emission_entries_id_seq to authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
