-- Fix emission entries not surviving logout.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run.
--
-- What this does:
--   1. Makes the hourly quota trigger unable to abort a save when quota tables
--      were never created (that failure was silently falling back to the browser).
--   2. Adds log/list/delete functions the app uses so a save is not dependent on
--      PostgREST column cache / insert-then-select RLS.
--   3. Lets a member read their own rows (owner_id) as well as the organisation's.

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

create index if not exists emission_entries_org_idx
  on public.emission_entries (organization_id, created_at desc);
create index if not exists emission_entries_owner_idx
  on public.emission_entries (owner_id, created_at desc);

-- If the legacy user_id column is still NOT NULL, keep writing it from the RPC.
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

alter table public.emission_entries enable row level security;

drop policy if exists "read entries in your organizations" on public.emission_entries;
drop policy if exists "read own emission entries" on public.emission_entries;
drop policy if exists "editors create entries" on public.emission_entries;
drop policy if exists "editors delete entries" on public.emission_entries;
drop policy if exists "entries must belong to an organisation" on public.emission_entries;

do $$
declare
  v_has_user_id boolean;
  v_has_org_ids boolean;
  v_using text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  ) into v_has_user_id;
  v_has_org_ids := to_regprocedure('public.user_org_ids()') is not null;

  v_using := 'owner_id = (select auth.uid())';
  if v_has_user_id then
    v_using := v_using || ' or user_id = (select auth.uid())::text';
  end if;
  if v_has_org_ids then
    v_using := v_using || ' or organization_id in (select public.user_org_ids())';
  end if;

  execute format(
    'create policy %I on public.emission_entries for select to authenticated using (%s)',
    'read own emission entries',
    v_using
  );
  execute format(
    'create policy %I on public.emission_entries for insert to authenticated with check (%s)',
    'editors create entries',
    'owner_id = (select auth.uid())' || case when v_has_user_id then ' or user_id = (select auth.uid())::text' else '' end
  );
  execute format(
    'create policy %I on public.emission_entries for delete to authenticated using (%s)',
    'editors delete entries',
    'owner_id = (select auth.uid())' || case when v_has_user_id then ' or user_id = (select auth.uid())::text' else '' end
  );
end
$$;

create or replace function public.log_emission_entry(
  p_organization_id uuid,
  p_category text,
  p_scope text,
  p_emissions_tco2e double precision,
  p_details text default '',
  p_amount double precision default null,
  p_unit text default '',
  p_comment text default '',
  p_link text default ''
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
  v_has_user_id boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_org is not null and to_regclass('public.memberships') is not null then
    if not exists (
      select 1 from public.memberships m
      where m.organization_id = v_org and m.user_id = v_user
    ) then
      v_org := null;
    end if;
  end if;

  if v_org is null and to_regclass('public.memberships') is not null then
    select m.organization_id into v_org
    from public.memberships m
    where m.user_id = v_user
    order by m.created_at
    limit 1;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'user_id'
  ) into v_has_user_id;

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

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
    into v_rows
  from public.emission_entries e
  where e.owner_id = v_user
     or e.organization_id in (
       select m.organization_id from public.memberships m where m.user_id = v_user
     )
     or (p_organization_id is not null and e.organization_id = p_organization_id);

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
    and (
      e.owner_id = v_user
      or e.organization_id in (
        select m.organization_id from public.memberships m where m.user_id = v_user
      )
    );

  if not found then
    raise exception 'Not allowed';
  end if;
end;
$$;

revoke all on function public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text) from public, anon;
revoke all on function public.list_emission_entries(uuid) from public, anon;
revoke all on function public.delete_emission_entry(bigint) from public, anon;
grant execute on function public.log_emission_entry(uuid, text, text, double precision, text, double precision, text, text, text) to authenticated;
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
