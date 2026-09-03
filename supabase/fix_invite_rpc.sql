-- Repair People & Access invites when PostgREST reports:
--   Could not find the function public.invite_member(...) in the schema cache
--
-- Paste this entire file into the Supabase SQL editor and run it.

drop function if exists public.invite_member(uuid, text, public.org_role);
drop function if exists public.invite_member(uuid, text, text);
drop function if exists public.set_member_role(uuid, public.org_role);
drop function if exists public.set_member_role(uuid, text);

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

grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;

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

notify pgrst, 'reload schema';
