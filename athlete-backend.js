import { db, mountAuth } from './scoutcard-client.js';
import { canonicalOrigin, safeUrl, profileSlug, publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const $ = id => document.getElementById(id);
const form = $('athlete-form'), save = $('save-profile'), status = $('profile-status');
const fields = { name:'display_name', sport:'sport', grad:'graduation_year', position:'position', accolade:'accolade', highlight:'highlight_url' };
const extraFields = ['team', 'stats', 'academics', 'events', 'bio'];
const touched = new Set();
let user = null, savedSlug = '', dirty = false, ready = false, revision = 0;
form.addEventListener('input', event => {
  if (event.target?.id) touched.add(event.target.id);
  dirty = true; revision++;
  status.dataset.state = 'neutral';
  status.textContent = 'You have unsaved changes.';
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
function showLink(slug, isPublic = false) {
  $('profile-link-box').hidden = !slug;
  let action = $('saved-profile-action');
  if (!action) {
    action = document.createElement('a');
    action.id = 'saved-profile-action';
    action.textContent = 'View my published profile →';
    action.target = '_blank'; action.rel = 'noopener';
    status.after(action);
  }
  action.hidden = !slug || !isPublic;
  if (slug) {
    $('public-link').href = publicUrl(slug);
    $('public-link').textContent = publicUrl(slug);
    action.href = publicUrl(slug);
  }
}
const listVersions = new Map();
async function loadList(id, { target, table, columns, dateField, empty, render }) {
  const container = $(target), version = (listVersions.get(target) || 0) + 1;
  listVersions.set(target, version);
  let cursor = null, busy = false;
  const current = () => user?.id === id && listVersions.get(target) === version;
  const items = document.createElement('div');
  const note = document.createElement('p'); note.setAttribute('role', 'status');
  const more = document.createElement('button'); more.type = 'button'; more.className = 'secondary';
  more.textContent = 'Load more'; more.hidden = true;
  container.replaceChildren(items, note, more);
  async function next() {
    if (busy || !current()) return;
    busy = true; more.disabled = true; note.textContent = 'Loading…';
    container.setAttribute('aria-busy', 'true');
    try {
      let query = db.from(table).select(columns).eq('profile_id', id)
        .order(dateField, { ascending: false }).order('id', { ascending: false }).limit(21);
      if (cursor) query = query.or(`${dateField}.lt.${cursor.date},and(${dateField}.eq.${cursor.date},id.lt.${cursor.id})`);
      const { data, error } = await withTimeout(query);
      if (!current()) return;
      if (error) throw error;
      const page = data.slice(0, 20);
      for (const item of page) items.append(render(item));
      if (page.length) {
        const last = page.at(-1);
        // Preserve database microseconds so records sharing a millisecond are not skipped.
        if (!/^[0-9T:.+Z-]+$/.test(last[dateField]) || !/^[0-9a-f-]{36}$/i.test(last.id)) throw new Error('Unable to load the next page. Refresh to retry.');
        cursor = { date: last[dateField], id: last.id };
      }
      more.hidden = data.length <= 20; more.textContent = 'Load more';
      note.textContent = items.childElementCount ? `Showing ${items.childElementCount} items.` : empty;
    } catch (error) {
      if (current()) { note.textContent = friendlyError(error); more.hidden = false; more.textContent = 'Try again'; }
    } finally {
      busy = false;
      if (current()) { more.disabled = false; container.setAttribute('aria-busy', 'false'); }
    }
  }
  more.addEventListener('click', next);
  await next();
}
async function loadInbox(id) {
  await loadList(id, {
    target: 'inbox', table: 'coach_messages',
    columns: 'id,coach_name,coach_email,message,created_at', dateField: 'created_at',
    empty: 'No messages yet. Share your published profile to start a conversation.',
    render(message) {
      const item = document.createElement('article'); item.className = 'message';
      const name = document.createElement('h3'); name.textContent = message.coach_name;
      const date = document.createElement('small'); date.textContent = new Date(message.created_at).toLocaleString();
      const text = document.createElement('p'); text.textContent = message.message;
      const reply = document.createElement('a'); reply.textContent = 'Reply by email';
      reply.href = 'mailto:' + encodeURIComponent(message.coach_email);
      item.append(name, date, text, reply); return item;
    }
  });
}
async function loadCards(id) {
  await loadList(id, {
    target: 'cards-list', table: 'athlete_cards',
    columns: 'id,public_token,activated_at', dateField: 'activated_at',
    empty: 'No activated cards yet. Activate your card using the private code included with it.',
    render(card) {
      const item = document.createElement('div'); item.className = 'card-item';
      const label = document.createElement('p'); label.textContent = 'Active card · ' + new Date(card.activated_at).toLocaleDateString();
      const link = document.createElement('a'); link.href = canonicalOrigin + '/card.html?card=' + encodeURIComponent(card.public_token);
      link.textContent = link.href; link.target = '_blank'; link.rel = 'noopener';
      item.append(label, link); return item;
    }
  });
}
mountAuth(async nextUser => {
  const previousId = user?.id;
  user = nextUser; ready = false; save.disabled = true; savedSlug = ''; showLink('');
  $('athlete-workspace').hidden = !user;
  if (!user) {
    if (previousId) { form.reset(); dirty = false; touched.clear(); revision++; document.dispatchEvent(new Event('profile-loaded')); }
    $('inbox').replaceChildren(); $('cards-list').replaceChildren();
    save.textContent = 'Sign in to save';
    status.textContent = 'Sign in above to save. Your email stays private.';
    status.dataset.state = 'neutral';
    return;
  }
  const id = user.id;
  save.textContent = 'Loading your profile…';
  status.textContent = 'Loading your saved profile…';
  status.dataset.state = 'busy';
  try {
    const { data, error } = await withTimeout(db.from('athlete_profiles').select('slug,display_name,sport,graduation_year,position,accolade,highlight_url,details,is_public').eq('id', id).maybeSingle());
    if (user?.id !== id) return;
    if (error) throw error;
    if (data) {
      savedSlug = data.slug;
      for (const [field, key] of Object.entries(fields)) {
        if (!touched.has(field)) $(field).value = data[key] || '';
      }
      for (const key of extraFields) {
        if (!touched.has(key)) $(key).value = typeof data.details?.[key] === 'string' ? data.details[key] : '';
      }
      if (!touched.has('is-public')) $('is-public').checked = data.is_public === true;
      showLink(savedSlug, data.is_public);
    }
    ready = true;
    status.textContent = dirty ? 'Your draft is still here. Review it, then save when ready.' : data ? 'Your saved profile is ready to edit.' : 'Start with your name and sport. Publish when you are ready.';
    status.dataset.state = 'neutral';
    document.dispatchEvent(new Event('profile-loaded'));
  } catch (error) { if (user?.id === id) { status.textContent = friendlyError(error) + ' Refresh this page to retry loading your profile.'; status.dataset.state = 'error'; } }
  finally { if (user?.id === id) { save.disabled = !ready; save.textContent = 'Save my profile →'; } }
  if (user?.id === id) await Promise.allSettled([loadInbox(id), loadCards(id)]);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!user || !ready || save.disabled || !form.reportValidity()) return;
  const id = user.id, saveRevision = revision;
  const name = $('name').value.trim(), sport = $('sport').value.trim();
  if (!name || !sport) { status.textContent = 'Add your name and sport before saving.'; status.dataset.state = 'error'; return; }
  const highlight = safeUrl($('highlight').value);
  if ($('highlight').value.trim() && !highlight) { status.textContent = 'Use a valid http or https highlight link.'; status.dataset.state = 'error'; $('highlight').focus(); return; }
  const payload = { id, slug:savedSlug || profileSlug(name, id), display_name:name, sport,
    graduation_year:$('grad').value.trim(), position:$('position').value.trim(),
    accolade:$('accolade').value.trim(), highlight_url:highlight,
    details:Object.fromEntries(extraFields.map(key => [key, $(key).value.trim()])),
    is_public:$('is-public').checked, updated_at:new Date().toISOString() };
  save.disabled = true; save.textContent = 'Saving…'; status.textContent = 'Saving your profile…';
  status.dataset.state = 'busy'; form.setAttribute('aria-busy', 'true');
  try {
    const { error } = await withTimeout(db.from('athlete_profiles').upsert(payload, { onConflict:'id' }));
    if (error) throw error;
    if (user?.id !== id) return;
    savedSlug = payload.slug; dirty = revision !== saveRevision; showLink(savedSlug, payload.is_public);
    if (!dirty) touched.clear();
    status.textContent = dirty ? 'Saved. You also have newer unsaved changes.' : payload.is_public ? 'Profile saved and published. Open your link to see what coaches see.' : 'Profile saved privately. Check “Publish my profile” and save when you want to share it.';
    status.dataset.state = 'success';
  } catch (error) { if (user?.id === id) { status.textContent = friendlyError(error); status.dataset.state = 'error'; } }
  finally { form.setAttribute('aria-busy', 'false'); if (user?.id === id) { save.disabled = false; save.textContent = 'Save my profile →'; } }
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
