// Server-only generation. The API verifies payment and ownership before calling.
import {cleanText, emailDetails, recipientEmail} from '../../recruiting-email.js';

export function generateRecruitingEmail(snapshot, options) {
  if (!snapshot?.ownerId || !snapshot.profileId) throw Error('Sign in and select your own saved athlete draft first.');
  const coach = cleanText(options.coach, 80), program = cleanText(options.program, 120);
  const why = cleanText(options.why, 650), context = cleanText(options.context, 500);
  const purpose = ['introduction','event','followup'].includes(options.purpose) ? options.purpose : 'introduction';
  recipientEmail(options.recipient);
  if (!program) throw Error('Add the college or organization so this email has a clear recipient.');
  if (!why) throw Error('Add your own reason for being interested in this program. We will not invent one.');
  if (purpose === 'followup' && !context) throw Error('Describe what you are following up on, without inventing previous contact.');
  if (snapshot.parent && !options.childConfirmed) throw Error('Confirm the selected child before generating their email.');
  const selected = new Set(options.include || []), all = emailDetails(snapshot);
  const rows = all.filter(row => selected.has(row.key));
  if (!rows.length) throw Error('Choose at least one saved profile detail to include. A complete profile is not required.');
  const basics = selected.has('basics') ? snapshot.payload || {} : {};
  const name = cleanText(basics.display_name, 60), sport = cleanText(basics.sport, 40);
  const position = cleanText(basics.position, 80);
  const year = /^20\d{2}$/.test(basics.graduation_year) ? basics.graduation_year : '';
  const parent = snapshot.parent === true, who = name || (parent ? 'my child' : 'an athlete');
  const identity = parent ? `I am ${name ? 'the parent or guardian of ' + name : 'a parent or guardian reaching out about my child'}.`
    : name ? `My name is ${name}.` : 'I am reaching out to introduce myself as a prospective athlete.';
  const intro = [identity];
  if (sport) intro.push(parent ? `${name || 'My child'} competes in ${sport}.` : `I compete in ${sport}.`);
  if (position) intro.push(`${parent ? 'Their' : 'My'} position/event is ${position}.`);
  if (year) intro.push(`${parent ? 'Their' : 'My'} expected graduation year is ${year}.`);
  const lines = [`Hello ${coach || 'Coach'},`, '', intro.join(' '), '',
    `${parent ? 'We are' : 'I am'} interested in ${program}. ${why}`, ''];
  const teams = rows.filter(row => ['team','club_team'].includes(row.key));
  if (teams.length) lines.push(teams.map(row => `${row.label}: ${row.text}`).join('\n'), '');
  const strengths = rows.filter(row => row.kind === 'strength').slice(0, 3);
  if (strengths.length) lines.push('A few details for your consideration:', ...strengths.map(row => `• ${row.label}: ${row.text}`), '');
  const events = rows.find(row => row.key === 'events');
  if (purpose === 'event') {
    const description = context || events?.text;
    if (!description) throw Error('Add event details, or select an upcoming event from the saved profile.');
    lines.push(`Upcoming competition: ${description}`, 'If you are attending and recruiting in this sport, would you be available to watch or connect at an appropriate time?', '');
  } else if (purpose === 'followup') {
    lines.push(`A brief follow-up: ${context}`, '');
    if (events) lines.push(`Upcoming events: ${events.text}`, '');
  } else if (events) lines.push(`Upcoming events: ${events.text}`, '');
  for (const row of rows.filter(row => row.kind === 'link')) lines.push(`${row.key === 'profile' ? 'SCOUTCARD profile' : 'Highlights'}: ${row.text}`);
  if (rows.some(row => row.kind === 'link')) lines.push('');
  lines.push(`I would appreciate learning more about your program and what information would be most useful as you evaluate prospective athletes. Please let me know the appropriate next step${parent ? ' for our family' : ''}.`, '',
    'Thank you for your time and consideration.', name ? (parent ? `Parent/guardian of ${name}` : name) : (parent ? 'An athlete’s parent/guardian' : ''));
  const tag = purpose === 'event' ? 'Upcoming competition' : purpose === 'followup' ? 'Recruiting follow-up' : 'Athlete introduction';
  const subject = cleanText([tag, name, sport, year ? 'Class of ' + year : '', program].filter(Boolean).join(' | '), 250);
  return {subject, body:lines.join('\n').trim(), athlete:who};
}

