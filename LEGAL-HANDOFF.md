# SCOUTCARD: completed safeguards and remaining owner actions

Prepared October 20, 2026. This is a preparation checklist, not a registration,
legal opinion, tax determination, signed agreement or compliance certificate.

## Confirmed facts

- Operators: Yash Sahoo and Toryn Ibarra; Virginia, United States.
- Product: physical NFC card linking to an updateable athlete profile; no QR code.
- Website: https://www.scoutcard.tech/ ; support: scout.card26@gmail.com.
- Current advertised card price: $5 total including U.S. shipping.
- Owner confirmed operations in both Ashburn/Loudoun and the
  Charlottesville/Albemarle area; the precise city/county boundary must be checked
  privately for each actual business location.
- Owner confirmed no completed business-name/entity or Virginia sales-tax
  registrations. No registrations or EIN application were submitted by the agent.
- No public business mailing address or phone has been provided. Printer name is
  not provided. No sensitive registration details are stored in this repository.

## Implemented on the website

- Privacy, terms, refunds, browser-storage notice/controls and parent privacy notice.
- Adult-only parent email flow, no child login, private child profiles and separate
  optional publishing, no child email/DOB/phone/home-address/schedule fields.
- Separate ownership, cards, photo folders and inboxes for each child; parent
  edit/unpublish/delete controls; local selected-child saved-profile JSON copy.
- Safety/reporting contact links and data-request instructions. Reports and broad
  rights requests are handled manually by email, not an automated backend form.
- Self-hosted fonts/client library with license records, no added ad/analytics SDK
  or video embeds, optional compressed metadata-stripped photos and safe links.
- Recruiting-outcome disclaimers, fictional-example labels and clear pricing.
- Raymond's testimonial, portrait display and star rating removed at owner request.
- Existing athlete accounts and NFC links preserved. No real charges, refunds,
  customer deletions, extra public database grants or live child test profiles
  were created to make this checklist look complete.

## Remaining: filings and business decisions (not completed)

1. **Business structure and founders' agreement.** Decide structure, ownership,
   decision rights, costs/profits, IP ownership and exits with appropriate advice.
   An LLC is not automatically required. Virginia may treat co-owners operating
   for profit as a partnership even without an intended filing. Do not describe
   SCOUTCARD as "SCOUTCARD LLC" until it is actually formed.
   https://law.lis.virginia.gov/vacode/title50/chapter2.2/section50-73.88/
   https://www.scc.virginia.gov/businesses/new-business-resources/business-types/
2. **Trade name/entity filing.** Determine and file the applicable fictitious-name
   certificate and, if chosen, entity formation. Name availability is not trademark
   clearance. Have the founders provide actual legal names/addresses and accept
   filings themselves; do not invent a registration or effective date.
   https://www.scc.virginia.gov/businesses/business-faqs/
3. **EIN.** Determine the correct entity/responsible party, then apply directly at
   the IRS if required. The IRS application is free. Do not send SSNs/ITINs in chat.
   https://www.irs.gov/businesses/employer-identification-number
4. **Virginia sales tax, including prior sales.** Confirm dealer status, register,
   and address collection/filing/remittance with Virginia Tax or an accountant.
   Include cash, Zelle and Stripe sales. Do not assume the remote-seller thresholds
   exempt a business physically operating in Virginia. Ask about classification
   of the card/profile bundle and each location's sourcing.
   https://www.tax.virginia.gov/register
   https://www.tax.virginia.gov/retail-sales-and-use-tax
5. **Local licensing and zoning.** Check actual locations, business classification,
   applicable home/campus-use permissions and local tax registrations. Operating
   in two areas does not establish which filings apply without the location facts.
   Charlottesville city: https://www.charlottesville.gov/186/Business-License-Tax
   Albemarle county: https://www.albemarle.org/government/finance/business-license-taxes
   Loudoun county: https://www.loudoun.gov/BusinessTax
6. **Tax pricing/payment configuration.** Decide how required tax fits the stated
   $5 total with an accountant. The current webhook validates an exact configured
   total (the advertised total is 500 cents); enabling extra tax without a reviewed integration change can cause
   paid orders to require manual review. No Stripe price, tax or charge was changed.

## Remaining: privacy, permissions and real operations

- Qualified privacy review of the adult-entered model, actual child use, public
  child photos/highlights, state-law applicability, notices and any required
  verifiable-consent procedure. An adult-use checkbox is not a compliance seal.
  https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
  https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/
- Select an accountable operator and actually monitor/report/fulfill requests.
  Adopt and perform purpose-based retention/security procedures. The monthly
  checklist in COMPLIANCE-OPERATIONS.md is prepared, not evidence of execution.
  Automatic inactive-profile purging and unpaid-order cleanup are not enabled.
- Review provider agreements, logs/backups and restore capability. Existing
  Supabase advisor notices include public privileged legacy RPCs and disabled
  leaked-password protection on a magic-link app; no clean-security certification
  is implied. No paid service or account-security setting was silently changed.
- Supply lawful business contact details as required after review, identify the
  printer/fulfillment provider and review what is shared. Do not publish a home
  address or transmit customer data to an unnamed supplier without approval.
- Preserve commercial artwork/font licenses, obtain any needed photo copyright
  permission, and assess trademark/name clearance. AI-generated logo provenance
  does not establish trademark exclusivity. Raymond endorsement remains offline.
- Run an actual parent's intentional email return/profile/card test. Technical
  local tests do not verify legal guardianship or email deliverability. A full
  live $5 checkout/refund test was previously deferred by the owner.

## Information for an adviser (not a signed agreement)

Ask privacy counsel: "Our adult parent enters the data through their own account,
children have no login, private profiles can optionally be published to anyone
with a link, and coach inquiries go to the adult. What federal/state obligations,
notices, verification and retention requirements apply to these actual facts?"

Ask a business/tax adviser: "We are two Virginia co-founders selling $5 NFC cards
with an online profile, including cash sales, with activity in Loudoun and the
Charlottesville/Albemarle area. No registrations have been completed. What
structure, name filing, EIN, state/local registrations, prior-sale corrections and
tax treatment do we need?"

Founder decisions still needed: ownership percentages [undecided]; contributions
[undecided]; expense/refund authority [undecided]; IP assignment/licensing
[undecided]; profit distributions [undecided]; departure/deadlock arrangements
[undecided]. Do not assume 50/50 ownership or transfer either founder's rights.

## Verification of this release

27 parent browser checks (including local profile export and safety reporting),
26 existing athlete browser regressions, 45 responsive page checks, 3 profile
export unit tests and 46 local PostgreSQL checks passed. Live read-only checks
confirmed RLS remains enabled, anonymous callers cannot access parent age records
or parent-list RPC, neither browser role can read activation-code columns, and
the headshot bucket remains private with a 512 KiB stored-file limit. No live
customer profile, card binding, permission grant or payment was changed by QA.
Browser/Auth/Storage fixtures do not replace a real parent email/card test.
