import { db, mountAuth, siteOrigin } from './scoutcard-client.js';
import { publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const form = document.querySelector('#activate-form'), note = document.querySelector('#note');
let user = null;
mountAuth(next => {
  user = next;
  form.hidden = !user;
  document.querySelector('#activation-links').hidden = true;
  note.textContent = user ? 'Enter your card’s activation code below.' : 'Sign in above to connect your card.';
}, '/activate.html');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button'), code = document.querySelector('#activation-code').value.trim().toUpperCase();
  if (!user || button.disabled || !form.reportValidity()) return;
  const id = user.id;
  button.disabled = true; button.textContent = 'Activating…';
  note.textContent = ''; document.querySelector('#activation-links').hidden = true;
  try {
    const { data:profile, error:profileError } = await withTimeout(db.from('athlete_profiles').select('slug,is_public').eq('id', id).maybeSingle());
    if (profileError) throw profileError;
    if (!profile) { note.textContent = 'Save your athlete profile on the Set up profile tab first, then return here.'; return; }
    const { data, error } = await withTimeout(db.rpc('activate_athlete_card', { card_code:code }));
    if (error) throw error;
    if (user?.id !== id) return;
    if (!data) { note.textContent = 'This code was not found or belongs to another account. Check the code printed in your package.'; return; }
    note.textContent = profile.is_public ? 'Your card is connected. Taps and scans can now open your profile.' : 'Your card is connected. Publish your profile from Set up profile before sharing it with coaches.';
    document.querySelector('#activated-profile').href = publicUrl(profile.slug, siteOrigin);
    document.querySelector('#activation-links').hidden = false;
    form.reset();
  } catch (error) { note.textContent = friendlyError(error); }
  finally { button.disabled = false; button.textContent = 'Activate my card →'; }
});
