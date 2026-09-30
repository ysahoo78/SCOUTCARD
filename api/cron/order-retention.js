import Stripe from 'stripe';
import { timingSafeEqual } from 'node:crypto';

const MAX_CANDIDATES = 50;
const reply = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function sameSecret(received, expected) {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Pure on purpose: this route never deletes or anonymizes an order. A missing
// Stripe record is not proof that an order is safe to erase, so it is review-only.
export function previewReconciliation(candidates, sessions, sessionsComplete) {
  return candidates.reduce((summary, order) => {
    const matches = sessions.filter(session => session.client_reference_id === order.id);
    // Completed unpaid checkouts can still have asynchronous payments processing.
    // Only positively identified expired, unpaid sessions qualify for this preview.
    const uncertain = !sessionsComplete || !matches.length || matches.some(session =>
      session.payment_status !== 'unpaid' || session.status !== 'expired' ||
      session.payment_intent != null || session.after_expiration?.recovery?.enabled === true
    );
    if (uncertain) summary.review += 1;
    else summary.notPaid += 1;
    return summary;
  }, { reviewed: candidates.length, review: 0, notPaid: 0 });
}

export async function handleRetentionPreview(request, env = process.env, send = fetch, stripeClient) {
  if (request.method !== 'GET') return reply(405, { message: 'GET required' });
  const authorization = request.headers.get('authorization') || '';
  if (!env.CRON_SECRET || !sameSecret(authorization, `Bearer ${env.CRON_SECRET}`)) return reply(401, { message: 'Unauthorized' });

  // This is deliberately hard-disabled until a separate, explicit launch review.
  if (env.RETENTION_MODE !== 'preview') return reply(503, { message: 'Retention preview is not enabled' });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.STRIPE_RECONCILIATION_KEY || !env.STRIPE_PAYMENT_LINK_ID) {
    return reply(503, { message: 'Retention preview is not configured' });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const candidatesUrl = new URL('/rest/v1/card_orders', env.SUPABASE_URL);
  candidatesUrl.searchParams.set('select', 'id,created_at,status,stripe_session_id');
  candidatesUrl.searchParams.set('status', 'eq.payment_pending');
  candidatesUrl.searchParams.set('paid_at', 'is.null');
  candidatesUrl.searchParams.set('created_at', `lt.${cutoff}`);
  candidatesUrl.searchParams.set('limit', String(MAX_CANDIDATES));
  candidatesUrl.searchParams.set('order', 'created_at.asc,id.asc');

  let candidates;
  try {
    const result = await send(candidatesUrl, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!result.ok) throw new Error('candidate query failed');
    candidates = await result.json();
    if (!Array.isArray(candidates) || candidates.some(order =>
      !order || typeof order.id !== 'string' || !Number.isFinite(Date.parse(order.created_at))
    )) throw new Error('candidate response invalid');
  } catch {
    return reply(502, { message: 'Could not load retention candidates' });
  }

  if (!candidates.length) return reply(200, { mode: 'preview', reviewed: 0, review: 0, notPaid: 0 });

  try {
    const stripe = stripeClient || new Stripe(env.STRIPE_RECONCILIATION_KEY, { timeout: 10000, maxNetworkRetries: 0 });
    const earliest = Math.floor(Math.min(...candidates.map(order => new Date(order.created_at).getTime())) / 1000);
    const page = await stripe.checkout.sessions.list({
      payment_link: env.STRIPE_PAYMENT_LINK_ID,
      created: { gte: earliest },
      limit: 100
    });
    if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean' || page.data.some(session => !session)) {
      throw new Error('Stripe response invalid');
    }
    const summary = previewReconciliation(candidates, page.data, !page.has_more);
    // Counts only: do not place order identifiers, contact details, or addresses in logs.
    console.info('SCOUTCARD retention preview complete', summary);
    return reply(200, { mode: 'preview', ...summary });
  } catch {
    // If Stripe cannot be checked, leave all records unchanged and retry on a later review.
    return reply(502, { message: 'Could not reconcile Stripe sessions; no records changed' });
  }
}

export default { fetch: request => handleRetentionPreview(request) };
