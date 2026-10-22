import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../auth-confirm.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '')
  .replace('void finishSignIn();', 'globalThis.finished = finishSignIn();');
const origin = 'https://www.scoutcard.tech';
const fakeHash = 'test-only-not-a-real-credential-12345';

async function confirm({ next, hash = fakeHash, type = 'email', result, fail, storageFails = false } = {}) {
  const status = { textContent: '' };
  const calls = [];
  const redirects = [];
  const events = [];
  const search = new URLSearchParams();
  if (hash !== null) search.set('token_hash', hash);
  if (type !== null) search.set('type', type);
  if (next !== undefined) search.set('next', next);
  const context = vm.createContext({
    URL, URLSearchParams,
    location: { origin, pathname: '/auth-confirm.html', search: `?${search}`, replace: value => redirects.push(value) },
    history: { replaceState: (...args) => events.push(['redact', ...args]) },
    document: { querySelector: () => status },
    sessionStorage: { setItem: () => { if (storageFails) throw new Error('Storage blocked'); } },
    withTimeout: promise => promise,
    db: { auth: { verifyOtp: async args => {
      events.push(['verify']);
      calls.push(args);
      if (fail) throw new Error('Network failure');
      return result ?? { data: { session: { user: { id: 'test-user' } } }, error: null };
    } } },
  });
  new vm.Script(source).runInContext(context);
  await context.finished;
  return { status: status.textContent, calls, redirects, events };
}

test('confirms an email token and opens athlete setup by default', async () => {
  const result = await confirm();
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].type, 'email');
  assert.equal(result.calls[0].token_hash, fakeHash);
  assert.deepEqual(result.redirects, ['/index.html#setup']);
  assert.equal(result.events[0][0], 'redact');
  assert.equal(result.events[0][3], '/auth-confirm.html');
  assert.equal(result.events[1][0], 'verify');
});

for (const path of ['/family.html', '/activate.html']) {
  test(`preserves the intended ${path} return without extra URL data`, async () => {
    const result = await confirm({ next: `${origin}${path}?ignored=1#ignored` });
    assert.deepEqual(result.redirects, [path]);
  });
}

for (const next of [
  'https://untrusted.example/family.html',
  'https://www.scoutcard.tech.untrusted.example/family.html',
  'http://www.scoutcard.tech/family.html',
  `${origin}/other.html`,
  `${origin}/family.html/extra`,
  'javascript:alert(1)',
  '//untrusted.example/activate.html',
  'not a URL',
  'https://user:password@www.scoutcard.tech/family.html',
]) {
  test(`rejects unapproved return: ${next}`, async () => {
    assert.deepEqual((await confirm({ next })).redirects, ['/index.html#setup']);
  });
}

for (const options of [{ hash: null }, { hash: 'short' }, { hash: 'x'.repeat(257) }, { type: 'recovery' }, { type: null }]) {
  test(`does not submit an incomplete or unsupported verification: ${JSON.stringify(options)}`, async () => {
    const result = await confirm(options);
    assert.equal(result.calls.length, 0);
    assert.equal(result.redirects.length, 0);
    assert.match(result.status, /incomplete/);
  });
}

for (const options of [
  { result: { error: new Error('Expired token') } },
  { result: { data: { session: null }, error: null } },
  { fail: true },
]) {
  test('failed verification shows a recovery message without redirecting', async () => {
    const result = await confirm(options);
    assert.equal(result.redirects.length, 0);
    assert.match(result.status, /request a new link/);
  });
}

test('blocked session storage does not prevent a verified sign-in', async () => {
  assert.deepEqual((await confirm({ storageFails: true })).redirects, ['/index.html#setup']);
});
