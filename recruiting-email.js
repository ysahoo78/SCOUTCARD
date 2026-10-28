import {safeUrl, publicUrl} from './scoutcard-utils.js';
import {presetFor} from './sport-presets-data.js';

// Deliberately use a small allowlist, never stringify a profile or its metadata.
export function cleanText(value, limit = 500) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}
export function recipientEmail(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(text)) {
    throw Error('Enter one valid recipient email address, or leave it blank to draft.');
  }
  return text;
}
export function emailDetails(snapshot) {
  const profile = snapshot.payload || {}, details = profile.details || {}, rows = [];
  const add = (key, label, value, kind = 'detail') => {
    const text = cleanText(value, kind === 'strength' ? 220 : 400);
    if (text) rows.push({key, label, text, kind});
  };
  add('basics', 'Name, sport, position/event and graduation year', [
    cleanText(profile.display_name, 60), cleanText(profile.sport, 40),
    cleanText(profile.position, 80), /^20\d{2}$/.test(profile.graduation_year) ? 'Class of ' + profile.graduation_year : ''
  ].filter(Boolean).join(' · '));
  add('team', 'School / primary team', details.team);
  add('club_team', 'Club / travel team', details.club_team);
  const metrics = details.sport_metrics || {};
  for (const field of presetFor(profile.sport)) add('metric:' + field.key, field.label, metrics[field.key], 'strength');
  add('stats', 'Other stats', details.stats, 'strength');
  add('accolade', 'Achievement', profile.accolade, 'strength');
  add('academics', 'Academics', details.academics, 'strength');
  const highlight = safeUrl(profile.highlight_url);
  if (highlight) rows.push({key:'highlight', label:'Highlight link', text:highlight, kind:'link'});
  add('events', 'Upcoming events — check dates and privacy before sharing', details.events);
  const published = snapshot.published;
  if (published?.id === snapshot.profileId && published.is_public === true && /^[a-z0-9-]{3,100}$/.test(published.slug)) {
    rows.push({key:'profile', label:'Published SCOUTCARD profile', text:publicUrl(published.slug), kind:'link'});
  }
  return rows;
}

export function mailtoUrl({recipient, subject, body}, maxLength = 1900) {
  const email = recipientEmail(recipient);
  if (!email) throw Error('Add the coach’s email address before opening your email app. You can copy the draft without it.');
  const safeSubject = cleanText(subject, 250);
  if (!safeSubject || !String(body || '').trim()) throw Error('Generate or enter a subject and email body first.');
  const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(body)}`;
  if (url.length > maxLength) throw Error('This email is too long for a reliable email-app link. Use Copy subject and Copy email, then paste them into your email app.');
  return url;
}

// No browser storage, telemetry, database writes or third-party generation.
export class EmailDraftBook {
  constructor() { this.clear(); }
  setOwner(owner) { if (owner !== this.owner) { this.drafts.clear(); this.owner = owner || null; } }
  read(profile) { return this.owner ? structuredClone(this.drafts.get(profile) || null) : null; }
  write(profile, value) { if (!this.owner || !profile) throw Error('Select your own profile first.'); this.drafts.set(profile, structuredClone(value)); }
  delete(profile) { this.drafts.delete(profile); }
  clear() { this.owner = null; this.drafts = new Map(); }
  get hasEdits() { return this.drafts.size > 0; }
}
