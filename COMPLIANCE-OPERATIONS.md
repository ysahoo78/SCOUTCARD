# SCOUTCARD operating procedures — prepared October 20, 2026

This is a practical procedure for the founders, not evidence that tasks have been
performed or an attorney's compliance opinion. Assign a responsible founder and
keep dated completion records privately. Do not put customer data, government IDs,
activation codes or credentials in this repository or public issues.

## Data inventory and retention review

| Records | Purpose | Action when no longer needed |
| --- | --- | --- |
| Adult Auth email/session | Account access and ownership | Verify request, revoke sessions, remove owned photos and disable cards before deleting account. Account deletion alone does not immediately invalidate every issued JWT. |
| Athlete/child profile | Requested profile service | Correct or unpublish on authorized request; delete when appropriate. No automatic inactivity expiry is currently running. A record's age is not proof it is unused. |
| Parent private age band/acknowledgments | Separate child profiles and record adult choices | Treat as private family records; include in authorized access requests; remove with the child profile unless a documented lawful reason requires preservation. |
| Headshots/unlinked uploads | Optional profile photo | Remove through Storage API/dashboard, not SQL deletion of storage metadata. Include abandoned uploads and old versions; new signed image links stop on unpublish, but issued links can last up to 5 minutes. |
| Coach messages | Parent/athlete inquiry inbox | Respect authorized removal; child-profile deletion cascades inbox records. Do not repurpose messages for marketing. |
| Card binding/private codes | Activation and permanent NFC routing | Disable affected cards before removal. Keep private codes separate from public links and do not share them with printers unnecessarily. |
| Unpaid orders | Match checkout/payment retries | Review records older than 30 days against Stripe before deciding removal. A missing or unpaid session alone is not proof no payment exists. Existing retention endpoint is review-only and disabled unless configured; it does not purge data. |
| Paid orders/payments | Fulfillment, accounting, disputes and legal duties | Retain only what is necessary for the applicable purpose. Have an accountant determine periods; do not guess a universal tax retention term. Restrict access. |
| Logs/backups | Security, recovery and operations | Record provider settings and retention limits. Do not promise immediate removal from backups. After a restore, reconcile prior deletion/restriction requests before public access is resumed. |

Suggested operating cadence: check the support inbox and spam each business day;
review outstanding rights/safety requests weekly; review necessity, unlinked
uploads and aged unpaid orders monthly. These are proposed internal controls,
not a promise of round-the-clock monitoring or a fixed public response SLA.
Owners must actually assign and perform them. Do not bulk-delete records solely
to make this checklist look complete.

## Rights requests and unauthorized child use

Use PRIVACY-REQUESTS.md. Record receipt, requested scope, verified authority,
actions, retained exceptions and completion date in a restricted business record.
Use the least intrusive verification suitable for the case. Never disclose a
child's data because someone knows a public profile URL. Escalate ownership
disputes. Assess prompt unpublishing for credible exposure concerns without
automatically transferring control to the reporter.

If a child under 13 directly signed in or entered data, restrict further use and
investigate. Do not tell the child to select an older age or share the parent's
login. Obtain privacy counsel's direction on deletion, notices and any consent
requirements. Adult-entered profiles and direct child collection are not the same
fact pattern. A checkbox or email link does not prove guardianship.

## Incident response

1. Record discovery time and facts privately; preserve relevant access/security
   evidence without copying unnecessary customer information. Do not post raw
   logs, tokens or reports to public issues or external AI tools.
2. Contain the specific exposure: unpublish affected content, disable compromised
   card bindings or revoke sessions as appropriate. Changing a credential or
   removing accounts requires authorized action, not an improvised bulk script.
3. Identify affected records, access paths, dates and providers. Rotate affected
   credentials securely; never paste them into chat. Verify containment with a
   scoped check and review relevant logs.
4. Contact qualified counsel promptly to assess notification obligations and
   timing under the applicable state/federal laws and provider contracts. Do not
   assume every incident is reportable or that there is one universal deadline.
5. Communicate accurate, approved notices to affected people/regulators when
   required. Keep a private record of what was done and avoid speculative claims.
6. Re-test access controls, reconcile deletions before restoring a backup, and
   document preventive changes. Local synthetic restore tests do not establish
   that a production backup has been restored successfully.

Virginia reference: https://law.lis.virginia.gov/vacode/title18.2/chapter6/section18.2-186.6/

## Order fulfillment, cancellations and returns

- Track paid orders, the applicable shipment promise, actual dispatch/pickup,
  cancellation requests and refund outcomes privately. A payment confirmation is
  not a shipment confirmation. Check sufficient stock before accepting orders.
- The site currently promises shipment within 30 days, not delivery within 30
  days. If the promise cannot be met, assess the applicable delay notice/consent
  and prompt-refund requirements; do not silently keep the money or invent a new
  date. Preserve the customer's actual choice and fulfillment evidence.
- Apply the published policy: full cancellation refund before production;
  remedy for defective/wrong cards; unused standard-card returns requested within
  20 days after delivery; SCOUTCARD pays return postage. Do not invent a new fee.
- Have the founders approve and execute each real refund/payment change. This
  document does not issue refunds or authorize charges.

Reference: https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule

## Providers, assets and advertising

Keep provider/data-processing terms and actual retention settings with restricted
business records. Name the printer before sharing fulfillment data; provide only
what is needed for the job. Do not send a spreadsheet of athlete profiles to a
printer just because it prints the cards. Preserve source-art licenses and signed
permissions. Personal image permission does not by itself establish photo
copyright rights. Do not use children's profile content in marketing without an
appropriate separate permission process.

Raymond's previously approved recommendation, portrait and owner-requested
five-star rating were restored after the owner clarified the removal request.
The section discloses his personal connection to the founders and states that
his view is not a UVA endorsement. Preserve the endorsement/rating permission
and photograph-license evidence; personal image permission is not copyright
clearance. No UVA logo or institutional endorsement should be added without
the necessary authorization.

Reference: https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking
