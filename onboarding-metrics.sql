-- Read-only operator query. Never grant this query or auth.users to browser roles.
-- Set the cohort start to the actual onboarding deployment time for reporting.
with cohort as (
 select id from auth.users where created_at >= '2026-10-24T00:00:00Z'::timestamptz
), events as (
 select event,profile_id,owner_id from scoutcard_internal.onboarding_milestones
 where occurred_at >= '2026-10-24T00:00:00Z'::timestamptz
)
select
 (select count(*) from cohort) as accounts_created,
 (select count(*) from events where event='draft_created') as profiles_started,
 (select count(*) from events where event='profile_published') as profiles_first_published,
 (select count(distinct owner_id) from events where event='draft_created' and owner_id in(select id from cohort)) as new_accounts_with_drafts,
 (select count(distinct owner_id) from events where event='profile_published' and owner_id in(select id from cohort)) as new_accounts_with_publication;
