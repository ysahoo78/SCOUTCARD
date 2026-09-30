# SCOUTCARD third-party and data-collection audit

Reviewed September 29, 2026 against the active HTML, JavaScript, CSS, and server function source. Recheck after every new provider or SDK is added.

| Provider or resource | Current use | Customer-data impact |
| --- | --- | --- |
| Supabase | Authentication and storage for profiles, messages, cards, and orders | Account email and the data entered or submitted through the site; browser auth session storage. |
| Stripe | Hosted payment checkout and webhook confirmation | Order reference and purchaser email are passed to checkout; Stripe collects payment details and its own checkout information. |
| Vercel | Website hosting and payment webhook | Web requests and operational logs; webhook reads payment events. |
| Google Fonts | Browser-loaded fonts on the marketing pages | A browser request to Google can reveal ordinary connection information. Legal pages use system fonts. |
| esm.sh | Browser-loaded, version-pinned Supabase JavaScript package | A browser request to esm.sh can reveal ordinary connection information. |
| Instagram / TikTok | Outbound social links only | No embedded feed, pixel, or SDK; the user's browser contacts them only after following a link. |
| Athlete-provided highlight sites | Outbound links from profiles | No embedded player; the user's browser contacts the destination only after following a link. |

No analytics SDK, advertising pixel, retargeting code, or marketing email integration was found in the active page references. The `script.js` legacy waitlist module is not referenced by active HTML and is excluded from deployment via `.vercelignore`. The `waitlist_signups` database table is not part of the active customer flow; do not describe it as an active marketing list.

Live Stripe Checkout review: the $5 card checkout asks for shipping name, email, and address. Required phone-number collection was turned off September 29 and verified on the Payment Link. Stripe may still show an optional phone field for Link. The account-level Link “Save customer information” default was disabled; Link remains available as a payment method, and a new checkout visit no longer showed the previously preselected save-information checkbox. The SCOUTCARD site currently saves name, email, and shipping address before redirecting, so those fields are collected twice. No payment was submitted during review.

Outstanding review: reduce duplicate pre-payment shipping data only with a tested order/webhook migration; name any chosen print/fulfillment provider in the privacy policy when one is selected; reassess whether Google Fonts and esm.sh should be self-hosted to avoid additional browser connections. A source review does not prove that providers set no cookies of their own. Stripe currently has a customer-facing support address and phone on file; the owners should review these with Stripe before relying on them as their public business contact details. This audit does not republish those details.
