-- Evidence file uploads for activity invoices, delivery notes, and EPDs.
-- Safe to re-run. No-ops when the Storage schema is not present.

begin;

create or replace function public.evidence_org_from_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function public.evidence_org_from_path(text) from public, anon;
grant execute on function public.evidence_org_from_path(text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'evidence',
    'evidence',
    false,
    8388608,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-excel'
    ]
  )
  on conflict (id) do update
    set file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'alter table storage.objects enable row level security';

  drop policy if exists "org members read evidence" on storage.objects;
  create policy "org members read evidence"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'evidence'
      and public.evidence_org_from_path(name) in (select public.user_org_ids())
    );

  drop policy if exists "editors upload evidence" on storage.objects;
  create policy "editors upload evidence"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'evidence'
      and public.has_org_role(public.evidence_org_from_path(name), 'editor')
    );

  drop policy if exists "editors replace evidence" on storage.objects;
  create policy "editors replace evidence"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'evidence'
      and public.has_org_role(public.evidence_org_from_path(name), 'editor')
    )
    with check (
      bucket_id = 'evidence'
      and public.has_org_role(public.evidence_org_from_path(name), 'editor')
    );

  drop policy if exists "editors delete evidence" on storage.objects;
  create policy "editors delete evidence"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'evidence'
      and public.has_org_role(public.evidence_org_from_path(name), 'editor')
    );
end
$$;

commit;
