-- People & Access: add existing users immediately, revoke invitations, reload schema.
-- Run this in the Supabase SQL editor.

drop function if exists public.invite_member(uuid, text, public.org_role);
drop function if exists public.invite_member(uuid, text, text);

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
    raise exception 'Only managers and owners can invite members';
  end if;
  if public.role_rank(v_role) > public.role_rank(v_caller) then
    raise exception 'You cannot grant a role higher than your own';
  end if;

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

create or replace function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_email text;
  v_role public.org_role;
begin
  select organization_id, email, role
    into v_org, v_email, v_role
  from public.invitations
  where id = p_invitation;

  if v_org is null then
    raise exception 'Invitation not found';
  end if;
  if not public.has_org_role(v_org, 'admin') then
    raise exception 'Only managers and owners can revoke invitations';
  end if;

  delete from public.invitations where id = p_invitation;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, v_user, 'member.invite_revoked', 'invitation', p_invitation::text,
          jsonb_build_object('email', v_email, 'role', v_role));
end;
$$;

grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;

drop policy if exists "admins delete invitations" on public.invitations;
create policy "admins delete invitations" on public.invitations
  for delete to authenticated
  using (public.has_org_role(organization_id, 'admin'));

notify pgrst, 'reload schema';
