import { db, mountAuth } from './scoutcard-client.js';
import { canonicalOrigin, publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
import { createProfileOnboarding } from './profile-onboarding.js';
import { readPurchaseStatus } from './purchase-status.js';
const $ = id => document.getElementById(id);
const form = $('athlete-form'), save = $('save-profile'), status = $('profile-status');
let user = null;
let connectedCard = false;
let purchased = null, accountVersion = 0;
function purchaseGuidance(){
 document.querySelectorAll('[data-card-purchase]').forEach(link=>link.hidden=connectedCard||purchased===true);
 const note=$('order-known-purchase');note.hidden=purchased!==true;
 const box=$('profile-link-box');if(!box.hidden){box.querySelector('.next-links a').hidden=connectedCard||purchased===true;if(purchased===true&&!connectedCard)box.querySelector('.next-note').textContent='A card purchase is confirmed for this account. Don’t pay again for the same card. When the physical card arrives, activate it using its private code. Buying does not automatically activate it.';}
}
const editor=createProfileOnboarding({db,onPublished:profile=>{showLink(profile.slug,profile.is_public);loadCards(user.id);}});
const builder=$('profile');builder.hidden=true;
function showLink(slug, isPublic = false) {
  $('profile-link-box').hidden = !slug || !isPublic;
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
async function loadList(id, { target, table, columns, dateField, empty, render, onPage=()=>{} }) {
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
      onPage(page);
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
    onPage(cards){connectedCard=connectedCard||cards.length>0;editor.setCardConnected(connectedCard);purchaseGuidance();const box=$('profile-link-box');if(box.hidden)return;box.querySelector('.saved-step').textContent=connectedCard?'Profile published · Card connected. You’re ready to share.':'Profile published · No card connected yet.';const links=box.querySelectorAll('.next-links a');links[0].hidden=connectedCard;links[0].textContent='Need a card? Buy a SCOUTCARD →';links[1].hidden=connectedCard;box.querySelector('.next-note').textContent=connectedCard?'Your connected card links are listed under Your cards below. Private draft edits do not change what coaches see until you publish again.':'Already bought a card? Don’t pay again. Activate your physical card using its private code when received. No connected card does not mean you have not paid; unlinked online and cash purchases cannot be checked here.';purchaseGuidance();},
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
  user=nextUser;const version=++accountVersion;connectedCard=false;purchased=null;editor.reset();showLink('');builder.hidden=!user;purchaseGuidance();
  $('athlete-workspace').hidden=!user;
  if(!user){$('inbox').replaceChildren();$('cards-list').replaceChildren();return;}
  const id=user.id;
  readPurchaseStatus(db,user).then(value=>{if(accountVersion!==version)return;purchased=value;editor.setPurchased(value);purchaseGuidance();});
  try {
    const {data,error}=await withTimeout(db.from('athlete_profiles').select('id,slug,display_name,sport,graduation_year,position,accolade,highlight_url,details,is_public,headshot_path').eq('id',id).maybeSingle());
    if(user?.id!==id)return;if(error)throw error;
    if(data)showLink(data.slug,data.is_public);
    await editor.open({user,profileId:id,profile:data});
  } catch(error){if(user?.id===id){status.textContent=friendlyError(error)+' Refresh to retry. Your existing public profile has not changed.';status.dataset.state='error';}}
  if(user?.id===id)await Promise.allSettled([loadInbox(id),loadCards(id)]);
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
