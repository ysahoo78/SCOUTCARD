import { db } from './scoutcard-client.js';
import { checkoutUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const paymentLink = 'https://buy.stripe.com/6oU6oAarzaDjfUu5asaMU00';
const form = document.querySelector('#order-form'), note = document.querySelector('#order-note');
let pending = null;
try { pending = JSON.parse(sessionStorage.getItem('scoutcard-pending-checkout')); } catch { /* Storage is optional. */ }
if (!pending || !/^[0-9a-f-]{36}$/i.test(pending.id || '') || typeof pending.email !== 'string') pending = null;
// A saved checkout from an earlier visit may predate the consent requirement.
// Require the current form acknowledgments before exposing its payment link.
if (pending) pending.saved = false;
function resumeLink() {
  const link = document.querySelector('#checkout-resume');
  link.hidden = !pending?.saved;
  if (pending?.saved) link.href = checkoutUrl(paymentLink, pending.id, pending.email);
}
resumeLink();
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  if (button.disabled || !form.reportValidity()) return;
  const email = document.querySelector('#order-email').value.trim().toLowerCase();
  const terms_acknowledged = form.querySelector('[name="terms_acknowledgment"]')?.checked === true;
  const adult_purchaser_acknowledged = form.querySelector('[name="adult_purchaser"]')?.checked === true;
  if (!terms_acknowledged || !adult_purchaser_acknowledged) {
    note.textContent = 'Review the terms and confirm an adult is making this purchase.';
    note.dataset.state = 'error';
    return;
  }
  button.disabled = true; button.textContent = 'Preparing checkout…';
  form.setAttribute('aria-busy', 'true');
  note.textContent = 'Saving your order reference before opening secure checkout…';
  note.dataset.state = 'busy';
  try {
  // Keep a stable request ID on retries so a slow network cannot create duplicate orders.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
  if (!pending || pending.fingerprint !== fingerprint) pending = { id:crypto.randomUUID(), email, fingerprint, saved:false };
  resumeLink();
  try { sessionStorage.setItem('scoutcard-pending-checkout', JSON.stringify(pending)); } catch { /* Optional. */ }
    const { data, error } = await withTimeout(db.rpc('reserve_scoutcard_order_email_only', {
      request_id:pending.id, customer_email:email,
      terms_acknowledged, adult_purchaser_acknowledged
    }));
    if (error) throw error;
    if (data !== pending.id) throw new Error('Unable to confirm the order reference. Please try again.');
    pending.saved = true;
    try { sessionStorage.setItem('scoutcard-pending-checkout', JSON.stringify(pending)); } catch { /* Optional. */ }
    resumeLink();
    note.textContent = 'Order started. Opening Stripe for payment and shipping details.';
    note.dataset.state = 'success';
    window.location.assign(checkoutUrl(paymentLink, pending.id, email));
  } catch (error) { note.textContent = friendlyError(error); note.dataset.state = 'error'; }
  finally { form.setAttribute('aria-busy', 'false'); button.disabled = false; button.textContent = 'Continue to payment →'; }
});
