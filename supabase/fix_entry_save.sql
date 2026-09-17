-- Fix emission entries so they belong to the organisation, not the browser session.
--
-- If logging an activity fails with "Could not save this activity to your
-- organisation", paste this file into the Supabase SQL editor and run it once.
-- It adds the inventory columns the app writes, recreates log_emission_entry,
-- and stops a missing quota table from aborting the save.
--
-- Safe to re-run. Never run this when logging an activity — after this exists,
-- every save writes to the organisation automatically.
--
-- What this does:
--   1. Keeps the hourly quota trigger from aborting a save when quota tables
--      were never created (that failure was silently falling back to the browser).
--   2. Adds log/list/delete functions the app uses so a save is not dependent on
--      PostgREST column cache / insert-then-select RLS.
--   3. Stores and lists rows by organisation, so every member sees the same
--      inventory after logout or when signing in with a different account.

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
  v_id bigint;
  v_created timestamptz;
  v_date date := coalesce(p_activity_date, current_date);
  v_has_user_id boolean;
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

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  ) into v_has_user_id;

  begin
    if v_has_user_id then
      execute $q$
        insert into public.emission_entries (
          organization_id, owner_id, user_id, category, scope, emissions_tco2e,
          details, amount, unit, comment, link, site, tags, custom_fields, activity_date
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        returning id, created_at
      $q$
      into v_id, v_created
      using v_org, v_user, v_user::text, p_category, p_scope, p_emissions_tco2e,
            p_details, p_amount, p_unit, p_comment, p_link,
            coalesce(p_site, ''), coalesce(p_tags, '{}'), coalesce(p_custom_fields, '[]'::jsonb), v_date;
    else
      insert into public.emission_entries (
        organization_id, owner_id, category, scope, emissions_tco2e,
        details, amount, unit, comment, link, site, tags, custom_fields, activity_date
      ) values (
        v_org, v_user, p_category, p_scope, p_emissions_tco2e,
        p_details, p_amount, p_unit, p_comment, p_link,
        coalesce(p_site, ''), coalesce(p_tags, '{}'), coalesce(p_custom_fields, '[]'::jsonb), v_date
      )
      returning id, created_at into v_id, v_created;
    end if;
  exception
    when undefined_column then
      if v_has_user_id then
        execute $q$
          insert into public.emission_entries (
            organization_id, owner_id, user_id, category, scope, emissions_tco2e,
            details, amount, unit, comment, link
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          returning id, created_at
        $q$
        into v_id, v_created
        using v_org, v_user, v_user::text, p_category, p_scope, p_emissions_tco2e,
              p_details, p_amount, p_unit, p_comment, p_link;
      else
        insert into public.emission_entries (
          organization_id, owner_id, category, scope, emissions_tco2e,
          details, amount, unit, comment, link
        ) values (
          v_org, v_user, p_category, p_scope, p_emissions_tco2e,
          p_details, p_amount, p_unit, p_comment, p_link
        )
        returning id, created_at into v_id, v_created;
      end if;
  end;

  return jsonb_build_object(
    'id', v_id,
    'organization_id', v_org,
    'owner_id', v_user,
    'category', p_category,
    'scope', p_scope,
    'emissions_tco2e', p_emissions_tco2e,
    'details', p_details,
    'amount', p_amount,
    'unit', p_unit,
    'comment', p_comment,
    'link', p_link,
    'site', coalesce(p_site, ''),
    'tags', to_jsonb(coalesce(p_tags, '{}')),
    'custom_fields', coalesce(p_custom_fields, '[]'::jsonb),
    'activity_date', v_date,
    'created_at', v_created
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

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
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
