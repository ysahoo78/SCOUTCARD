import { db } from './scoutcard-client.js';
import { publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const token = new URLSearchParams(location.search).get('card');
const note = document.querySelector('#card-status'), retry = document.querySelector('#retry-card');
retry.onclick = () => location.reload();
async function resolve() {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')) { note.textContent = 'This card link is incomplete. Tap your NFC card again, or ask the owner for their profile link.'; return; }
  try {
    const { data, error } = await withTimeout(db.rpc('resolve_scoutcard', { card_token:token }));
    if (error) throw error;
    if (!data) { note.textContent = 'This card has no public profile yet. Its owner needs to activate it and publish their profile.'; return; }
    if (!/^[a-z0-9-]{3,60}$/.test(data)) throw new Error('This card could not be resolved.');
    const link = document.querySelector('#card-destination');
    link.href = publicUrl(data); link.hidden = false;
    note.textContent = 'Opening the athlete’s profile…';
    location.replace(link.href);
  } catch (error) { note.textContent = friendlyError(error); retry.hidden = false; }
}
resolve();
