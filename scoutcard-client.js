import { createClient } from './assets/vendor/supabase-client.js';
import { friendlyError, withTimeout } from './scoutcard-utils.js';
import { createBoundedFetch } from './request-safety.js';

// Only a publishable key belongs in the browser. One client per page avoids auth lock conflicts.
export const db = createClient('https://canyprcqtbvvrrvaoltu.supabase.co', 'sb_publishable_0Qu4eJEl1jRtY6xZeW9Z1Q_dz6GsKYn', { global: { fetch: createBoundedFetch() } });
export const siteOrigin = location.protocol === 'file:' ? 'https://scoutcard.vercel.app' : location.origin;

// Supabase's implicit magic-link session is delivered in the URL fragment.
// Do not put a second fragment (such as /#setup) in emailRedirectTo: it can
// hide the access token before the browser client has a chance to save it.
export function mountAuth(onSession, returnPath = '/') {
  const form = document.querySelector('#signin-form');
  const email = document.querySelector('#signin-email');
  const send = form.querySelector('button');
  const note = document.querySelector('#auth-note');
  const signout = document.querySelector('#signout');
  const identity = document.querySelector('#account-email');
  let currentId;
  let initialized = false;
  let cooldown = 0;

  const apply = session => {
    const user = session?.user || null;
    form.hidden = !!user;
    signout.hidden = !user;
    identity.textContent = user ? `Signed in as ${user.email}` : 'Sign in to save and manage your profile.';
    const id = user?.id || null;
    if (!initialized || id !== currentId) {
      initialized = true;
      currentId = id;
      // Never call Supabase from inside the synchronous auth notification.
      setTimeout(() => Promise.resolve(onSession(user)).catch(error => {
        note.textContent = friendlyError(error);
      }), 0);
    }
    // Only clean an auth callback after Supabase has supplied a user. This
    // leaves ordinary page anchors alone and avoids discarding callback data.
    if (user && /access_token=|refresh_token=/.test(location.hash)) {
      history.replaceState(null, '', `${location.pathname}#profile`);
    }
  };
  db.auth.onAuthStateChange((_event, session) => { apply(session); });
  withTimeout(db.auth.getSession()).then(({ data, error }) => {
    if (error) throw error;
    apply(data.session);
  }).catch(error => { note.textContent = friendlyError(error); });

  const callbackError = new URLSearchParams(location.hash.slice(1)).get('error_description') || new URLSearchParams(location.search).get('error_description');
  if (callbackError) note.textContent = 'That sign-in link has expired or was already used. Request a new link below.';

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || Date.now() < cooldown || send.disabled) return;
    send.disabled = true;
    send.textContent = 'Sending…';
    note.textContent = '';
    try {
      const { error } = await withTimeout(db.auth.signInWithOtp({
        email: email.value.trim().toLowerCase(),
        options: { emailRedirectTo: new URL(returnPath, siteOrigin).href }
      }));
      if (error) throw error;
      note.textContent = 'Check your inbox and spam folder. Open the newest sign-in link in this browser. You can keep editing while you wait.';
      cooldown = Date.now() + 60000;
    } catch (error) {
      note.textContent = friendlyError(error);
      if (error.status === 429) cooldown = Date.now() + 60000;
    } finally {
      if (Date.now() < cooldown) {
        const tick = () => {
          const remaining = Math.ceil((cooldown - Date.now()) / 1000);
          send.textContent = remaining > 0 ? `Request again in ${remaining}s` : 'Email me a sign-in link';
          send.disabled = remaining > 0;
          if (remaining > 0) setTimeout(tick, 1000);
        };
        tick();
      } else { send.disabled = false; send.textContent = 'Email me a sign-in link'; }
    }
  });
  signout.addEventListener('click', async () => {
    signout.disabled = true;
    try {
      const { error } = await withTimeout(db.auth.signOut({ scope: 'local' }));
      if (error) throw error;
      apply(null);
      note.textContent = 'You are signed out on this browser.';
    } catch (error) { note.textContent = friendlyError(error); }
    finally { signout.disabled = false; }
  });
}
