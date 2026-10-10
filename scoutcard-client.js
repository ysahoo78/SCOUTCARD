import { createClient } from './assets/vendor/supabase-client.js';
import { canonicalOrigin, friendlyError, withTimeout } from './scoutcard-utils.js';
import { createBoundedFetch } from './request-safety.js';

// Only a publishable key belongs in the browser. One client per page avoids auth lock conflicts.
export const db = createClient('https://canyprcqtbvvrrvaoltu.supabase.co', 'sb_publishable_0Qu4eJEl1jRtY6xZeW9Z1Q_dz6GsKYn', { global: { fetch: createBoundedFetch() } });
// Keep sign-in on the page's current host so existing Vercel sessions and
// unfinished form edits are not lost when an older link is used.
export const siteOrigin = location.protocol === 'file:' ? canonicalOrigin : location.origin;

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
  // Avoid briefly showing a sign-in form while an existing session is loading.
  form.hidden = true;

  const apply = session => {
    const user = session?.user || null;
    const legacyReturn = !!user && /access_token=|refresh_token=/.test(location.hash);
    form.hidden = !!user;
    signout.hidden = !user;
    identity.textContent = user ? `Signed in as ${user.email}` : 'Sign in to save and manage your profile.';
    if (user) {
      let justSignedIn = false;
      try {
        justSignedIn = sessionStorage.getItem('scoutcard-signin-complete') === '1';
        if (justSignedIn) sessionStorage.removeItem('scoutcard-signin-complete');
      } catch {}
      if (justSignedIn || legacyReturn) {
        note.textContent = document.querySelector('#activate-form')
          ? 'You are signed in. Enter your card code below to connect it.'
          : 'You are signed in. You can edit your profile below.';
        note.dataset.state = 'success';
        const target = document.querySelector('#account') || document.querySelector('.auth-panel');
        requestAnimationFrame(() => target?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        }));
      }
    }
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
    if (legacyReturn) {
      history.replaceState(null, '', `${location.pathname}#profile`);
    }
  };
  db.auth.onAuthStateChange((_event, session) => { apply(session); });
  withTimeout(db.auth.getSession()).then(({ data, error }) => {
    if (error) throw error;
    apply(data.session);
  }).catch(error => {
    if (!initialized) { form.hidden = false; identity.textContent = 'Sign-in status could not be checked.'; }
    note.textContent = friendlyError(error); note.dataset.state = 'error';
  });

  const callbackError = new URLSearchParams(location.hash.slice(1)).get('error_description') || new URLSearchParams(location.search).get('error_description');
  if (callbackError) { note.textContent = 'That sign-in link has expired or was already used. Request a new link below.'; note.dataset.state = 'error'; }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || Date.now() < cooldown || send.disabled) return;
    send.disabled = true;
    send.textContent = 'Sending…';
    note.textContent = 'Sending your sign-in link…';
    note.dataset.state = 'busy';
    form.setAttribute('aria-busy', 'true');
    try {
      const { error } = await withTimeout(db.auth.signInWithOtp({
        email: email.value.trim().toLowerCase(),
        options: { emailRedirectTo: new URL(returnPath, siteOrigin).href }
      }));
      if (error) throw error;
      note.textContent = document.querySelector('#athlete-form')
        ? 'Link sent. Check your inbox or spam folder. If it opens a new tab, return to this one afterward—anything you typed here is still here.'
        : 'Link sent. Check your inbox or spam folder, then open the newest sign-in link in this browser.';
      note.dataset.state = 'success';
      cooldown = Date.now() + 60000;
    } catch (error) {
      note.textContent = friendlyError(error);
      note.dataset.state = 'error';
      if (error.status === 429) cooldown = Date.now() + 60000;
    } finally {
      form.setAttribute('aria-busy', 'false');
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
      note.dataset.state = 'success';
    } catch (error) { note.textContent = friendlyError(error); }
    finally { signout.disabled = false; }
  });
}
