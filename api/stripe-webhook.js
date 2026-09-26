import Stripe from 'stripe';

const supported = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status, message) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });

// Dependency injection is for local tests only; public requests cannot override it.
export async function handleWebhook(request, env = process.env, send = fetch) {
  if (request.method !== 'POST') return reply(405, 'POST required');
  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.SUPABASE_URL || !env.STRIPE_PAYMENT_LINK_ID ||
      !['true', 'false'].includes(env.STRIPE_LIVEMODE)) return reply(503, 'Payment confirmation is not configured');
  let event;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 262144) return reply(413, 'Payload too large');
    // Stripe SDK signature utility: no Stripe API key or API call is needed.
    event = Stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  } catch { return reply(400, 'Invalid Stripe signature'); }
  if (!supported.has(event.type)) return reply(200, 'Ignored event');
  const session = event.data?.object;
  if (event.livemode !== (env.STRIPE_LIVEMODE === 'true') || session?.livemode !== event.livemode ||
      session?.payment_link !== env.STRIPE_PAYMENT_LINK_ID || session?.mode !== 'payment') return reply(200, 'Unrelated payment');
  if (event.type !== 'checkout.session.async_payment_failed' && session.payment_status !== 'paid') return reply(200, 'Payment not settled');
  if (!uuid.test(session.client_reference_id || '')) {
    console.warn('SCOUTCARD payment needs manual matching', event.id);
    return reply(200, 'Manual matching required');
  }
  const amount = Number(env.STRIPE_EXPECTED_AMOUNT);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !env.STRIPE_EXPECTED_CURRENCY) return reply(503, 'Payment validation is not configured');
  if (session.amount_total !== amount || session.currency !== env.STRIPE_EXPECTED_CURRENCY) {
    console.warn('SCOUTCARD unexpected payment amount', event.id);
    return reply(422, 'Payment requires review');
  }
  try {
    const result = await send(new URL('/rest/v1/rpc/confirm_scoutcard_payment', env.SUPABASE_URL), {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ p_event_id: event.id, p_session_id: session.id,
        p_order_id: session.client_reference_id, p_paid: session.payment_status === 'paid' && event.type !== 'checkout.session.async_payment_failed',
        p_amount: session.amount_total, p_currency: session.currency,
        p_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null })
    });
    if (!result.ok) throw new Error('Database update failed');
    const outcome = await result.json();
    if (outcome === 'review') console.warn('SCOUTCARD duplicate payment needs review', event.id);
    return reply(200, 'Payment notification recorded');
  } catch {
    // Non-2xx makes Stripe retry. Never log secrets or customer payloads.
    console.error('SCOUTCARD payment recording failed', event.id);
    return reply(500, 'Please retry');
  }
}

export default { fetch: request => handleWebhook(request) };
