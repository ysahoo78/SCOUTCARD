-- Optional headshots: private compressed images, owner-only writes, published-photo reads.
-- Additive migration: existing profiles retain initials until their owner adds a photo.
begin;
alter table public.athlete_profiles add column if not exists headshot_path text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.athlete_profiles'::regclass and conname='athlete_headshot_owned_path') then
    alter table public.athlete_profiles add constraint athlete_headshot_owned_path check (
      headshot_path is null or (
        split_part(headshot_path,'/',1)=id::text and
        headshot_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      )
    );
  end if;
end $$;
create unique index if not exists athlete_headshot_path_idx on public.athlete_profiles(headshot_path) where headshot_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('athlete-headshots','athlete-headshots',false,524288,array['image/jpeg'])
on conflict(id) do nothing;

drop policy if exists scoutcard_headshot_owner_read on storage.objects;
create policy scoutcard_headshot_owner_read on storage.objects for select to authenticated
using (bucket_id='athlete-headshots' and (storage.foldername(name))[1]=(select auth.uid()::text));

drop policy if exists scoutcard_headshot_published_read on storage.objects;
create policy scoutcard_headshot_published_read on storage.objects for select to anon,authenticated
using (
  bucket_id='athlete-headshots'
  and storage.allow_any_operation(array['object.sign','object.sign_many','object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info'])
  and exists (select 1 from public.athlete_profiles p where p.is_public and p.headshot_path=storage.objects.name)
);

drop policy if exists scoutcard_headshot_owner_upload on storage.objects;
create policy scoutcard_headshot_owner_upload on storage.objects for insert to authenticated
with check (
  bucket_id='athlete-headshots' and (storage.foldername(name))[1]=(select auth.uid()::text)
  and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
);

drop policy if exists scoutcard_headshot_owner_delete on storage.objects;
create policy scoutcard_headshot_owner_delete on storage.objects for delete to authenticated
using (bucket_id='athlete-headshots' and (storage.foldername(name))[1]=(select auth.uid()::text));
-- No UPDATE policy: images are immutable; replacements get a new filename.
commit;
