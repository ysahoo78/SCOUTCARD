-- Parent-only accounts: no Auth account or email is created for a child.
-- Additive ownership migration; existing athlete IDs, slugs and NFC links stay unchanged.
begin;
alter table public.athlete_profiles add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.athlete_profiles add column if not exists parent_managed boolean not null default false;
alter table public.athlete_profiles add column if not exists child_age_band text;
alter table public.athlete_profiles add column if not exists parent_acknowledged_at timestamptz;
alter table public.athlete_profiles add column if not exists parent_public_consent_at timestamptz;
alter table public.athlete_profiles add column if not exists parent_policy_version text;
update public.athlete_profiles set owner_id=id where owner_id is null;
alter table public.athlete_profiles alter column owner_id set default auth.uid();
alter table public.athlete_profiles alter column owner_id set not null;
-- The account owner, not every athlete, must be an Auth user.
alter table public.athlete_profiles drop constraint if exists athlete_profiles_id_fkey;
create index if not exists athlete_profiles_owner_idx on public.athlete_profiles(owner_id,id);
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.athlete_profiles'::regclass and conname='parent_profile_ownership') then
alter table public.athlete_profiles add constraint parent_profile_ownership check (
 (not parent_managed and id=owner_id and child_age_band is null)
 or (parent_managed and id<>owner_id and child_age_band in ('under13','teen')
     and parent_acknowledged_at is not null and parent_policy_version is not null)
); end if;
if not exists(select 1 from pg_constraint where conrelid='public.athlete_profiles'::regclass and conname='parent_profile_sharing') then
alter table public.athlete_profiles add constraint parent_profile_sharing check (
 not parent_managed or not is_public or parent_public_consent_at is not null
); end if; end $$;

create or replace function public.validate_scoutcard_profile()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.slug is distinct from old.slug then
   raise exception 'Your permanent profile address cannot be changed.';
 end if;
 if char_length(trim(new.display_name)) not between 1 and 60
   or char_length(coalesce(trim(new.sport),'')) not between 1 and 40
   or (coalesce(new.graduation_year,'') !~ '^20[0-9]{2}$' and (not new.parent_managed or coalesce(new.graduation_year,'')<>''))
   or char_length(coalesce(new.position,''))>80 or char_length(coalesce(new.accolade,''))>200
   or char_length(coalesce(new.highlight_url,''))>1000
   or (coalesce(new.highlight_url,'')<>'' and new.highlight_url !~ '^https?://')
   or jsonb_typeof(new.details) <> 'object' or octet_length(new.details::text)>40000
 then raise exception 'Please check your profile name, sport, year, and field lengths.'; end if;
 if exists (
   select 1 from jsonb_each(new.details) d
   where (d.key <> 'sport_metrics' and (d.key not in ('team','club_team','stats','academics','events','bio') or jsonb_typeof(d.value)<>'string'))
      or (d.key = 'sport_metrics' and jsonb_typeof(d.value)<>'object')
 )
 then raise exception 'Profile details contain an unsupported field.'; end if;
 if new.details ? 'sport_metrics' then
   if (select count(*) from jsonb_each(new.details->'sport_metrics')) > 12
      or exists (
        select 1 from jsonb_each(new.details->'sport_metrics') metric
        where metric.key !~ '^[a-z][a-z0-9_]{0,39}$'
           or jsonb_typeof(metric.value)<>'string'
           or char_length(metric.value #>> '{}') > 120
      )
   then raise exception 'Sport results must be short text values.'; end if;
 end if;
 if char_length(coalesce(new.details->>'club_team',''))>120
   or char_length(coalesce(new.details->>'team',''))>120
   or char_length(coalesce(new.details->>'stats',''))>2000
   or char_length(coalesce(new.details->>'academics',''))>1000
   or char_length(coalesce(new.details->>'events',''))>2000
   or char_length(coalesce(new.details->>'bio',''))>1500
 then raise exception 'Please shorten the profile details to the allowed lengths.'; end if;
 new.updated_at=now();
 return new;
end; $$;

-- Keep ownership/age/acknowledgments out of public API column access.
revoke select,insert,update on public.athlete_profiles from anon,authenticated;
grant select(id,slug,display_name,sport,graduation_year,position,accolade,highlight_url,created_at,updated_at,details,is_public,headshot_path,parent_managed) on public.athlete_profiles to anon,authenticated;
grant insert(id,slug,display_name,sport,graduation_year,position,accolade,highlight_url,created_at,updated_at,details,is_public,headshot_path),
 update(id,slug,display_name,sport,graduation_year,position,accolade,highlight_url,created_at,updated_at,details,is_public,headshot_path) on public.athlete_profiles to authenticated;
drop policy if exists "public profiles are visible" on public.athlete_profiles;
create policy "public profiles are visible" on public.athlete_profiles for select to anon,authenticated using (is_public or owner_id=(select auth.uid()));
drop policy if exists "users create own profile" on public.athlete_profiles;
create policy "users create own profile" on public.athlete_profiles for insert to authenticated with check (id=(select auth.uid()) and owner_id=(select auth.uid()) and not parent_managed);
drop policy if exists "users update own profile" on public.athlete_profiles;
create policy "users update own profile" on public.athlete_profiles for update to authenticated using (id=(select auth.uid()) and not parent_managed) with check (id=(select auth.uid()) and owner_id=(select auth.uid()) and not parent_managed);

-- Privileged implementations stay in a non-exposed schema. Public entrypoints
-- are invoker wrappers; every private operation checks the caller's ownership.
create schema if not exists scoutcard_internal;
grant usage on schema scoutcard_internal to authenticated;
create or replace function scoutcard_internal.owned_parent_profile_ids()
returns setof uuid language sql stable security definer set search_path='' as $$
 select p.id from public.athlete_profiles p
 where (select auth.uid()) is not null and p.owner_id=(select auth.uid()) and p.parent_managed;
$$;
revoke all on function scoutcard_internal.owned_parent_profile_ids() from public,anon;
grant execute on function scoutcard_internal.owned_parent_profile_ids() to authenticated;

drop policy if exists "owners can view cards" on public.athlete_cards;
create policy "owners can view cards" on public.athlete_cards for select to authenticated using (profile_id=(select auth.uid()) or profile_id in (select scoutcard_internal.owned_parent_profile_ids()));
drop policy if exists "owners read messages" on public.coach_messages;
create policy "owners read messages" on public.coach_messages for select to authenticated using (profile_id=(select auth.uid()) or profile_id in (select scoutcard_internal.owned_parent_profile_ids()));

drop policy if exists scoutcard_headshot_owner_read on storage.objects;
create policy scoutcard_headshot_owner_read on storage.objects for select to authenticated using (bucket_id='athlete-headshots' and ((storage.foldername(name))[1]=(select auth.uid()::text) or (storage.foldername(name))[1] in (select scoutcard_internal.owned_parent_profile_ids()::text)));
drop policy if exists scoutcard_headshot_owner_upload on storage.objects;
create policy scoutcard_headshot_owner_upload on storage.objects for insert to authenticated with check (
 bucket_id='athlete-headshots' and ((storage.foldername(name))[1]=(select auth.uid()::text) or (storage.foldername(name))[1] in (select scoutcard_internal.owned_parent_profile_ids()::text))
 and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
);
drop policy if exists scoutcard_headshot_owner_delete on storage.objects;
create policy scoutcard_headshot_owner_delete on storage.objects for delete to authenticated using (bucket_id='athlete-headshots' and ((storage.foldername(name))[1]=(select auth.uid()::text) or (storage.foldername(name))[1] in (select scoutcard_internal.owned_parent_profile_ids()::text)));

create or replace function scoutcard_internal.list_parent_athletes()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in as the parent first.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(p)-'owner_id' order by p.created_at,p.id) from public.athlete_profiles p where p.owner_id=auth.uid() and p.parent_managed),'[]'::jsonb);
end; $$;

create or replace function scoutcard_internal.save_parent_athlete(profile_id uuid, profile_data jsonb, adult_ack boolean, sharing_ack boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 account_id uuid:=auth.uid(); previous public.athlete_profiles; saved public.athlete_profiles;
 child_name text:=trim(profile_data->>'display_name'); publish boolean:=coalesce((profile_data->>'is_public')::boolean,false);
begin
 if account_id is null or not exists(select 1 from auth.users where id=account_id and email_confirmed_at is not null) then raise exception 'Sign in with the parent email link first.'; end if;
 if adult_ack is distinct from true then raise exception 'An adult parent or legal guardian must manage this account.'; end if;
 if profile_id is null or profile_id=account_id or jsonb_typeof(profile_data)<>'object' or octet_length(profile_data::text)>45000 then raise exception 'Please check the parent profile request.'; end if;
 if exists(select 1 from jsonb_object_keys(profile_data) k where k not in ('display_name','sport','graduation_year','position','accolade','highlight_url','details','headshot_path','is_public','child_age_band','expected_updated_at')) then raise exception 'Unsupported profile field.'; end if;
 if coalesce(profile_data->>'child_age_band','') not in ('under13','teen') then raise exception 'Choose your child age group, not a date of birth.'; end if;
 if child_name is null or char_length(child_name) not between 1 and 60 then raise exception 'Add a display name, such as a first name and last initial.'; end if;
 if publish and sharing_ack is distinct from true then raise exception 'Approve public sharing before publishing your child profile.'; end if;
 -- No child email, phone, address, birth date or event schedule fields.
 if jsonb_typeof(profile_data->'details') is distinct from 'object' or exists(select 1 from jsonb_object_keys(profile_data->'details') k where k not in ('team','club_team','stats','academics','bio','sport_metrics')) then raise exception 'Use only the optional parent profile fields; no private schedule or contact fields.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(account_id::text,471));
 select * into previous from public.athlete_profiles p where p.id=profile_id for update;
 if found then
  if previous.owner_id<>account_id or not previous.parent_managed then raise exception 'This child profile is not managed by your account.'; end if;
  -- A timed-out initial create can safely return the same owned record on retry.
  if profile_data->>'expected_updated_at' is null then return to_jsonb(previous)-'owner_id'; end if;
  if (profile_data->>'expected_updated_at')::timestamptz<>previous.updated_at then raise exception 'This profile changed in another tab. Reload it before saving.'; end if;
 else
  if (select count(*) from public.athlete_profiles where owner_id=account_id and parent_managed)>=10 then raise exception 'Your account has reached the 10-profile limit. Contact SCOUTCARD for help.'; end if;
 end if;
 if previous.id is null then
  insert into public.athlete_profiles(id,owner_id,parent_managed,child_age_band,parent_acknowledged_at,parent_policy_version,slug,display_name,sport,graduation_year,position,accolade,highlight_url,details,is_public,headshot_path,parent_public_consent_at)
  values(profile_id,account_id,true,profile_data->>'child_age_band',now(),'2026-10-20-parent-v1','athlete-'||replace(profile_id::text,'-',''),child_name,trim(profile_data->>'sport'),coalesce(profile_data->>'graduation_year',''),coalesce(profile_data->>'position',''),coalesce(profile_data->>'accolade',''),coalesce(profile_data->>'highlight_url',''),profile_data->'details',publish,nullif(profile_data->>'headshot_path',''),case when publish then now() else null end)
  returning * into saved;
 else
  update public.athlete_profiles p set display_name=child_name,sport=trim(profile_data->>'sport'),graduation_year=coalesce(profile_data->>'graduation_year',''),position=coalesce(profile_data->>'position',''),accolade=coalesce(profile_data->>'accolade',''),highlight_url=coalesce(profile_data->>'highlight_url',''),details=profile_data->'details',is_public=publish,child_age_band=profile_data->>'child_age_band',parent_public_consent_at=case when publish then coalesce(p.parent_public_consent_at,now()) else null end,
  headshot_path=case when profile_data ? 'headshot_path' then nullif(profile_data->>'headshot_path','') else p.headshot_path end
  where p.id=profile_id returning * into saved;
 end if;
 return to_jsonb(saved)-'owner_id';
end; $$;

create or replace function scoutcard_internal.activate_parent_card(card_code text, athlete_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare normalized text:=upper(trim(card_code)); changed integer;
begin
 if auth.uid() is null or not exists(select 1 from public.athlete_profiles p where p.id=athlete_id and p.owner_id=auth.uid() and p.parent_managed) then raise exception 'Choose a saved child profile you manage before activating.'; end if;
 if normalized is null or char_length(normalized) not between 8 and 100 then return false; end if;
 update public.athlete_cards set profile_id=athlete_id,status='active',activated_at=now() where activation_code=normalized and status='unclaimed' and profile_id is null;
 get diagnostics changed=row_count;
 return changed=1 or exists(select 1 from public.athlete_cards where activation_code=normalized and status='active' and profile_id=athlete_id);
end; $$;

create or replace function scoutcard_internal.delete_parent_athlete(athlete_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.athlete_profiles p where p.id=athlete_id and p.owner_id=auth.uid() and p.parent_managed) then raise exception 'This child profile is not managed by your account.'; end if;
 -- The UI removes files through Storage API first. Never delete Storage metadata.
 if exists(select 1 from storage.objects where bucket_id='athlete-headshots' and (storage.foldername(name))[1]=athlete_id::text) then raise exception 'Remove the child photos before deleting the profile. Retry or contact SCOUTCARD.'; end if;
 update public.athlete_cards set status='disabled' where profile_id=athlete_id;
 delete from public.athlete_profiles where id=athlete_id and owner_id=auth.uid() and parent_managed;
 return true;
end; $$;

create or replace function scoutcard_internal.unpublish_parent_athlete(athlete_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.athlete_profiles;
begin
 if auth.uid() is null then raise exception 'Sign in as the parent first.'; end if;
 update public.athlete_profiles p set is_public=false,parent_public_consent_at=null where p.id=athlete_id and p.owner_id=auth.uid() and p.parent_managed returning * into saved;
 if not found then raise exception 'This child profile is not managed by your account.'; end if;
 return to_jsonb(saved)-'owner_id';
end; $$;
revoke all on function scoutcard_internal.unpublish_parent_athlete(uuid) from public,anon;
grant execute on function scoutcard_internal.unpublish_parent_athlete(uuid) to authenticated;
create or replace function public.unpublish_parent_athlete(athlete_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select scoutcard_internal.unpublish_parent_athlete(athlete_id); $$;
revoke all on function public.unpublish_parent_athlete(uuid) from public,anon;
grant execute on function public.unpublish_parent_athlete(uuid) to authenticated;

revoke all on function scoutcard_internal.list_parent_athletes(),scoutcard_internal.save_parent_athlete(uuid,jsonb,boolean,boolean),scoutcard_internal.activate_parent_card(text,uuid),scoutcard_internal.delete_parent_athlete(uuid) from public,anon;
grant execute on function scoutcard_internal.list_parent_athletes(),scoutcard_internal.save_parent_athlete(uuid,jsonb,boolean,boolean),scoutcard_internal.activate_parent_card(text,uuid),scoutcard_internal.delete_parent_athlete(uuid) to authenticated;
create or replace function public.list_parent_athletes() returns jsonb language sql security invoker set search_path='' as $$ select scoutcard_internal.list_parent_athletes(); $$;
create or replace function public.save_parent_athlete(profile_id uuid,profile_data jsonb,adult_ack boolean,sharing_ack boolean) returns jsonb language sql security invoker set search_path='' as $$ select scoutcard_internal.save_parent_athlete(profile_id,profile_data,adult_ack,sharing_ack); $$;
create or replace function public.activate_parent_card(card_code text,athlete_id uuid) returns boolean language sql security invoker set search_path='' as $$ select scoutcard_internal.activate_parent_card(card_code,athlete_id); $$;
create or replace function public.delete_parent_athlete(athlete_id uuid) returns boolean language sql security invoker set search_path='' as $$ select scoutcard_internal.delete_parent_athlete(athlete_id); $$;
revoke all on function public.list_parent_athletes(),public.save_parent_athlete(uuid,jsonb,boolean,boolean),public.activate_parent_card(text,uuid),public.delete_parent_athlete(uuid) from public,anon;
grant execute on function public.list_parent_athletes(),public.save_parent_athlete(uuid,jsonb,boolean,boolean),public.activate_parent_card(text,uuid),public.delete_parent_athlete(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
