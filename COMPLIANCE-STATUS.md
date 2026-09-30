# SCOUTCARD compliance implementation status

Updated September 30, 2026. This tracks implementation work, not a certification of legal compliance.

## Implemented

- Privacy, terms, refund, and cookie pages; essential-storage notice and settings.
- Form acknowledgments, public-profile opt-in, optional profile fields, and age gate.
- Operators, Virginia location, and support/privacy email disclosed.
- Pricing and shipping disclosures; no recruiting guarantees or fabricated testimonials in the active pages reviewed previously.
- Initial alt text, contrast, and keyboard improvements. Recheck new UI when it changes.
- Third-party inventory, font license notices, owner-confirmed card artwork provenance, and approved generated-logo provenance.
- Website fonts self-hosted to remove Google Fonts browser connections.
- Data-request contact page and manual operator handling checklist.
- Stripe phone collection is optional; preselected save-information setting was disabled during the September 29 review.

## Still open

1. **Order data minimization and retention:** names, emails, and shipping addresses are still saved before Stripe checkout. Migrate fulfillment details from verified Stripe webhooks before removing those fields from the order form. Test delayed payments and duplicate sessions. Complete the 30-day cleanup with Stripe reconciliation and safe handling of late checkout links. Current retention code is read-only and unscheduled, with 13 payment/retention tests passing September 30.
2. **Server configuration:** inspect/configure a restricted Stripe reconciliation key and a protected scheduler secret before enabling reconciliation. Never put those values in chat, source, or client code.
3. **Teen permissions:** owner selected self-attestation pending legal review. The checkbox does not verify a parent or guardian. No verified-parental-consent flow is claimed.
4. **Fulfillment provider:** owner confirmed September 30 that no printer/shipping company has been selected. Update disclosures and handling arrangements once chosen.
5. **Business contact details:** owner has no public business mailing address yet. Review customer-facing Stripe support details with the operators before changing them.
6. **Marketing:** there is no active marketing subscription. Add consent, unsubscribe handling, suppression, and appropriate sender details before launching promotional email. Requested sign-in messages remain separate.
7. **SDK hosting:** esm.sh still serves client application code. Assess bundling locally while preserving tested authentication behavior.

## Operational responsibilities

Monitor scout.card26@gmail.com for privacy requests; follow PRIVACY-REQUESTS.md. Automatic erasure is not active. Retain evidence of artwork permissions, review new assets and providers, and obtain qualified review of the teen/public-profile and policy approach before calling the legal work complete.
