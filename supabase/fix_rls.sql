-- Repair misconfigured Row Level Security.
--
-- Paste this into the Supabase SQL editor after 0001_auth_and_tenancy.sql has
-- been applied (it needs user_org_ids / has_org_role). Safe to re-run.
--
-- It closes the two advisor findings this project actually had:
--   1. Policy exists, RLS disabled — emission_factors had an anon SELECT
--      policy while RLS was off, so the policy did nothing until someone
--      enabled RLS and it became USING (true) for the publishable key.
--   2. Open anon policies — emission_entries used USING (true) / WITH CHECK
--      (true), so anyone with the bundled key could read and delete every row.
--
-- It also restores membership-scoped policies if a partial run left RLS on
-- with zero policies (default deny, app looks "broken").

begin;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;
alter table public.emission_entries enable row level security;
alter table public.emission_factors enable row level security;

alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.memberships force row level security;
alter table public.invitations force row level security;
alter table public.audit_log force row level security;
alter table public.emission_entries force row level security;
alter table public.emission_factors force row level security;

-- Legacy open policies from supabase_schema.sql, plus any other names on the
-- two emission tables (a leftover FOR ALL / USING (true) is enough to leak).
drop policy if exists "Allow anon read emission_entries" on public.emission_entries;
drop policy if exists "Allow anon insert emission_entries" on public.emission_entries;
drop policy if exists "Allow anon delete emission_entries" on public.emission_entries;
drop policy if exists "Allow anon update emission_entries" on public.emission_entries;
drop policy if exists "Allow anon read emission_factors" on public.emission_factors;
drop policy if exists "Allow anon insert emission_factors" on public.emission_factors;
drop policy if exists "Allow anon update emission_factors" on public.emission_factors;
drop policy if exists "Allow anon delete emission_factors" on public.emission_factors;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('emission_entries', 'emission_factors')
      and policyname <> 'postgres dashboard manages emission entries'
      and (
        'anon' = any (roles)
        or qual = 'true'
        or with_check = 'true'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end
$$;

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

-- Invitation writes go through invite_member / revoke_invitation so a client
-- cannot skip the organisation rate limiter with a direct table insert.
drop policy if exists "admins insert invitations" on public.invitations;
drop policy if exists "admins update invitations" on public.invitations;
drop policy if exists "admins delete invitations" on public.invitations;

drop policy if exists "admins read the audit log" on public.audit_log;
create policy "admins read the audit log" on public.audit_log
  for select to authenticated
  using (public.has_org_role(organization_id, 'admin'));

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

drop policy if exists "postgres dashboard manages emission entries" on public.emission_entries;
create policy "postgres dashboard manages emission entries"
  on public.emission_entries
  for all
  to postgres
  using (current_user = 'postgres')
  with check (current_user = 'postgres');

drop policy if exists "read shared and own factors" on public.emission_factors;
create policy "read shared and own factors" on public.emission_factors
  for select to authenticated
  using (
    organization_id is null
    or organization_id in (select public.user_org_ids())
  );

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

-- Column-level grants: a full UPDATE grant on profiles/organizations would let
-- a member overwrite any future billing or quota column. Only the fields the
-- UI is allowed to edit are writable.
revoke insert, update, delete on table public.invitations from authenticated;
grant select on table public.invitations to authenticated;

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
