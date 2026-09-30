# Retention preview: launch guardrails

This source includes a **disabled, read-only preview endpoint** at `/api/cron/order-retention`. It does not delete, overwrite, or anonymize any record. It is not scheduled in `vercel.json`.

The endpoint only runs when all of the following are deliberately configured as server-only Vercel variables:

- `CRON_SECRET` — protects the endpoint.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — server-only access to pending-order references; the client never receives these values.
- `STRIPE_RECONCILIATION_KEY` — a separate, restricted Stripe key with read-only Checkout Session access.
- `STRIPE_PAYMENT_LINK_ID` — the SCOUTCARD Payment Link ID.
- `RETENTION_MODE=preview` — the only mode accepted by the current source.

Before scheduling even this preview, test it against synthetic, non-customer orders. The preview deliberately treats a paid session, an open session, a missing session, a truncated Stripe result, or any API failure as **review required**. It returns counts only and does not log names, emails, addresses, or order identifiers.

There is intentionally no deletion mode. Enabling permanent cleanup later requires an explicit production launch decision, a documented retention rule, an operator-reviewed test, and a separate implementation that updates the public privacy notice first.

## September 30 verification

The preview now rejects requests when its secret is missing, validates provider responses, and bounds Stripe request time. Only expired, explicitly unpaid sessions without a PaymentIntent or enabled recovery link can enter the `notPaid` preview count. Completed but unpaid sessions, attached PaymentIntents, unknown statuses, and recovery-enabled sessions require review. All matching sessions must pass; any paid or uncertain duplicate blocks eligibility. This count is not authorization to delete.

Production cleanup still needs a restricted Stripe read key, tested reconciliation, and a race-safe database operation that rechecks the order and payment events before removing contact details. Existing Payment Links can create new checkout sessions for an old order reference, so a scan alone cannot safely authorize erasure. The order flow must first prevent or safely handle those late checkouts. No records are removed by this release.

The preview scans at most three Stripe pages (100 sessions per page). A later-page payment prevents unpaid classification; reaching the scan limit leaves every candidate under review. Fifteen payment/retention tests passed after this pagination change.
