import { db, mountAuth, siteOrigin } from './scoutcard-client.js';
import { safeUrl, profileSlug, publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const $ = id => document.getElementById(id);
const form = $('athlete-form'), save = $('save-profile'), status = $('profile-status');
const fields = { name:'display_name', sport:'sport', grad:'graduation_year', position:'position', accolade:'accolade', highlight:'highlight_url' };
const extraFields = ['team', 'stats', 'academics', 'events', 'bio'];
let user = null, savedSlug = '', dirty = false, ready = false, revision = 0;
form.addEventListener('input', () => { dirty = true; revision++; status.textContent = 'You have unsaved changes.'; });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
function showLink(slug) {
  $('profile-link-box').hidden = !slug;
  if (slug) {
    $('public-link').href = publicUrl(slug, siteOrigin);
    $('public-link').textContent = publicUrl(slug, siteOrigin);
  }
}
async function loadInbox(id) {
  $('inbox').textContent = 'Loading messages…';
  try {
    const { data, error } = await withTimeout(db.from('coach_messages').select('id,coach_name,coach_email,message,created_at').eq('profile_id', id).order('created_at', { ascending:false }).limit(50));
    if (user?.id !== id) return;
    if (error) throw error;
    $('inbox').replaceChildren();
    if (!data.length) { $('inbox').textContent = 'No messages yet. Share your published profile to start a conversation.'; return; }
    for (const message of data) {
      const item = document.createElement('article'); item.className = 'message';
      const name = document.createElement('h3'); name.textContent = message.coach_name;
      const date = document.createElement('small'); date.textContent = new Date(message.created_at).toLocaleString();
      const text = document.createElement('p'); text.textContent = message.message;
      const reply = document.createElement('a'); reply.textContent = 'Reply by email';
      reply.href = 'mailto:' + encodeURIComponent(message.coach_email);
      item.append(name, date, text, reply); $('inbox').append(item);
    }
  } catch (error) { if (user?.id === id) $('inbox').textContent = friendlyError(error); }
}
async function loadCards(id) {
  $('cards-list').textContent = 'Loading cards…';
  try {
    const { data, error } = await withTimeout(db.from('athlete_cards').select('id,public_token,activated_at').eq('profile_id', id));
    if (user?.id !== id) return;
    if (error) throw error;
    $('cards-list').replaceChildren();
    if (!data.length) { $('cards-list').textContent = 'No activated cards yet.'; return; }
    for (const card of data) {
      const item = document.createElement('div'); item.className = 'card-item';
      const label = document.createElement('p'); label.textContent = 'Active card · ' + new Date(card.activated_at).toLocaleDateString();
      const link = document.createElement('a'); link.href = siteOrigin + '/card.html?card=' + encodeURIComponent(card.public_token);
      link.textContent = link.href; link.target = '_blank'; link.rel = 'noopener';
      item.append(label, link); $('cards-list').append(item);
    }
  } catch (error) { if (user?.id === id) $('cards-list').textContent = friendlyError(error); }
}
mountAuth(async nextUser => {
  const previousId = user?.id;
  user = nextUser; ready = false; save.disabled = true; savedSlug = ''; showLink('');
  $('athlete-workspace').hidden = !user;
  if (!user) {
    if (previousId) { form.reset(); dirty = false; revision++; document.dispatchEvent(new Event('profile-loaded')); }
    $('inbox').replaceChildren(); $('cards-list').replaceChildren();
    save.textContent = 'Sign in to save';
    status.textContent = 'Sign in above to save. Your email stays private.';
    return;
  }
  const id = user.id;
  save.textContent = 'Loading your profile…';
  try {
    const { data, error } = await withTimeout(db.from('athlete_profiles').select('slug,display_name,sport,graduation_year,position,accolade,highlight_url,details,is_public').eq('id', id).maybeSingle());
    if (user?.id !== id) return;
    if (error) throw error;
    if (data) {
      savedSlug = data.slug;
      if (!dirty) {
        for (const [field, key] of Object.entries(fields)) $(field).value = data[key] || '';
        for (const key of extraFields) $(key).value = typeof data.details?.[key] === 'string' ? data.details[key] : '';
        $('is-public').checked = data.is_public === true;
      }
      showLink(savedSlug);
    }
    ready = true;
    status.textContent = dirty ? 'You have unsaved changes.' : data ? 'Your saved profile is ready to edit.' : 'Start with your name and sport. Publish when you are ready.';
    document.dispatchEvent(new Event('profile-loaded'));
  } catch (error) { if (user?.id === id) status.textContent = friendlyError(error) + ' Refresh this page to retry loading your profile.'; }
  finally { if (user?.id === id) { save.disabled = !ready; save.textContent = 'Save my profile →'; } }
  if (user?.id === id) await Promise.allSettled([loadInbox(id), loadCards(id)]);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!user || !ready || save.disabled || !form.reportValidity()) return;
  const id = user.id, saveRevision = revision;
  const name = $('name').value.trim(), sport = $('sport').value.trim();
  if (!name || !sport) { status.textContent = 'Add your name and sport before saving.'; return; }
  const highlight = safeUrl($('highlight').value);
  if ($('highlight').value.trim() && !highlight) { status.textContent = 'Use a valid http or https highlight link.'; $('highlight').focus(); return; }
  const payload = { id, slug:savedSlug || profileSlug(name, id), display_name:name, sport,
    graduation_year:$('grad').value.trim(), position:$('position').value.trim(),
    accolade:$('accolade').value.trim(), highlight_url:highlight,
    details:Object.fromEntries(extraFields.map(key => [key, $(key).value.trim()])),
    is_public:$('is-public').checked, updated_at:new Date().toISOString() };
  save.disabled = true; save.textContent = 'Saving…'; status.textContent = 'Saving your profile…';
  try {
    const { error } = await withTimeout(db.from('athlete_profiles').upsert(payload, { onConflict:'id' }));
    if (error) throw error;
    if (user?.id !== id) return;
    savedSlug = payload.slug; dirty = revision !== saveRevision; showLink(savedSlug);
    status.textContent = dirty ? 'Saved. You also have newer unsaved changes.' : payload.is_public ? 'Profile saved and published. Open your link to see what coaches see.' : 'Profile saved privately. Check “Publish my profile” and save when you want to share it.';
  } catch (error) { if (user?.id === id) status.textContent = friendlyError(error); }
  finally { if (user?.id === id) { save.disabled = false; save.textContent = 'Save my profile →'; } }
});
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('public-link').href); status.textContent = 'Profile link copied.'; }
  catch { status.textContent = 'Select and copy the profile link above.'; }
});
$('refresh-inbox').addEventListener('click', async () => {
  if (!user) return;
  $('refresh-inbox').disabled = true;
  await loadInbox(user.id);
  $('refresh-inbox').disabled = false;
});
