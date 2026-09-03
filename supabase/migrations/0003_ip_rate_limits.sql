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
