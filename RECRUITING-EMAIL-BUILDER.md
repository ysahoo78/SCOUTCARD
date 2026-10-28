# Recruiting email builder

## Scope

The authenticated athlete dashboard and parent dashboard offer “Write a recruiting
email.” This is a deterministic, template-based writing tool, not an email sender.
No AI dependency, API credential, telemetry, coach scraping, bulk sending, tracking
pixel, payment change, Auth redirect change or database migration is added.

The shared editor flushes pending profile changes through its existing checked
autosave path. The builder then checks the matching signed-in account, reads the
same profile's private draft through existing owner-only RLS, checks its version,
and reads only `id,slug,is_public` from the public-profile table. Private ownership
and age columns on public profiles deliberately remain API-restricted. Failed
reads, stale versions, changed accounts/selections and missing parent permission
fail closed. This feature adds no write or privileged API endpoint.

Only allowlisted, explicitly selected athlete details enter generated text.
Basics are selected initially; teams, up to three strengths, academic details,
highlight links, events and public profile links are opt-in. Unsupported sport
metric keys, private metadata, addresses, contact fields, photos and inbox messages
are not automatically copied. Text users explicitly select or type still needs
their review; this is not a sensitive-information detection service. Invalid
highlight URLs are omitted. Published links use the existing branded URL and are
rechecked at generation; they can later become unavailable if unpublished.

Introduction, event and follow-up templates use recipient/program details and a
user-supplied reason. Follow-ups require user-supplied context; events require an
actual description. Parent-managed profiles always use adult-writer language and
require confirming the selected child. Nothing invents stats, prior coach contact,
program facts, recruiting outcomes or a child's identity. Sparse profiles produce
shorter messages rather than padding with fabricated claims.

## Email draft lifetime

Email form edits, subject, body and selection choices are kept only in a JavaScript
Map in the current tab, keyed by account and profile. They survive Buy/setup hash
navigation, inline close/reopen and switching among children. They are never
written to localStorage, sessionStorage, profile JSON, the database or logs.
Changing accounts/signing out clears them. A child's deletion removes that child's
in-tab email draft. Refreshing, navigating to another document or closing the tab
loses email edits; beforeunload requests the browser's native warning. Browsers
can suppress this warning, so visible copy-before-leaving guidance is always
present. The UI never claims these email drafts are saved online.

Cross-device/resume-after-refresh email storage is not implemented. It requires
separate approval for a dedicated owner-only, per-profile table, retention and
deletion behavior, concurrency controls and a reviewed migration. Do not put
email drafts in publicly readable profile fields to avoid that migration.

## Sharing

Subject/body remain editable. Review acknowledgment resets after edits. Copy
actions use the Clipboard API and select text with manual-copy guidance when it
fails. Open in email app accepts exactly one checked recipient and an encoded
`mailto:` URL, with a conservative 1,900-character limit and copying fallback.
Opening an app is not evidence of sending or delivery; SCOUTCARD does not record
either. The user must send in their own mail app. No live email is sent by tests.

## Verification

Local unit/transport checks: `node --test work/recruiting-email.test.mjs`.
Browser harness: run `node work/serve.mjs`, open `/email-qa.html`, then select Run.
Only `/__qa/` mocked services and synthetic local fixtures are used by that page.
Existing private-draft, parent, autosave, purchase-status and onboarding suites
must continue to pass. A local mock is not proof of a real authenticated session,
actual device email-app compatibility, email sending, or deliverability. Those
remain a manual smoke test; do not request customer emails or create public test
profiles without permission.

October 27, 2026 verification: 19 recruiting-template/source-isolation unit tests,
29 synthetic email-builder browser checks, all 54 existing onboarding browser
checks, 50 private-draft SQL checks, 46 parent/card/inbox/photo SQL checks, eight
autosave-queue checks and eight purchase-status tests passed. JavaScript syntax,
asset references, URL safety and duplicate HTML ID checks also passed. Manual
Tab navigation moved from the editable email body to its review acknowledgment
with a visible focus indicator in the 390px-wide parent view. The mobile proof
image contains only explicitly fictional local test data. No live authenticated
account, customer email, payment or public test profile was used for this release.

## Rollback

Revert this release's three integration changes in `athlete-backend.js`,
`parent-account.js`, and `profile-onboarding.js`, then remove its four new runtime
files. No database rollback is required. Existing public/private profiles, cards,
links, permissions, payments and account data are unaffected. Remind users to copy
any in-tab email drafts before refreshing for a rollback or new deployment.
