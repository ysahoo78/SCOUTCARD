# SCOUTCARD privacy request handling checklist

This is an internal operational checklist, not a promise that deletion happens automatically. Requests arrive at `scout.card26@gmail.com`; monitor that inbox and its spam folder. Never ask for a password, full payment-card number, government ID, or private activation code in the first response.

1. Record the date, requested action, account/order email, and case status in a private business record. Do not put request emails or personal data in GitHub issues or public files.
2. Verify the requester's authority before disclosing or changing data. Prefer a reply from the account/order email. For a guardian request, verify the relationship using the least intrusive method suitable for the case. Escalate uncertain or disputed requests rather than guessing.
3. If the request concerns a public profile or an under-13 child, evaluate prompt unpublishing while verification and removal are in progress. Do not delete an unrelated athlete's profile because someone supplied its public URL.
4. Locate the applicable account, `athlete_profiles` row, related `coach_messages`, `athlete_cards`, and `card_orders` records in Supabase. Include the user's UUID folder in the private `athlete-headshots` Storage bucket, including unlinked uploads from interrupted saves. Check Stripe payment records when an order is involved. Be careful: card deactivation and profile deletion are different actions, and order/payment records may have retention needs.
   - For photo/account deletion, remove the objects through the Supabase Storage API or dashboard, not SQL deletion of storage metadata. Remove the account's stored photos before deleting its Auth user. Clearing `headshot_path` stops new public signing but is not by itself file deletion. Previously issued URLs may remain valid for up to 5 minutes, and third-party copies/backups have separate retention.
5. Fulfill the verified request only within the user's scope. Preserve records genuinely needed for fulfillment, disputes, security, tax, or other legal obligations; document what remains and why. Do not promise that third-party caches or backups disappear immediately.
6. Reply to the requester with what was done, what could not be done, and any next step. Store only the minimum case record needed to demonstrate handling, secured from public access.

The website currently does not automate this workflow or send an email notification to operators. Revisit this checklist if new analytics, marketing email, printers, or other providers are added.
