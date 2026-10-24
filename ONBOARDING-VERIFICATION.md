# Onboarding verification — 2026-10-24 UTC

## Confirmed

- 31 synthetic browser checks passed at 390px iframe width: account first,
  duplicate sign-in/publish clicks, interrupted sign-in, blank draft creation,
  short Basics, skip/back/next, actual full reload/resume, optional YouTube link,
  failed saves and retries, ambiguous-response idempotency, explicit publication,
  private edits to published profiles, unpublish/republish, sign-out clearing,
  multiple child drafts, duplicate Add a child clicks during saving,
  guardian/age choice restoration, failed-save switching,
  selected-child card activation and mobile overflow checks.
- 44 checks using the actual migration in synthetic local PostgreSQL passed:
  grants/RLS, anonymous and cross-account denial, empty/partial drafts, confirmed
  email and age restrictions, permission shape minimization, version conflicts
  and competing device writes, stable slugs, explicit sharing consent, parent
  isolation, photo access, draft deletion and private milestone access.
- 8 isolated autosave-queue checks passed, including duplicate flushes, timeouts,
  edits during in-flight saves/photo preparation, stale-account responses and
  refusing an unconfirmed save response.
- Existing 46-check parent/database/card/inbox/photo/ownership suite passed.
- Syntax, linked assets, duplicate HTML IDs and URL/timeout utility checks passed.
- Manual keyboard check: Enter activated Back; Tab moved from name to sport,
  with visible focus outline and no horizontal overflow at 390 × 844.

## Live database rollout

Owner approval was received before applying the migration. The successful
Supabase migration is version `20261024034851`, name `private_profile_drafts`.
Before/after checks matched: 10 Auth accounts, 4 athlete profiles, 11 cards and
4 orders. Whole-row aggregate fingerprints for existing profiles and cards were
unchanged. No live test data was inserted.

RLS is enabled, anonymous SELECT and publish execution are denied, authenticated
direct INSERT is denied, and the sole draft SELECT policy is owner-only. A real
unauthenticated HTTP read to the draft REST endpoint returned 401 / PostgreSQL
42501 “permission denied for table athlete_profile_drafts.”

Security advisor comparison found no new WARN-level issue from this migration.
Its new informational “RLS enabled, no policy” finding is intentional for the
internal, API-revoked milestones table. Existing public card/order/message RPC
warnings and password-protection advisory remain outside this change; see
https://supabase.com/docs/guides/database/database-linter for explanations.

## Limits and remaining smoke test

The browser uses a synthetic transport; SQL tests separately execute real
PostgreSQL constraints/functions. These do not establish a live authenticated
end-to-end result. No real sign-in email was requested, no charge was made, and
no live test profile/card activation was published. One authorized real-account
magic-link + cross-device draft-resume smoke test remains advisable. Public
production asset/deployment verification is recorded separately in the handoff.

The initial release `e29d416ee34bec7825144f76e2e538f64d95dffc` received Vercel’s
“Deployment has completed” status for `yash-sahoo/scoutcard`. Its onboarding
module was fetched successfully from `https://www.scoutcard.tech/`. Direct
Vercel deployment-detail access returned a team-scope 403, so deployment status
was checked through the existing GitHub/Vercel integration instead. A follow-up
release adds a guarded parent switch during saves and clearer roadmap wording;
the 31-browser-check result above includes those changes.

Existing parent safeguards are preserved, not newly certified as legally
compliant. No university marks, marketing claims or payment flows were rebuilt.
