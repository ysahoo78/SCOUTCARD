# SCOUTCARD third-party and data-collection audit

Source re-reviewed October 20, 2026. The Stripe checkout observations below are historical October 8 observations, not a new live payment audit. Recheck after every new provider or SDK is added.

| Provider or resource | Current use | Customer-data impact |
| --- | --- | --- |
| Supabase | Authentication and storage for profiles, messages, cards, and orders | Account email and the data entered or submitted through the site; browser auth session storage. |
| Stripe | Hosted payment checkout and webhook confirmation | Order reference and purchaser email are passed to checkout; Stripe collects payment details and its own checkout information. |
| Resend | Requested sign-in email delivery through configured SMTP | Adult/account email, sign-in link and email delivery metadata; no child profile details are placed in sign-in emails. |
| Vercel | Website hosting and payment webhook | Web requests and operational logs; webhook reads payment events. |
| Website fonts | Self-hosted WOFF2 fonts on SCOUTCARD | Google Fonts browser requests removed September 30; full license notices included. Legal pages use system fonts. |
| Supabase browser library | Version 2.57.4 served from SCOUTCARD assets | Official browser build and MIT license bundled September 30; active client no longer imports from esm.sh. Supabase API connections remain necessary. |
| Instagram / TikTok | Outbound social links only | No embedded feed, pixel, or SDK; the user's browser contacts them only after following a link. |
| Athlete-provided highlight sites | Outbound links from profiles | No embedded player; the user's browser contacts the destination only after following a link. |

No analytics SDK, advertising pixel, retargeting code, or marketing email integration was found in the active page references. The `script.js` legacy waitlist module is not referenced by active HTML and is excluded from deployment via `.vercelignore`. The `waitlist_signups` database table is not part of the active customer flow; do not describe it as an active marketing list.

Live Stripe Checkout review: the one-time $5 card checkout asks for shipping name, email, and address, and the Payment Link also requires a billing address. It is restricted to U.S. shipping, has no separate shipping rate or automatic tax, and requires a terms checkbox. Required phone-number collection was turned off September 29 and verified again October 8. Stripe may still show an optional phone field for Link. The Link “Save my information for faster checkout” checkbox was not preselected in the October 8 checkout preview; Link remains available as a payment method. SCOUTCARD now saves only email and an order reference before redirecting; its verified paid-checkout webhook supplies fulfillment details. No payment was submitted or Stripe setting changed during this review, so a live paid-order end-to-end check remains.

Outstanding review: the owners confirm a printer/fulfillment process, but have not supplied the provider name for privacy-disclosure review. A source review does not prove that providers set no cookies of their own. Stripe currently has customer-facing support details on file; the owners should review these with Stripe before relying on them as their public business contact details. This audit does not republish those details.

Parent dashboard: adult-only acknowledgment before Auth initialization; own-email sign-in; private child profiles with explicit optional publishing; no child login, precise schedule field, advertising SDK or embedded video player. Profile JSON exports are created locally from saved selected-child data; no export analytics or email is sent. Safety links prepare email drafts only after the visitor follows the mailto link. Neither reports nor deletion requests are automatically delivered by a backend form. Backend scopes remain owner-checked; no additional public database grants were added for these features.
