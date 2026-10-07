# SCOUTCARD data-retention operating plan

Reviewed October 7, 2026. This is an internal plan and review checklist, not an automatic deletion job or a promise of a legal retention period. Customer-facing policy: `privacy.html`.

## Current data by purpose

| Data | Current handling | Review action |
| --- | --- | --- |
| Account email and athlete profile | Retained while account/profile exists; publication can be switched off | Process verified access, correction, and deletion requests; review inactive accounts when a documented period is chosen. |
| Coach messages | Stored in the athlete's private inbox | Delete with a verified profile deletion request unless a specific lawful reason requires retaining a case record. Set a routine message expiry only after users are told about it. |
| Card activation and public token | Kept to connect a physical card to a profile | Distinguish card deactivation from deleting an account. Never reuse a private activation code. |
| Pending orders | New orders save only email and an order reference before Stripe payment; older pending orders may contain name and address | Owner selected a 30-day cleanup after Stripe payment reconciliation. No automatic purge is active yet; review manually until the reconciliation job is deployed and tested. |
| Paid orders and payment events | Used for shipping, support, refunds, disputes, and accounting | Keep the minimum records needed for those purposes and applicable law. Choose a concrete period with qualified tax/legal advice before promising one publicly. |
| Provider logs and backups | Controlled in part by Supabase, Vercel, and Stripe settings | Record provider retention settings; do not promise immediate erasure from backups. |
| Legacy waitlist table | Not connected to the active site; currently empty as of September 29 | Do not collect new marketing signups unless a real opt-in, notice, and unsubscribe process is in place. |

## Monthly review

1. Review privacy-request email and case status. Verify requester authority before disclosing or deleting data.
2. Count pending orders older than 30 days without displaying names or addresses:

   ```sql
   select count(*) as candidates
   from public.card_orders
   where status = 'payment_pending'
     and created_at < now() - interval '30 days'
     and paid_at is null;
   ```

3. For each candidate, check Stripe for a matching paid, processing, refunded, or disputed Checkout Session before any deletion. A failed webhook could otherwise leave a paid order marked pending. Do not run a blanket `DELETE` based only on the database status.
4. Review active services and any new printer or delivery partner before changing privacy disclosures or retention periods.
5. Record the review date and counts in a private business record. Do not put customer details in GitHub.

The observed production database had one payment-pending order dated September 25, 2026, and no paid order on September 29. No records were deleted or changed during this audit.

## Retention preview prepared (not scheduled)

The owner selected cleanup of unpaid order contact and shipping details after 30 days, but only after a successful server-side Stripe reconciliation. This must not be implemented as a database-only timer or a status-only `DELETE`: a missed webhook can leave a paid order marked `payment_pending`.

The repository now contains a disabled, read-only reconciliation preview endpoint. It uses a restricted Stripe read key only after the owner deliberately supplies protected server settings. It returns aggregate counts, logs no customer details, and does not schedule itself or make any change to an order. See `RETENTION-AUTOMATION.md` for the required guardrails.

Before enabling any automated cleanup, compare each eligible order reference against Checkout Sessions for the SCOUTCARD Payment Link. Skip any order with a paid, processing, refunded, disputed, missing, or otherwise uncertain payment; record an operator-review case instead. A Stripe API failure must leave all candidate orders untouched and retry later. The job should be idempotent, avoid deleting payment or accounting records, and be tested with synthetic pending and paid cases before production rollout. Update the public privacy policy when a retention schedule is actually active.
