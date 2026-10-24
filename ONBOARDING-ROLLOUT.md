# Private-draft onboarding rollout

## Scope and data boundaries

Account creation is Supabase Auth email verification, not profile publication.
After verified individual sign-in, `save_scoutcard_draft` opens the owner’s draft.
Adult parents explicitly add children, each with a separate UUID and draft. No
child details autosave until the guardian acknowledgment is checked. Existing
self-reported age restrictions and adult-operated parent safeguards still apply;
this does not establish verified parental consent or legal compliance.

`athlete_profile_drafts` is owner-readable under RLS, with no anonymous grants
and no client INSERT/UPDATE/DELETE grants. Checked RPCs implement writes with
confirmed email, ownership, shape/length validation and version comparisons.
These drafts are not queried by public profile pages or either card resolver.
Only explicit publication updates `athlete_profiles`. Existing profile IDs,
slugs, account IDs, card associations, and payment integrations stay unchanged.

Drafts can contain unfinished/invalid optional fields, but publishing validates
them. Graduation year is optional; a nonempty year must still match 20xx. New
publications require a display name, sport, eligible account and explicit public
sharing approval. Parents also require child age band and guardian acknowledgment.

## Autosave and photos

The queue serializes operations. Ambiguous failures retain the exact operation
UUID, expected version and payload for a safe retry. A separate device’s newer
version causes an actionable conflict instead of a silent overwrite. Server
acknowledgment is required before Saved is shown. Switching children waits for
successful saving; failed saves offer retry or explicit local-discard. No form
contents are stored in browser localStorage by the production editor.

Photos use the existing bounded, compressed, metadata-stripped upload path.
Draft photo policies permit access only to the owning account’s profile folder.
Public photo access remains tied to a published profile. Draft saves deliberately
do not delete an older photo used by the published snapshot. Old versions or
interrupted uploads may remain privately stored until deletion/support cleanup.
Include draft rows, eligibility records, milestones and all profile-folder photos
in authorized data access/deletion requests. Parent profile deletion removes its
draft through a trigger; account deletion cascades draft and milestone rows.

## Privacy-respecting measurement (operator only)

No new analytics SDK, pixel, email/content telemetry or public metrics endpoint.
Account creation uses existing `auth.users.created_at`. First draft creation and
first publication use private `scoutcard_internal.onboarding_milestones` records,
with account/profile IDs and server timestamps only. Deleting a draft/profile
removes its milestones. No invented historical publication dates are backfilled.

Run `onboarding-metrics.sql` as an authorized operator. Account and profile counts
have different denominators because parents can manage multiple children. Treat
new-account cohorts separately from returning users and legacy profiles. These
are necessary operational records, disclosed on the privacy pages; they have no
automatic expiry, so privacy requests/manual retention reviews must include them.

## Deployment order and verification

1. Owner approval is required before applying the migration. Approval received
   in this chat, contingent on local tests passing. Do not create live fixtures.
2. Apply `supabase/migrations/20261024034851_private_profile_drafts.sql` in one
   transaction. It adds tables, checked RPCs, photo policies and a deletion/event
   trigger. It relaxes only the validator’s required graduation-year condition.
   The file was initially generated with the CLI; its timestamp is reconciled
   here to the version recorded by the successful live migration service call.
3. Compare aggregate IDs/slugs/card links before/after without exporting customer
   form contents. Check RLS/grants, anonymous draft reads, and security advisors.
4. Publish only the reviewed onboarding files, not the unrelated dirty worktree.
   Deploy UI after migration success; inspect the live public sign-in shell.
5. A real authenticated cross-device magic-link smoke test requires permission
   to send a test email. Do not send customer emails, charge a card, activate a
   customer card or publish a public test profile as part of this rollout.

## Rollback (non-destructive; operator action)

Restore the previous frontend commit. Keep the owner-only draft tables and photo
policies so unfinished work can be recovered; do not convert drafts into public
profiles. Revoke authenticated execution on the new public write wrappers if a
backend defect requires an emergency stop. Keep SELECT owner-only, never public.
Do not drop data tables or reset accounts/cards. Explicit publications already
made are normal profile updates and cannot be undone by frontend rollback; review
with the owner before changing them. Preserve the optional-year validator for
profiles published without a year, even if the old UI asks for one. A later fix
can re-enable the new functions after revalidation. Any destructive cleanup or
restore over live data requires separate approval.

## Local verification commands

Use the bundled Node runtime (no new production package required):
`node work/verify.mjs`, `node work/draft-session.test.mjs`,
`node work/drafts-database.test.mjs`, `node work/parent-database.test.mjs`.
The browser runner at `/onboarding-qa.html` uses `/__qa/` and a synthetic mock
transport, not the live Supabase client. The local PostgreSQL fixture runs the
actual migration and checks permissions, RPCs and public visibility. Browser
simulation and local database tests are not a live end-to-end authenticated test.
