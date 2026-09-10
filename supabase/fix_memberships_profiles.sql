-- Repair: memberships → profiles foreign key (ERROR 23503).
--
-- If the SaaS workspace SQL stopped with:
--   insert or update on table "memberships" violates foreign key constraint
--   "memberships_user_id_profiles_fkey"
-- paste this file into the Supabase SQL editor and run it, then paste
-- supabase/fix_live_database.sql (0002 through 0006). Do not re-run
-- fix_saas_workspace.sql on its own unless public.org_quotas already exists.
--
-- Why a separate script: hosted SQL editor is the table owner, not a
-- superuser, and profiles/memberships use FORCE ROW LEVEL SECURITY. A
-- normal INSERT/DELETE therefore cannot create the missing profile rows.

begin;

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

commit;
