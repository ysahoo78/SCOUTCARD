# Reliability rollout — 2026-10-07

## Implemented in this rollout

- Database write budgets: 5 new orders/email/hour; 10 coach messages/email/hour. Existing one-message/minute/athlete+email safeguard retained. Transaction locks serialize each email budget. Email identifiers are unverified, so these do not replace trusted-IP/WAF bot protection.
- Browser transport: 15-second aborting deadline; 1 MiB maximum buffered response; no automatic write retries. A timeout does not prove that a write failed.
- Webhook input: 256 KiB streaming byte limit and 10-second body deadline; existing signature verification, amount checks and event/session deduplication retained.
- Paginated private inbox and cards: 20 records per page, stable timestamp+ID cursors, loading/empty/error/retry states and overlapping-click guard. No personal data cached in a shared cache.
- Six additive DB indexes for page traversal, existing message throttle, pending-order lookup, and email write budgets. No records or RLS policies removed.
- Existing Brotli delivery verified. Compressed card artwork retained. Cache headers for the pinned SDK and versioned card image; auth/profile HTML stays revalidated.
- Server liveness endpoint /api/health, no configuration or personal data exposed.
- GitHub uptime workflow checks homepage, activation page and liveness every 15 minutes (best effort, may be delayed by GitHub). This does not test authentication, the database or checkout. GitHub Actions failure notifications depend on the owner's notification settings; no email delivery guarantee has been verified.
- Existing webhook/server logging is privacy-limited. Browser 5xx diagnostics log status codes only, not URLs, bodies or tokens. This is not centralized frontend error tracking.

## Tests and limitations

- 24 local transport/webhook/retention/health tests passed, including 100 concurrent mocked network calls. No live charge or production stress test.
- PGlite 0.5.8 local synthetic database: rate boundaries, expiration, isolation and private schema checks passed. Synthetic snapshot restored into a second local instance, then row counts and a restored rate rule verified.
- This is NOT a Supabase backup restore test; auth, storage, policies and full production recovery remain to be exercised against an isolated target.
- SCOUTCARD Test remains paused at the owner's request.

## Still outstanding / not falsely marked complete

1. Global trusted-client/IP rate limiting, bot challenge, and activation-attempt throttling. Direct Supabase access cannot be protected solely by a Vercel route limiter.
2. Provider-wide API quotas and spending caps: waiting for owner's monthly budget. No paid service or billing change enabled.
3. Duplicate-charge prevention: reusable Payment Link can create multiple paid sessions. Current backend prevents duplicate fulfillment and flags second payments for review; it does not prevent the charge. Migrate to server-owned reusable per-order Checkout Sessions, with tested idempotency and asynchronous payment handling.
4. Duplicate coach-message submissions across retries need a persistent client request ID and corresponding database uniqueness check. Existing click guards and throttles are not full idempotency.
5. No subscription product or user-upload endpoint exists. Subscription deduplication and file-upload limits are not applicable to current features; apply before adding either. Webhook payload limit is not an upload feature.
6. Centralized frontend error logging and verified alert delivery need a provider/retention/privacy decision.
7. Real multi-connection load/capacity test and actual Supabase backup restoration remain deferred while staging is paused.
8. Security advisor warnings: intentional callable security-definer RPCs require continued review; private tables with RLS/no client policies remain deliberately locked down. Password leak checks are disabled (current UI is magic-link based).

References: https://supabase.com/docs/guides/database/query-optimization ; https://docs.stripe.com/checkout/fulfillment ; https://pglite.dev/docs/api
