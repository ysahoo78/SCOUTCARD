# SCOUTCARD Stripe confirmation

The webhook source is `api/stripe-webhook.js`. Database migration: `stripe-payments.sql`.
Existing Payment Link: `plink_1UIz7I693kVatOnMwke8HIdI` (one card, USD 5.00).

## Deployment requirements

Publish the API directory and package.json to the existing Vercel project. The Stripe dependency is pinned to 22.6.0; generate and commit a package lock when npm is available.
Keep the current static site; Vercel automatically builds files in api/ as functions.
Create an account webhook endpoint at https://scoutcard.vercel.app/api/stripe-webhook using API version 2026-08-26.dahlia with:

- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed

Add these Vercel Production environment variables, then redeploy:

| Name | Value |
| --- | --- |
| STRIPE_WEBHOOK_SECRET | Endpoint signing secret; mark sensitive |
| SUPABASE_SERVICE_ROLE_KEY | Supabase legacy service-role server key; mark sensitive |
| SUPABASE_URL | https://canyprcqtbvvrrvaoltu.supabase.co |
| STRIPE_PAYMENT_LINK_ID | plink_1UIz7I693kVatOnMwke8HIdI |
| STRIPE_LIVEMODE | true |
| STRIPE_EXPECTED_AMOUNT | 500 |
| STRIPE_EXPECTED_CURRENCY | usd |

Never put either secret in source, client code, chat, or an uploaded .env file. The Stripe API key is not needed: the SDK verifies signatures locally. The Supabase server key has broad database access; restrict access to the Vercel project and keep this key server-only.

## Behavior

Only paid Checkout notifications from the configured payment link, currency, amount, and environment can mark an order paid. An unpaid completed event waits for asynchronous success. Invalid signatures fail. Database errors return 500 so Stripe retries. A private event ledger makes processing idempotent; late failures cannot reverse paid orders. A second paid checkout for the same order is recorded with outcome `review`, not treated as another shipment.

No auto-card allocation, receipt email, refund synchronization, or cash/Zelle confirmation is included. Missing order references require manual matching in Stripe. Review Vercel webhook warnings and `scoutcard_payment_events` regularly. Always start checkout from the website order form so it supplies the order reference.

Changing price, quantity, currency, discounts, tax, or shipping charges requires updating the expected amount or replacing the fixed-price validation. Never change these settings independently and assume confirmation still works.

## Verification

Run `node --test work/payments.test.mjs` after installing dependencies. Seven local tests cover settled/async payments, unrelated events, amount validation, invalid/stale signatures, retry behavior, and configuration failure. These use a local fixture signing secret, not a Stripe account or live payment.

Live deployment must still be checked and an isolated Stripe sandbox end-to-end test completed. Connecting a live webhook does not itself prove successful payment delivery. Use separate test secrets, payment link, and database for the sandbox.
