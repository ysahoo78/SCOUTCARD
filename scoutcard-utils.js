// Pure helpers shared by the browser and regression tests.
export const canonicalOrigin = 'https://www.scoutcard.tech';
export function safeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return '';
    return url.href;
  } catch { return ''; }
}

export function profileSlug(name, id) {
  const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 22).replace(/-$/, '') || 'athlete';
  return `${base}-${id.replace(/-/g, '')}`;
}

export function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'SC';
}

export function publicUrl(slug, origin = canonicalOrigin) {
  return `${origin}/profile.html?athlete=${encodeURIComponent(slug)}`;
}

export function friendlyError(error) {
  const message = String(error?.message || 'An unexpected error occurred.');
  if (error?.code === '23505') return 'That profile address is already in use. Please try saving again.';
  if (error?.status === 429 || /rate.limit|too many|security purposes/i.test(message)) return 'Too many requests. Please wait before trying again.';
  if (/schema cache|column .* does not exist|Could not find the function/i.test(message)) return 'This feature needs the latest website database update. Please contact SCOUTCARD support.';
  if (/abort|failed to fetch|network|timeout|timed out/i.test(message)) return 'The connection was interrupted. Your last action may have completed. Check its status before submitting again.';
  if (/jwt|session.*expired|refresh token/i.test(message)) return 'Your session has expired. Please sign out and sign in again.';
  return message;
}

export async function withTimeout(promise, milliseconds = 20000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function checkoutUrl(base, orderId, email) {
  const url = new URL(base);
  url.searchParams.set('client_reference_id', orderId);
  url.searchParams.set('prefilled_email', email);
  return url.href;
}
