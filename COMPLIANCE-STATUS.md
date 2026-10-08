# SCOUTCARD compliance implementation status

Updated October 8, 2026. This tracks implementation work, not a certification of legal compliance.

## Implemented

- Privacy, terms, refund, and cookie pages; essential-storage notice and settings.
- Form acknowledgments, public-profile opt-in, optional profile fields, and age gate.
- Operators, Virginia location, and support/privacy email disclosed.
- Pricing and shipping disclosures; no recruiting guarantees or fabricated testimonials in the active pages reviewed previously.
- Initial alt text and contrast improvements. Keyboard-only checks on October 7 covered the age gate, order form, profile editor, activation sign-in, and coach-contact fields; recheck new UI when it changes. This is not a full assistive-technology audit.
- Third-party inventory, font license notices, owner-confirmed card artwork provenance, and approved generated-logo provenance.
- Website fonts self-hosted to remove Google Fonts browser connections.
- Data-request contact page and manual operator handling checklist.
- Stripe phone collection is optional; preselected save-information setting was disabled during the September 29 review.
- The order form now takes only an email before Stripe checkout. A verified paid-checkout webhook supplies the recipient name and shipping address. A new order stays pending if verified shipping details are missing. This removes the site's duplicate shipping form; it does not certify Stripe's own billing/shipping field behavior.
- The earlier order RPC that accepted pre-checkout shipping details no longer permits public callers.
- The active $5 one-time Stripe link was rechecked October 8: U.S. shipping only, no separate shipping rate or automatic tax, required terms consent, optional phone disabled, and the save-information control not preselected. Billing and shipping addresses are both required in the current link. No Stripe setting was changed in this review.
- The owners confirmed a 30-day fulfillment basis and selected returns of unused standard cards requested within 20 days of delivery. Those statements now appear on the live order, terms, and refund pages; the obsolete personalized-card exclusion is removed.

## Still open

1. **Order retention:** older pending orders may contain pre-checkout shipping details. Complete the 30-day cleanup with Stripe reconciliation and safe handling of late checkout links. Current retention code is read-only and unscheduled. A full live paid-order test has not been performed.
2. **Server configuration:** inspect/configure a restricted Stripe reconciliation key and a protected scheduler secret before enabling reconciliation. Never put those values in chat, source, or client code.
3. **Teen permissions:** owner selected self-attestation pending legal review. The checkbox does not verify a parent or guardian. No verified-parental-consent flow is claimed.
4. **Fulfillment provider and returns:** the owners now confirm a printer/fulfillment process able to ship within 30 days, but the provider's name has not been supplied for privacy-disclosure review. They still need to decide and disclose who pays return postage for change-of-mind returns and then handle requests in practice.
5. **Business contact details:** owner has no public business mailing address yet. Review customer-facing Stripe support details with the operators before changing them.
6. **Marketing:** there is no active marketing subscription. Add consent, unsubscribe handling, suppression, and appropriate sender details before launching promotional email. Requested sign-in messages remain separate.
7. **SDK hosting completed:** the official Supabase 2.57.4 browser build is served locally with its license. Public profile loading and signed-out initialization passed; a fresh email-link login was not repeated in this round.

## Operational responsibilities

Monitor scout.card26@gmail.com for privacy requests; follow PRIVACY-REQUESTS.md. Automatic erasure is not active. Retain evidence of artwork permissions, review new assets and providers, and obtain qualified review of the teen/public-profile and policy approach before calling the legal work complete.
