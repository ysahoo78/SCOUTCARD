// Liveness only: never expose configuration, credentials, or customer data.
export function health(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({ status: 'ok', service: 'scoutcard' }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
export default { fetch: health };
