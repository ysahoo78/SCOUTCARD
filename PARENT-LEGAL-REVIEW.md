# Parent-account privacy and flow review — October 20, 2026

This is an implementation/review record, not an attorney opinion or a compliance
certification. Do not advertise "COPPA compliant" or "verified parents" based on
an adult-use checkbox or email sign-in.

## Implemented

- Adult-only entry, own adult email, no child Auth account or child email field.
- A plain-language parent privacy notice is linked before sign-in and child data
  entry, in the editor, and from privacy, terms and deletion-help pages.
- Notice explains required/optional fields, purpose, private age band and parent
  acknowledgments, providers, public disclosure, unverified senders, no automatic
  message emails, retention, access/correction/removal and operator contact.
- Public sharing is separate from account access and private saving. Publishing
  makes included content available to anyone with the URL/NFC link, not a
  verified-coach audience. Private storage is not a promise of no operator access.
- Parent controls include editing, immediate unpublishing, per-child deletion
  through Storage API cleanup, and disabling connected cards. Instructions for
  account-wide requests and data copies remain available without a new login.
- Child profiles/cards/inboxes and photo folders use explicit owner checks. No
  schema/access grants were broadened during this follow-up review.
- Dashboard states explain saving, publishing and activation separately. Existing
  payment does not require a second purchase. Returning one-child accounts open
  the saved child automatically; family-load failures cannot start duplicate
  profiles blindly. Sign-out clears child names and links from hidden DOM too.
- No child drafts or activation codes are stored by the adult-entry choice.
  No advertising/analytics SDK is added to the dashboard. Fonts and client SDK
  are first-party hosted; videos remain external links rather than embeds.

## Operator responsibilities / not finished by code

1. Have a qualified US/Virginia privacy attorney review actual service use,
   marketing, age screening, state-law applicability and the adult-entered model.
   FTC guidance distinguishes information supplied by adults from collection
   directly from children. A label or checkbox is not a substitute for applicable
   requirements if children actually use the service.
2. If direct under-13 use is discovered, investigate and restrict that use, assess
   prompt unpublishing, and follow the privacy-request checklist. Do not tell the
   child to choose an older age or use/share the parent's login. Do not enable
   direct child collection on a checkbox alone; obtain legal review of any
   required notice/verifiable-consent process first.
3. Monitor scout.card26@gmail.com and spam for requests and abuse reports.
   Authenticate authority before disclosures/changes; record outcomes privately.
   Review disputes instead of automatically giving another adult ownership.
4. Use child data only to operate the requested profile/card/inbox. Review ongoing
   necessity; remove data when no longer needed, subject to justified retention.
   There is no automated inactive-child deletion policy. Do not promise a fixed
   expiry or perform a bulk deletion without an approved retention plan.
5. Review providers' terms/data-processing arrangements and actual retention/log
   settings. Resend is disclosed for account email delivery. Confirm any printer
   before sending personal data; a printer has not been named in this project.
6. No public business mailing address/phone has been provided. Do not invent
   either, expose a home address, or claim statutory notices are complete when
   legal review requires additional operator contact information.
7. Test one actual parent's email return and intentional profile/card activation
   with that parent. Local tests use synthetic accounts; they do not verify legal
   guardianship, real email deliverability or acceptance of legal terms.

## Sources consulted

- FTC COPPA FAQ, especially A.8 (adult-supplied information) and A.12 (actual child
  use): https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC current rule materials (including amended-rule notice):
  https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
- Virginia Consumer Data Protection Act, including scope, rights, sensitive data
  and known-child requirements: https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/
- Supabase email-link return/session guidance:
  https://supabase.com/docs/guides/auth/auth-email-passwordless

These sources inform safeguards and the remaining review questions; they do not
establish that every law applies or that every obligation has been fulfilled.

## Subsequent owner-directed completion work

The owner confirmed operations in both areas and no completed business/name/tax
registrations. LEGAL-HANDOFF.md contains the location-specific official filing
links, unknowns and owner/professional actions; COMPLIANCE-OPERATIONS.md contains
prepared operating procedures, not fabricated completion evidence. New website
controls provide selected-child saved-profile downloads and safety-reporting
links. Parent-managed public rendering asks cooperating search engines not to
index it; that is not access control. Unused camera/microphone/geolocation browser
APIs are disabled through the deployment Permissions-Policy. The owner chose to
remove the entire Raymond testimonial, portrait display and star rating, then
clarified the request later the same day. The previously approved recommendation,
portrait and rating are restored with a personal-connection disclosure and a
clarification that this is not UVA's endorsement. Permission and photo-license
evidence still belong in business records.
