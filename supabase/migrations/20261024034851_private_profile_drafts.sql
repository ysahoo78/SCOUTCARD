-- Private onboarding drafts. Applied to LIVE with owner approval on 2026-10-24 UTC.
-- Filename reconciled to the version recorded by the Supabase migration service.
-- Existing profile IDs, slugs, cards, public resolvers and Auth accounts are not migrated.
begin;
create table if not exists public.athlete_profile_drafts (
 profile_id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 parent_managed boolean not null,
 payload jsonb not null default '{}',
 eligibility jsonb not null default '{}',
 step integer not null default 0 check(step between 0 and 4),
 version integer not null default 1 check(version > 0),
 last_request_id uuid not null,
 base_profile_updated_at timestamptz,
 published_version integer,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint draft_identity check((parent_managed and profile_id<>owner_id) or (not parent_managed and profile_id=owner_id)),
 constraint draft_object check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=45000)
);
create index if not exists athlete_drafts_owner_idx on public.athlete_profile_drafts(owner_id,parent_managed,updated_at desc,profile_id);
alter table public.athlete_profile_drafts enable row level security;
revoke all on public.athlete_profile_drafts from public,anon,authenticated;
grant select on public.athlete_profile_drafts to authenticated;
drop policy if exists "owners read private drafts" on public.athlete_profile_drafts;
create policy "owners read private drafts" on public.athlete_profile_drafts for select to authenticated using(owner_id=(select auth.uid()));

-- No contact details, form contents or third-party tracking. Account creation
-- is measured from the existing auth.users.created_at, not a new Auth trigger.
create table if not exists scoutcard_internal.onboarding_milestones (
 profile_id uuid not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 event text not null check(event in ('draft_created','profile_published')),
 occurred_at timestamptz not null default now(),
 primary key(profile_id,event)
);
create index if not exists onboarding_milestones_owner_idx on scoutcard_internal.onboarding_milestones(owner_id,occurred_at);
alter table scoutcard_internal.onboarding_milestones enable row level security;
revoke all on scoutcard_internal.onboarding_milestones from public,anon,authenticated;

create or replace function scoutcard_internal.check_draft_payload(data jsonb, managed boolean, athlete_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare k text; limits jsonb:='{"display_name":60,"sport":40,"graduation_year":4,"position":80,"accolade":200,"highlight_url":1000,"child_age_band":10}'; detail_limits jsonb:='{"team":120,"club_team":120,"stats":2000,"academics":1000,"events":2000,"bio":1500}';
begin
 if jsonb_typeof(data) is distinct from 'object' or octet_length(data::text)>45000 then raise exception 'Draft must be a small profile object.'; end if;
 if exists(select 1 from jsonb_object_keys(data) x where x not in ('display_name','sport','graduation_year','position','accolade','highlight_url','child_age_band','headshot_path','details')) then raise exception 'Unsupported draft field.'; end if;
 for k in select jsonb_object_keys(limits) loop
  if data ? k and (jsonb_typeof(data->k)<>'string' or char_length(data->>k)>(limits->>k)::integer) then raise exception 'Please shorten the draft field: %',k; end if;
 end loop;
 if data ? 'headshot_path' and data->'headshot_path'<>'null'::jsonb and
  (jsonb_typeof(data->'headshot_path')<>'string' or split_part(data->>'headshot_path','/',1)<>athlete_id::text or data->>'headshot_path' !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') then raise exception 'Use a headshot belonging to this profile.'; end if;
 if data ? 'details' then
  if jsonb_typeof(data->'details') is distinct from 'object' then raise exception 'Draft details must be an object.'; end if;
  for k in select jsonb_object_keys(data->'details') loop
   if k='sport_metrics' then
    if jsonb_typeof(data->'details'->k) is distinct from 'object' then raise exception 'Sport results must be an object.'; end if;
    if (select count(*) from jsonb_each(data->'details'->k))>12 or exists(select 1 from jsonb_each(data->'details'->k) m where m.key !~ '^[a-z][a-z0-9_]{0,39}$' or jsonb_typeof(m.value)<>'string' or char_length(m.value#>>'{}')>120) then raise exception 'Sport results must be short text values.'; end if;
   elsif not(detail_limits ? k) or (managed and k='events') or jsonb_typeof(data->'details'->k)<>'string' or char_length(data->'details'->>k)>(detail_limits->>k)::integer then
    raise exception 'Use only the allowed profile details; no private contact or child schedule fields.';
   end if;
  end loop;
 end if;
end; $$;
revoke all on function scoutcard_internal.check_draft_payload(jsonb,boolean,uuid) from public,anon,authenticated;

create or replace function scoutcard_internal.save_scoutcard_draft(athlete_id uuid,managed boolean,draft_data jsonb,draft_step integer,expected_version integer,operation_id uuid,eligibility jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); d public.athlete_profile_drafts; p public.athlete_profiles; seed jsonb; context jsonb:=eligibility;
begin
 if account_id is null or not exists(select 1 from auth.users where id=account_id and email_confirmed_at is not null) then raise exception 'Confirm your email and sign in before saving a draft.'; end if;
 if athlete_id is null or managed is null or operation_id is null or draft_step is null or draft_step not between 0 and 4 or jsonb_typeof(context) is distinct from 'object' then raise exception 'Please check the draft request.'; end if;
 if octet_length(context::text)>500 or exists(select 1 from jsonb_object_keys(context) k where k not in ('band','permission','parent_ack')) or (context ? 'permission' and jsonb_typeof(context->'permission')<>'boolean') or (context ? 'parent_ack' and jsonb_typeof(context->'parent_ack')<>'boolean') then raise exception 'Eligibility must contain only the age band and permission choices.';end if;
 if managed then
  if athlete_id=account_id or context->>'band' is distinct from 'adult' then raise exception 'An adult parent or guardian must manage child drafts.'; end if;
 else
  if athlete_id<>account_id or coalesce(context->>'band','') not in ('adult','teen') or (context->>'band'='teen' and context->'permission' is distinct from 'true'::jsonb) then raise exception 'Individual accounts require age 13+ and parent permission for teens.'; end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text,472));
 select * into p from public.athlete_profiles where id=athlete_id;
 if found and (p.owner_id<>account_id or p.parent_managed<>managed) then raise exception 'This profile belongs to a different account or setup path.'; end if;
 select * into d from public.athlete_profile_drafts where profile_id=athlete_id for update;
 if found then
  if d.owner_id<>account_id or d.parent_managed<>managed then raise exception 'This draft is not yours.'; end if;
  if expected_version is null then return to_jsonb(d); end if;
  if d.last_request_id=operation_id then return to_jsonb(d); end if;
  if d.version<>expected_version then raise exception using errcode='40001',message='This draft changed on another device. Reload saved draft before editing again; your local edits have not been overwritten.'; end if;
 else
  if expected_version is not null then raise exception 'Draft no longer exists. Reload before saving.'; end if;
  if managed and (select count(*) from (select id from public.athlete_profiles where owner_id=account_id and parent_managed union select profile_id from public.athlete_profile_drafts where owner_id=account_id and parent_managed) children)>=10 then raise exception 'Your account has reached the 10-profile limit.'; end if;
  seed:='{}';
  if p.id is not null then
   seed:=jsonb_build_object('display_name',p.display_name,'sport',coalesce(p.sport,''),'graduation_year',coalesce(p.graduation_year,''),'position',coalesce(p.position,''),'accolade',coalesce(p.accolade,''),'highlight_url',coalesce(p.highlight_url,''),'details',p.details,'headshot_path',p.headshot_path);
   if managed then seed:=seed||jsonb_build_object('child_age_band',p.child_age_band);context:=context||jsonb_build_object('parent_ack',p.parent_acknowledged_at is not null);end if;
  end if;
  insert into public.athlete_profile_drafts(profile_id,owner_id,parent_managed,payload,eligibility,step,last_request_id,base_profile_updated_at,published_version)
  values(athlete_id,account_id,managed,seed,context,0,operation_id,p.updated_at,case when p.is_public then 1 else null end) returning * into d;
  insert into scoutcard_internal.onboarding_milestones(profile_id,owner_id,event) values(athlete_id,account_id,'draft_created') on conflict do nothing;
  return to_jsonb(d);
 end if;
 perform scoutcard_internal.check_draft_payload(draft_data,managed,athlete_id);
 if managed and context->'parent_ack' is distinct from 'true'::jsonb then raise exception 'Acknowledge that you are this child’s adult parent or guardian before saving child details.'; end if;
 update public.athlete_profile_drafts set payload=draft_data,step=draft_step,eligibility=context,version=d.version+1,last_request_id=operation_id,updated_at=clock_timestamp() where profile_id=athlete_id returning * into d;
 return to_jsonb(d);
end; $$;
revoke all on function scoutcard_internal.save_scoutcard_draft(uuid,boolean,jsonb,integer,integer,uuid,jsonb) from public,anon;
grant execute on function scoutcard_internal.save_scoutcard_draft(uuid,boolean,jsonb,integer,integer,uuid,jsonb) to authenticated;
create or replace function public.save_scoutcard_draft(athlete_id uuid,managed boolean,draft_data jsonb,draft_step integer,expected_version integer,operation_id uuid,eligibility jsonb)
returns jsonb language sql security invoker set search_path='' as $$select scoutcard_internal.save_scoutcard_draft(athlete_id,managed,draft_data,draft_step,expected_version,operation_id,eligibility);$$;
revoke all on function public.save_scoutcard_draft(uuid,boolean,jsonb,integer,integer,uuid,jsonb) from public,anon;
grant execute on function public.save_scoutcard_draft(uuid,boolean,jsonb,integer,integer,uuid,jsonb) to authenticated;

create or replace function scoutcard_internal.publish_scoutcard_draft(athlete_id uuid,expected_version integer,sharing_ack boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid();d public.athlete_profile_drafts;p public.athlete_profiles;saved public.athlete_profiles;v jsonb;
begin
 if account_id is null or not exists(select 1 from auth.users where id=account_id and email_confirmed_at is not null) then raise exception 'Sign in before publishing.'; end if;
 if sharing_ack is distinct from true then raise exception 'Review and approve public sharing before publishing.'; end if;
 select * into d from public.athlete_profile_drafts where profile_id=athlete_id for update;
 if not found or d.owner_id<>account_id then raise exception 'This draft is not yours.';end if;
 if d.version is distinct from expected_version then raise exception using errcode='40001',message='This draft changed on another device. Reload saved draft before publishing.';end if;
 select * into p from public.athlete_profiles where id=athlete_id for update;
 if p.id is not null and (p.owner_id<>account_id or p.parent_managed<>d.parent_managed) then raise exception 'This profile is not yours.';end if;
 if d.published_version=d.version and p.is_public and p.updated_at is not distinct from d.base_profile_updated_at then return jsonb_build_object('profile',to_jsonb(p)-'owner_id','draft',to_jsonb(d));end if;
 if p.updated_at is distinct from d.base_profile_updated_at then raise exception using errcode='40001',message='The saved profile changed in another tab. Your private draft is safe; reload or contact SCOUTCARD before publishing.';end if;
 v:=d.payload;perform scoutcard_internal.check_draft_payload(v,d.parent_managed,athlete_id);
 if coalesce(char_length(trim(v->>'display_name')),0) not between 1 and 60 or coalesce(char_length(trim(v->>'sport')),0) not between 1 and 40 then raise exception 'Add a display name and sport before publishing.';end if;
 if d.parent_managed and (d.eligibility->'parent_ack' is distinct from 'true'::jsonb or coalesce(v->>'child_age_band','') not in ('under13','teen')) then raise exception 'Choose the child age group and confirm your parent or guardian acknowledgment.';end if;
 if not d.parent_managed and (coalesce(d.eligibility->>'band','') not in ('adult','teen') or (d.eligibility->>'band'='teen' and d.eligibility->'permission' is distinct from 'true'::jsonb)) then raise exception 'Check account age eligibility before publishing.';end if;
 if p.id is null then
  insert into public.athlete_profiles(id,owner_id,parent_managed,slug,display_name,sport,graduation_year,position,accolade,highlight_url,details,is_public,headshot_path,child_age_band,parent_acknowledged_at,parent_public_consent_at,parent_policy_version)
  values(athlete_id,account_id,d.parent_managed,'athlete-'||replace(athlete_id::text,'-',''),trim(v->>'display_name'),trim(v->>'sport'),coalesce(v->>'graduation_year',''),coalesce(v->>'position',''),coalesce(v->>'accolade',''),coalesce(v->>'highlight_url',''),coalesce(v->'details','{}'),true,nullif(v->>'headshot_path',''),case when d.parent_managed then v->>'child_age_band' end,case when d.parent_managed then now() end,case when d.parent_managed then now() end,case when d.parent_managed then '2026-10-23-parent-drafts-v1' end) returning * into saved;
 else
  update public.athlete_profiles set display_name=trim(v->>'display_name'),sport=trim(v->>'sport'),graduation_year=coalesce(v->>'graduation_year',''),position=coalesce(v->>'position',''),accolade=coalesce(v->>'accolade',''),highlight_url=coalesce(v->>'highlight_url',''),details=coalesce(v->'details','{}'),headshot_path=nullif(v->>'headshot_path',''),is_public=true,
   child_age_band=case when d.parent_managed then v->>'child_age_band' end,parent_public_consent_at=case when d.parent_managed then coalesce(parent_public_consent_at,now()) end
  where id=athlete_id returning * into saved;
 end if;
 update public.athlete_profile_drafts set base_profile_updated_at=saved.updated_at,published_version=version where profile_id=athlete_id returning * into d;
 return jsonb_build_object('profile',to_jsonb(saved)-'owner_id','draft',to_jsonb(d));
end;$$;
revoke all on function scoutcard_internal.publish_scoutcard_draft(uuid,integer,boolean) from public,anon;
grant execute on function scoutcard_internal.publish_scoutcard_draft(uuid,integer,boolean) to authenticated;
create or replace function public.publish_scoutcard_draft(athlete_id uuid,expected_version integer,sharing_ack boolean) returns jsonb language sql security invoker set search_path='' as $$select scoutcard_internal.publish_scoutcard_draft(athlete_id,expected_version,sharing_ack);$$;
revoke all on function public.publish_scoutcard_draft(uuid,integer,boolean) from public,anon;
grant execute on function public.publish_scoutcard_draft(uuid,integer,boolean) to authenticated;

create or replace function scoutcard_internal.unpublish_scoutcard_profile(athlete_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.athlete_profiles;d public.athlete_profile_drafts;
begin
 if auth.uid() is null then raise exception 'Sign in before unpublishing.';end if;
 update public.athlete_profiles set is_public=false,parent_public_consent_at=null where id=athlete_id and owner_id=auth.uid() returning * into p;
 if not found then raise exception 'This saved profile is not yours.';end if;
 update public.athlete_profile_drafts set base_profile_updated_at=p.updated_at,published_version=null where profile_id=athlete_id and owner_id=auth.uid() returning * into d;
 return jsonb_build_object('profile',to_jsonb(p)-'owner_id','draft',to_jsonb(d));
end;$$;
revoke all on function scoutcard_internal.unpublish_scoutcard_profile(uuid) from public,anon;
grant execute on function scoutcard_internal.unpublish_scoutcard_profile(uuid) to authenticated;
create or replace function public.unpublish_scoutcard_profile(athlete_id uuid) returns jsonb language sql security invoker set search_path='' as $$select scoutcard_internal.unpublish_scoutcard_profile(athlete_id);$$;
revoke all on function public.unpublish_scoutcard_profile(uuid) from public,anon;
grant execute on function public.unpublish_scoutcard_profile(uuid) to authenticated;

-- A profile deletion must not leave a private draft that could resurrect it.
create or replace function scoutcard_internal.delete_scoutcard_draft(athlete_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.athlete_profile_drafts where profile_id=athlete_id and owner_id=auth.uid()) then raise exception 'This draft is not yours.';end if;
 if exists(select 1 from public.athlete_profiles where id=athlete_id) then raise exception 'Use the saved-profile deletion process instead.';end if;
 if exists(select 1 from storage.objects where bucket_id='athlete-headshots' and split_part(name,'/',1)=athlete_id::text) then raise exception 'Remove this draft’s stored photos before deleting it.';end if;
 delete from public.athlete_profile_drafts where profile_id=athlete_id and owner_id=auth.uid();
 delete from scoutcard_internal.onboarding_milestones where profile_id=athlete_id and owner_id=auth.uid();
 return true;
end;$$;
revoke all on function scoutcard_internal.delete_scoutcard_draft(uuid) from public,anon;
grant execute on function scoutcard_internal.delete_scoutcard_draft(uuid) to authenticated;
create or replace function public.delete_scoutcard_draft(athlete_id uuid) returns boolean language sql security invoker set search_path='' as $$select scoutcard_internal.delete_scoutcard_draft(athlete_id);$$;
revoke all on function public.delete_scoutcard_draft(uuid) from public,anon;
grant execute on function public.delete_scoutcard_draft(uuid) to authenticated;

create or replace function scoutcard_internal.onboarding_profile_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  delete from public.athlete_profile_drafts where profile_id=old.id and owner_id=old.owner_id;
  delete from scoutcard_internal.onboarding_milestones where profile_id=old.id and owner_id=old.owner_id;
  return old;
 end if;
 if new.is_public and (tg_op='INSERT' or not old.is_public) then
  insert into scoutcard_internal.onboarding_milestones(profile_id,owner_id,event) values(new.id,new.owner_id,'profile_published') on conflict do nothing;
 end if;
 return new;
end;$$;
revoke all on function scoutcard_internal.onboarding_profile_event() from public,anon,authenticated;
drop trigger if exists scoutcard_onboarding_event on public.athlete_profiles;
create trigger scoutcard_onboarding_event after insert or update or delete on public.athlete_profiles for each row execute function scoutcard_internal.onboarding_profile_event();

-- Photos belonging to a parent-owned draft stay private even before publication.
drop policy if exists scoutcard_draft_photo_read on storage.objects;
create policy scoutcard_draft_photo_read on storage.objects for select to authenticated using(bucket_id='athlete-headshots' and (storage.foldername(name))[1] in (select profile_id::text from public.athlete_profile_drafts where owner_id=(select auth.uid())));
drop policy if exists scoutcard_draft_photo_upload on storage.objects;
create policy scoutcard_draft_photo_upload on storage.objects for insert to authenticated with check(bucket_id='athlete-headshots' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and (storage.foldername(name))[1] in (select profile_id::text from public.athlete_profile_drafts where owner_id=(select auth.uid())));
drop policy if exists scoutcard_draft_photo_delete on storage.objects;
create policy scoutcard_draft_photo_delete on storage.objects for delete to authenticated using(bucket_id='athlete-headshots' and (storage.foldername(name))[1] in (select profile_id::text from public.athlete_profile_drafts where owner_id=(select auth.uid())));

-- Graduation year is optional when not applicable. Keep every other validator.
do $$ declare source text:=pg_get_functiondef('public.validate_scoutcard_profile()'::regprocedure); old_rule text:='(coalesce(new.graduation_year,'''') !~ ''^20[0-9]{2}$'' and (not new.parent_managed or coalesce(new.graduation_year,'''')<>''''))'; new_rule text:='(coalesce(new.graduation_year,'''')<>'''' and new.graduation_year !~ ''^20[0-9]{2}$'')';
begin
 if position(old_rule in source)>0 then execute replace(source,old_rule,new_rule);
 elsif position(new_rule in source)=0 then raise exception 'Profile validator changed; review the graduation-year adjustment before applying.';end if;
end;$$;
notify pgrst,'reload schema';
commit;
