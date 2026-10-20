# Parent-managed SCOUTCARD profiles — 2026-10-20-parent-v1

This is an adult-only workflow, not child registration and not a verified parental
consent or guardianship-identification service. A child's name/photo/statistics are
submitted by the adult, not through a child login. Do not tell a child to lie about
age or share the parent's login. The ordinary under-13 self-signup block stays.

## Operation

- Parent opens /family.html, acknowledges adult use and signs into their own email.
- One account manages up to 10 distinct child profiles, each with its own UUID,
  permanent slug, headshot folder, messages and card assignment.
- Only a display name, sport and private age band are required; no child email,
  birth date, phone, address or event-schedule fields. Other fields are optional.
- New profiles are private. Separate parent approval is required to publish.
  Publishing exposes all entered profile content to anyone with the link/NFC tap.
  It is NOT access-controlled coach-only sharing. Private links aren't public views.
- Every coach inquiry for a parent-managed profile is readable in that parent's
  dashboard. No automatic email notification exists. Senders are not verified.
- Card connection requires selecting the child and confirming their name. Codes
  already bound to another child cannot silently reassign a card. Existing NFC
  links and standalone athlete flows are unchanged.
- Unpublish is a dedicated action independent of incomplete form edits. Deletion
  unpublishes first, removes the child's Storage files using Storage API, deletes
  their profile/messages and disables connected cards. Once unpublishing succeeds,
  cleanup failure leaves the profile private and allows retry. If unpublishing
  itself fails, the interface tells the parent to check the sharing status.
  Already-issued photo URLs can last 5 minutes; backups,
  financial records and third-party copies have separate retention.

## Migration and authentication

Apply parent-accounts-setup.sql before the new frontend. owner_id replaces the
old assumption that every athlete ID is an Auth user; existing owner_id=id rows
and slugs remain. Auth deletion cascades through ownership. Before deleting an
Auth account administratively, disable all its profiles' cards and remove photos
in every owned profile-ID folder, including abandoned uploads.

The owner UUID, child age band and parental acknowledgment timestamps/version are
not granted to public API column readers. Parent-only RPCs return only that
caller's children. Public functions are SECURITY INVOKER wrappers; implementations
are in the non-exposed scoutcard_internal schema, with explicit auth/ownership
checks, fixed search_path and no anonymous execution. Normal table writes cannot
create or edit parent-managed rows. Ownership is not based on user_metadata.

Add exactly https://www.scoutcard.tech/family.html to Supabase's existing redirect
allowlist. Keep existing root/activation/legacy entries and Site URL unchanged.
Parent emails return to the canonical branded domain. No new email provider or
paid dependency is required. Parent acknowledgment is self-reported; email sign-in
verifies access to the mailbox, not adult identity or legal guardianship.

## Verification and known limits

- Applied the migration to live SCOUTCARD after explicit owner approval. Verified
  that all 4 existing profiles retained ownership, and RLS remains enabled.
- Local PGlite/PostgreSQL tests cover migration reruns, legacy athlete writes,
  private metadata access, family isolation, consent, stable links, stale saves,
  card claims/retries/sibling conflicts, inbox isolation, photo ownership,
  deletion with disabled cards, and the 10-profile cap. No real child data used.
- Browser fixtures cover parent sign-in return URL, two-child editing, private
  defaults, publishing, photos, card assignment, messages, failed requests,
  unpublish/delete/retry and sign-out. Existing individual athlete and responsive
  page regressions also pass. These use mock authentication/API responses, not a
  live parent email sign-in or a real child's card activation.
- The Supabase security advisor reports existing public SECURITY DEFINER RPCs
  used for card lookup, orders and coach inquiries, plus password-leak protection
  disabled on this magic-link app. This feature adds no anonymous parent RPCs.
  Server-only RLS tables intentionally have no browser-access policies. These
  notices are not a certification that the rest of the service is risk-free.
- The separate Supabase Test project stays paused. No payments, test emails,
  production child profiles, or new physical card codes were created for QA.

## Launch/review boundary

Technical safeguards do not certify COPPA or state-law compliance. Obtain review
of the actual adult-only collection model, direct notice, public sharing choices,
data-processing arrangements and handling of known child use before expanding the
service to collect information FROM under-13 children. Do not enable child
accounts on the basis of this acknowledgment. Have counsel review this parent
workflow before broad promotion to families with under-13 children.

Sources used:
- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/
