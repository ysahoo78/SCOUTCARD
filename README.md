# SCOUTCARD

Static athlete profile website, deployed through this repository to Vercel. Authentication and data are stored in the existing Supabase project. The card is an optional way to share a profile.

## Pages

- `index.html#buy`: card ordering and Stripe checkout.
- `index.html#setup`: sign-in/out, profile editor, publishing, coach inbox, activated cards.
- `profile.html?athlete=SLUG`: published athlete profile, coach contact, print/save PDF.
- `activate.html`: private activation code connects a card to the signed-in athlete.
- `card.html?card=PUBLIC_TOKEN`: the permanent NFC destination, resolves to the currently connected public profile.

## Database

`athletelink-setup.sql` is the current idempotent schema/migration despite its historical filename. It has been applied to the SCOUTCARD project. It creates no sample records. Browser credentials must remain publishable-only; never add service-role or Stripe secret keys here.

Only published profiles are publicly readable. Athletes can edit only their own profile and read only their own messages/cards. Card claims run atomically in a database function and cannot transfer a card from another owner. Activation secrets are separate from public card tokens. Names can change without changing existing profile links.

On September 24, 2026, the two remaining demo cards were removed from the active table. At that point profiles, cards, messages, and orders were empty. Recovery copies of the two cards are restricted to the `scoutcard_backups` database schema. Authentication accounts were not deleted. Testing uses mocked services or rolled-back database transactions.

## Issue a real physical card

After confirming payment and preparing fulfillment, run this as an administrator in Supabase SQL Editor:

```sql
insert into public.athlete_cards (activation_code)
values (upper(replace(gen_random_uuid()::text, '-', '')))
returning activation_code, public_token;
```

Encode `https://www.scoutcard.tech/card.html?card=PUBLIC_TOKEN` on the NFC chip. Include the separate activation code privately inside the packaging. Do not put the activation code in the NFC URL or on a publicly visible card face. Test NFC tapping and the public link before shipping; do not claim the card using the customer's secret during fulfillment. Previously encoded `scoutcard.vercel.app` card links remain valid and redirect to the branded athlete profile after activation.

## Payment and messaging limitations

The form reserves an email-only pending order, then opens the configured Stripe Payment Link with `client_reference_id` and the customer's prefilled email. A signed Stripe webhook matches a settled payment to that order and stores the shipping name and address provided by Stripe. Missing shipping details leave a new order pending for retry or manual review. Confirm that Stripe and the order both show a paid status before shipping; a saved order or return from checkout is not proof of payment. A full live paid-order test remains outstanding.

Coach messages appear in the athlete's inbox. Automatic notification email and verified-coach identity are not implemented. Public contact has basic repeat-message throttling; a production anti-bot service is a separate next step. Magic-link delivery limits are set by Supabase/SMTP, not this website.

## Verification

`work/verify.mjs` checks URL validation, permanent slugs, timeouts, JS syntax, duplicate HTML IDs, and local asset references. `work/serve.mjs` runs a local preview and isolated browser test page at `/qa.html`. `work/browser-qa.js` runs 20 browser checks with a mock Supabase service; it sends no real emails or payments. These work files are excluded from deployment.

Real database transaction tests verified profile privacy, activation retries, card ownership, private inboxes, message cooldown, and idempotent order creation. They rolled back all fixtures. Tests do not certify an entire live payment/email/fulfillment flow or guarantee absence of bugs.

## Deployment

Vercel serves the static files directly; no build command is required. Keep all referenced JS and CSS alongside the HTML files. Supabase authentication Site URL is `https://www.scoutcard.tech/`. Its redirect allowlist includes the exact URLs `https://www.scoutcard.tech/` and `https://www.scoutcard.tech/activate.html`; keep the existing `https://scoutcard.vercel.app/*` entry for older sign-in links. The setup tab uses a fragment after authentication, not an additional redirect URL.
