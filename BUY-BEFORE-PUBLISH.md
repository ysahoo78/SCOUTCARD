# Buy before publishing — October 25, 2026

## Scope

Buying and publishing are independent. Checkout still requires the same adult
purchaser and terms acknowledgments. No schema, RLS, age, parent-permission,
payment-processing, activation or permanent-link changes were made.

- Buying form, setup roadmap, Gameplan, FAQ and parent guidance explicitly allow
  purchasing with an unfinished/private draft or before starting a profile.
- A secondary shared athlete/parent draft panel says Saved only after a confirmed
  server draft load/save; edits immediately remove that wording. Purchase links
  flush partial drafts first, prevent duplicate navigation, and retain failed
  edits. The order submit and resume link also honor unsaved changes.
- Parent return navigation remembers only owner/profile identifiers in essential
  session storage. It restores a valid selection, never claims a sibling, and
  clears visible private state on sign-out.
- Minimum publishing fields: display name and sport, confirmed eligible account,
  required sharing approval and existing teen/guardian permission. Parent-managed
  publishing also requires the child's age group and guardian acknowledgment.
  Existing validation of optional fields and uploaded content remains in place.
- Activated-card queries suppress repeated purchase prompts. A small read-only
  authenticated `/api/purchase-status` endpoint checks the Auth-verified email
  against settled order records (`paid`, `shipped`, `fulfilled` with `paid_at`).
  It returns only a boolean, not order details, addresses, email or card codes.
  The endpoint validates the token with Supabase Auth, not untrusted client
  claims; it rejects user-supplied query parameters, has bounded upstream reads
  and private/no-store responses, and writes nothing. It reuses existing server
  Supabase settings; no new secret or direct client table permission is added.
- A confirmed parent order is account-wide, NOT automatically allocated to a
  child. Sibling prompts explain this and require separate cards/private codes.
- Unlinked cash orders and other-email orders cannot be inferred. Unknown status,
  timeout or backend errors never claim payment succeeded or prove no purchase;
  the UI keeps the don't-pay-again warning. No persistent purchase tracking added.

## Stripe confirmation message — deferred by owner

The current live Payment Link uses Stripe's hosted confirmation page with its
default message. The owner asked to leave its text update for later after Stripe
write authentication and dashboard sign-in were unavailable. No Stripe settings
were changed and no charges were made. Suggested custom confirmation text:

> Next: start or continue your private profile at
> https://www.scoutcard.tech/#setup. Parents:
> https://www.scoutcard.tech/family.html. Publish a basic profile when ready;
> optional details can wait. Once you receive the physical card, activate it
> with the private code supplied with your card or directly by SCOUTCARD.
> Each child needs a separate profile, card and code. Buying does not publish
> a profile or activate a card. Already bought a card? Don't pay again.
> Questions: scout.card26@gmail.com.

The website's pre-checkout guidance explains these steps conditionally. It does
not add a fake first-party success page, infer payment from a URL, or promise
automatic activation-code emails. Existing signed-webhook settlement stays intact.

## Verification boundaries

Browser checks use only the isolated local synthetic transport. Unit tests call
the purchase-status handler with synthetic Auth/order responses. PostgreSQL
draft/parent suites use local PGlite, not the live database. No customer email,
charge, live test profile, live activation or migration is part of this work.
An authorized real-account post-purchase smoke test remains separate.

Deployment and final test results are recorded in the completion handoff. Only
this change's files should be published; preserve unrelated dirty local work.

## Rollback

Revert only this release's code commit; there is no database rollback. The new
purchase-status read endpoint can be removed with its two client imports if
necessary. Failure to read purchase status already falls back to the explicit
unknown-status warning. The Stripe confirmation setting was not changed.
