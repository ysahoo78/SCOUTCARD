// Server-only. Never infer payment from browser input or card activation.
export class AccessError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export async function checkPaidAccount(request, env, send) {
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) throw new AccessError('Sign in first.', 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Configuration');
  const origin = new URL(env.SUPABASE_URL), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (origin.protocol !== 'https:') throw Error('Configuration');
  const signal = AbortSignal.timeout(8000);
  const auth = await send(new URL('/auth/v1/user', origin), {
    headers:{apikey:key, Authorization:authorization}, cache:'no-store', signal
  });
  if (!auth.ok) {
    if ([401,403].includes(auth.status)) throw new AccessError('Sign in again to verify your account.', 401);
    throw Error('Auth unavailable');
  }
  const user = await auth.json();
  if (!user?.id || !user.email_confirmed_at || typeof user.email !== 'string' || user.is_anonymous) throw new AccessError('A confirmed email account is required.', 401);
  const email = user.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@,()"\\]+@[^\s@,()"\\]+\.[^\s@,()"\\]+$/.test(email)) throw Error('Account email');
  const url = new URL('/rest/v1/card_orders', origin);
  url.searchParams.set('select','id'); url.searchParams.set('email','eq.' + email);
  url.searchParams.set('status','in.(paid,shipped,fulfilled)');
  url.searchParams.set('paid_at','not.is.null'); url.searchParams.set('limit','1');
  const orders = await send(url, {headers:{apikey:key, Authorization:'Bearer ' + key}, cache:'no-store', signal});
  if (!orders.ok) throw Error('Order lookup');
  const rows = await orders.json();
  if (!Array.isArray(rows) || rows.length > 1 || rows.some(row => !row || typeof row.id !== 'string')) throw Error('Order response');
  return {user, purchased:rows.length === 1, origin, key, authorization, signal};
}
