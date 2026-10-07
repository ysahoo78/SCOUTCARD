// Shared transport safeguards. Never automatically retry writes.
export class RequestLimitError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function readBoundedBody(message, { maxBytes = 262144, timeoutMs = 10000 } = {}) {
  const length = Number(message.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) {
    await message.body?.cancel().catch(() => {});
    throw new RequestLimitError('Payload too large', 413);
  }
  if (!message.body) return new Uint8Array();
  const reader = message.body.getReader();
  const chunks = []; let size = 0, timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new RequestLimitError('Request timed out', 408));
    }, timeoutMs);
  });
  try {
    await Promise.race([expired, (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new RequestLimitError('Payload too large', 413);
        chunks.push(value);
      }
    })()]);
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) { void reader.cancel().catch(() => {}); throw error; }
  finally { clearTimeout(timer); reader.releaseLock(); }
}

export function createBoundedFetch(send = fetch, timeoutMs = 15000) {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const upstream = init.signal || input?.signal;
    const abort = () => controller.abort(upstream.reason);
    if (upstream?.aborted) abort();
    else upstream?.addEventListener('abort', abort, { once: true });
    let timer;
    const expired = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestLimitError('Request timed out. The operation may have completed; check before retrying.', 408));
      }, timeoutMs);
    });
    try {
      return await Promise.race([expired, (async () => {
        const response = await send(input, { ...init, signal: controller.signal });
        // Codes only: never log URLs, auth tokens, request bodies, or personal data.
        if (response.status >= 500) console.warn('SCOUTCARD upstream failure', { status: response.status });
        const bytes = await readBoundedBody(response, { maxBytes: 1048576, timeoutMs });
        return new Response([204, 205, 304].includes(response.status) ? null : bytes, {
          status: response.status, statusText: response.statusText, headers: response.headers
        });
      })()]);
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', abort);
    }
  };
}
