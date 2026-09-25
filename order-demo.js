import { db } from './scoutcard-client.js';
import { checkoutUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const paymentLink = 'https://buy.stripe.com/6oU6oAarzaDjfUu5asaMU00';
const form = document.querySelector('#order-form'), note = document.querySelector('#order-note');
let pending = null;
try { pending = JSON.parse(sessionStorage.getItem('scoutcard-pending-checkout')); } catch { /* Storage is optional. */ }
if (!pending || !/^[0-9a-f-]{36}$/i.test(pending.id || '') || typeof pending.email !== 'string') pending = null;
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
  const customer_name = document.querySelector('#order-name').value.trim();
  const email = document.querySelector('#order-email').value.trim().toLowerCase();
  const shipping_address = document.querySelector('#order-address').value.trim();
  if (customer_name.length < 2 || shipping_address.length < 6) { note.textContent = 'Enter your full name and complete shipping address.'; return; }
  button.disabled = true; button.textContent = 'Saving details…'; note.textContent = '';
  try {
  // Keep a stable request ID on retries so a slow network cannot create duplicate orders.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([customer_name,email,shipping_address])));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
  if (!pending || pending.fingerprint !== fingerprint) pending = { id:crypto.randomUUID(), email, fingerprint, saved:false };
  resumeLink();
  try { sessionStorage.setItem('scoutcard-pending-checkout', JSON.stringify(pending)); } catch { /* Optional. */ }
    const { data, error } = await withTimeout(db.rpc('reserve_scoutcard_order', {
      request_id:pending.id, customer_name, customer_email:email, delivery_address:shipping_address
    }));
    if (error) throw error;
    if (data !== pending.id) throw new Error('Unable to confirm the order reference. Please try again.');
    pending.saved = true;
    try { sessionStorage.setItem('scoutcard-pending-checkout', JSON.stringify(pending)); } catch { /* Optional. */ }
    resumeLink();
    note.textContent = 'Details saved. Opening Stripe checkout. Payment is not complete until Stripe confirms it.';
    window.location.assign(checkoutUrl(paymentLink, pending.id, email));
  } catch (error) { note.textContent = friendlyError(error); }
  finally { button.disabled = false; button.textContent = 'Continue to payment →'; }
});
