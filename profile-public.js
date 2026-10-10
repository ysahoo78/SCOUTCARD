import { db } from './scoutcard-client.js';
import { safeUrl, initials, publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const page = document.querySelector('#profile-page');
const announcement = document.querySelector('#profile-load-announcement');
const slug = new URLSearchParams(location.search).get('athlete');
function unavailable(title, description, retry = false) {
  const section = document.createElement('section'); section.className = 'missing';
  const heading = document.createElement('h1'); heading.textContent = title;
  const text = document.createElement('p'); text.textContent = description;
  const link = document.createElement('a'); link.href = 'index.html'; link.textContent = 'Visit SCOUTCARD';
  section.append(heading, text, link);
  if (retry) { const button = document.createElement('button'); button.textContent = 'Try again'; button.onclick = () => location.reload(); section.append(button); }
  page.replaceChildren(section);
  page.setAttribute('aria-busy', 'false');
  announcement.textContent = `${title}. ${description}`;
}
async function load() {
  if (!slug || !/^[a-z0-9-]{3,60}$/.test(slug)) { unavailable('Incomplete profile link', 'Ask the athlete for their full SCOUTCARD profile link.'); return; }
  try {
    const { data, error } = await withTimeout(db.from('athlete_profiles').select('id,slug,display_name,sport,graduation_year,position,accolade,highlight_url,details').eq('slug', slug).eq('is_public', true).maybeSingle());
    if (error) throw error;
    if (!data) { unavailable('Profile not available', 'This profile may be private, removed, or not published yet.'); return; }
    const node = document.querySelector('#profile-template').content.cloneNode(true);
    const set = (id, value) => { node.querySelector('#' + id).textContent = value || 'Not added yet'; };
    document.title = data.display_name + ' | SCOUTCARD';
    set('initials', initials(data.display_name)); set('name', data.display_name);
    for (const [id, key] of Object.entries({sport:'sport',position:'position',year:'graduation_year',accolade:'accolade','detail-sport':'sport','detail-position':'position','detail-year':'graduation_year'})) set(id, data[key]);
    for (const field of ['team','stats','academics','events','bio']) set(field, typeof data.details?.[field] === 'string' ? data.details[field] : '');
    node.querySelector('#accolade').hidden = !data.accolade;
    const highlight = safeUrl(data.highlight_url);
    if (highlight) { node.querySelector('#highlight').href = highlight; node.querySelector('#highlight').hidden = false; }
    else set('highlight-note', 'No highlight link has been added yet.');
    page.replaceChildren(node);
    page.setAttribute('aria-busy', 'false');
    announcement.textContent = `${data.display_name} profile loaded.`;
    document.querySelector('#share').hidden = false; document.querySelector('#print-profile').hidden = false;
    document.querySelector('#message-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector('button'), note = document.querySelector('#message-note');
      if (button.disabled || !form.reportValidity()) return;
      button.disabled = true; button.textContent = 'Sending…';
      form.setAttribute('aria-busy', 'true');
      note.textContent = 'Sending your message…'; note.dataset.state = 'busy';
      try {
        const { error } = await withTimeout(db.rpc('send_coach_message', {
          athlete_id:data.id, sender_name:document.querySelector('#coach-name').value.trim(),
          sender_email:document.querySelector('#coach-email').value.trim().toLowerCase(),
          message_text:document.querySelector('#coach-message').value.trim()
        }));
        if (error) throw error;
        note.textContent = 'Message delivered to the athlete’s inbox. They can reply to the email you provided.';
        note.dataset.state = 'success';
        form.reset();
      } catch (error) { note.textContent = friendlyError(error); note.dataset.state = 'error'; }
      finally { form.setAttribute('aria-busy', 'false'); button.disabled = false; button.textContent = 'Send message →'; }
    });
  } catch (error) { unavailable('Could not load this profile', friendlyError(error), true); }
}
document.querySelector('#share').addEventListener('click', async () => {
  const note = document.querySelector('#share-note');
  const link = publicUrl(slug);
  try {
    if (navigator.share) await navigator.share({title:document.title, url:link});
    else { await navigator.clipboard.writeText(link); note.textContent = 'Profile link copied.'; }
  } catch (error) { if (error.name !== 'AbortError') note.textContent = 'Copy this page’s address from your browser to share it.'; }
});
document.querySelector('#print-profile').addEventListener('click', () => window.print());
load();
