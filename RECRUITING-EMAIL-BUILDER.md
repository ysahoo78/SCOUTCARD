# Recruiting email builder

## Top navigation

The four primary header actions are Set Up Profile, Buy The Card, Activate The
Card and Send An Email. The last action opens `index.html#email`: a focused
introduction, existing sign-in controls and the authenticated builder, without
the long profile editor. Profile form fields remain mounted so same-page
navigation does not discard entered data. Set Up Profile restores the editor.
This route is not payment evidence and never sends an email automatically.

Parents use `family.html#email`, sign in as the adult and select the correct
child before opening the builder. Parent activation stays in the selected
child's dashboard, not the individual-athlete activation form. Existing Auth
return URLs and age/guardian eligibility requirements are unchanged. After a
magic-link return, users can select Send An Email again from the same header.

Navigation verification: 16 layouts across 320/390/768/1280px and the four core
pages passed, with four visible 44px+ keyboard links and no horizontal overflow.
All 38 recruiting-email, 54 onboarding browser and 45 automated tests passed.

## Scope

The authenticated athlete dashboard and parent dashboard offer “Write a recruiting
email.” This is a deterministic, template-based writing tool, not an email sender.
No AI dependency, new API credential, telemetry, coach scraping, bulk sending,
tracking pixel, payment mutation, Auth redirect change or database migration is added.

## Paid access

The UI checks `/api/purchase-status` before opening. Generation itself now runs
only in `api/recruiting-email.js`, not in the browser. Every generation request
verifies the bearer token with Supabase Auth, requires a confirmed nonanonymous
email account, then checks trusted `card_orders` for that verified email, status
`paid`, `shipped` or `fulfilled`, and a non-null `paid_at`. The browser cannot
supply an email, payment flag, owner ID or profile snapshot to bypass this check.
Unknown payment status fails closed. Auth and order responses are not cached.

Cash/Zelle sales must be verified by an operator and recorded as settled orders
under the customer's normalized verified sign-in email before access works.
Neither owning/activating a card nor claiming to have paid grants access. Buyers
using another checkout email need operator matching; they must not pay again.
This release does not create or alter any actual order or payment record.

Access is account-level: a paid parent can select each child they manage, with
existing per-child isolation and guardian acknowledgments. This does not assign
a physical card to every child; each card/profile association remains separate.

Refunded/canceled orders do not qualify **when recorded with those statuses**.
The existing checkout webhook does not automatically synchronize later Stripe
refunds/disputes; operators must update the trusted order status when applicable.
Automating that separate payment-lifecycle integration is not part of this change.

The shared editor flushes pending profile changes through its existing checked
autosave path. The builder then checks the matching signed-in account, reads the
same profile's private draft through existing owner-only RLS, checks its version,
and reads only `id,slug,is_public` from the public-profile table. Private ownership
and age columns on public profiles deliberately remain API-restricted. Failed
reads, stale versions, changed accounts/selections and missing parent permission
fail closed. The generation API independently reads the selected owner's draft
with the user bearer token (existing RLS), verifies its version and age/guardian
eligibility, and rechecks publication. Only the order lookup uses service-role
authorization. No profile/order writes are performed. The existing server key
stays in Vercel environment settings and is never returned to the browser.

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

Local unit/transport checks: `node --test work/recruiting-email.test.mjs work/recruiting-paid.test.mjs work/purchase-status.test.mjs`.
Browser harness: run `node work/serve.mjs`, open `/email-qa.html`, then select Run.
Only `/__qa/` mocked services and synthetic local fixtures are used by that page.
The local harness calls the real generation handler with fixture-only upstream
responses; it never connects to the live database.
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

For the paid-gate update, revert its changed files to the preceding release;
no database rollback is required. Doing so makes generation free again, so prefer
temporarily disabling the builder rather than removing payment enforcement.
Existing public/private profiles, cards, links, permissions, payments and account
data are unaffected. Remind users to copy any in-tab email drafts before refreshing.

Paid-gate verification, October 27: 45 automated tests and 33 synthetic mobile
browser checks passed. These cover paid/unpaid accounts, cash-order records,
expired sign-in, unknown payment status, server failures, direct-call bypasses,
stale versions, parent permissions, sibling isolation and payment revocation.
No real charge, customer email, public test profile or live database write was used.
