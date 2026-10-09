import { db } from './scoutcard-client.js';
import { withTimeout } from './scoutcard-utils.js';

const status = document.querySelector('#auth-confirm-status');
const parameters = new URLSearchParams(location.search);
const tokenHash = parameters.get('token_hash');
const type = parameters.get('type');
const requestedReturn = parameters.get('next');

// The hash is a one-time credential. Remove it from the address bar before
// doing any network work or navigating to another page.
history.replaceState(null, '', location.pathname);

function destination() {
  if (requestedReturn) {
    try {
      const url = new URL(requestedReturn);
      if (url.origin === location.origin && url.pathname === '/activate.html') {
        return '/activate.html';
      }
    } catch { /* Use the default destination. */ }
  }
  return '/index.html#setup';
}

async function finishSignIn() {
  if (type !== 'email' || !tokenHash || tokenHash.length < 16 || tokenHash.length > 256) {
    status.textContent = 'This sign-in link is incomplete. Please request a new one from the Set up profile tab.';
    return;
  }
  try {
    const { data, error } = await withTimeout(db.auth.verifyOtp({ token_hash: tokenHash, type: 'email' }));
    if (error) throw error;
    if (!data?.session?.user) throw new Error('No sign-in session was returned.');
    status.textContent = 'You are signed in. Opening SCOUTCARD…';
    location.replace(destination());
  } catch {
    status.textContent = 'This sign-in link expired, was already used, or could not be checked. Please request a new link from the Set up profile tab.';
  }
}

void finishSignIn();
