import {cleanText, emailDetails, generateRecruitingEmail, mailtoUrl, EmailDraftBook} from './recruiting-email.js';
import {friendlyError} from './scoutcard-utils.js';

export function createRecruitingEmailBuilder({host, before = null, parent = false, getSnapshot}) {
  if (!document.querySelector('link[href="recruiting-email.css"]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'recruiting-email.css'; document.head.append(css);
  }
  const root = document.createElement('section'); root.id = 'recruiting-email'; root.className = 'panel recruiting-email'; root.hidden = true;
  root.setAttribute('aria-labelledby', 'recruiting-email-title');
  root.innerHTML = `<p class="email-eyebrow">MAKE THE INTRODUCTION</p>
    <h2 id="recruiting-email-title">Your next conversation starts here.</h2>
    <p>Turn selected saved profile details into a personal email. Review it, then send it yourself. No AI service, automatic sending or email tracking.</p>
    <p id="email-selected-athlete"></p>
    <button id="email-open" type="button" aria-expanded="false" aria-controls="email-workspace">Write a recruiting email</button>
    <p id="email-load-status" role="status" aria-live="polite"></p>
    <div id="email-workspace" hidden>
      <p id="email-storage-note" class="email-notice"><strong>Email edits stay in this tab only—not saved online.</strong> Switching setup steps or children keeps them here. Refreshing, closing this page, or signing out removes them. Copy your email before leaving.</p>
      <p id="email-source-note" class="email-notice"></p>
      <form id="email-builder-form">
        <fieldset><legend>1. Make it personal</legend>
          <p id="email-voice"></p>
          <label for="email-coach">Coach / recruiter name <small>Optional</small></label><input id="email-coach" maxlength="80" autocomplete="off" placeholder="Coach Rivera">
          <label for="email-program">College or organization <span>(required)</span></label><input id="email-program" required maxlength="120" autocomplete="off" placeholder="The program you are contacting">
          <label for="email-recipient">Recipient email <small>Optional for drafting; required to open your email app</small></label><input id="email-recipient" type="email" maxlength="254" autocomplete="off" aria-describedby="email-recipient-help"><p id="email-recipient-help">One recipient at a time. Check their address yourself; SCOUTCARD does not verify coaches.</p>
          <label for="email-purpose">Purpose</label><select id="email-purpose"><option value="introduction">Introduce the athlete</option><option value="event">Invite them to an upcoming event</option><option value="followup">Follow up with your own context</option></select>
          <label for="email-why">Why this particular program? <span>(required)</span></label><textarea id="email-why" required maxlength="650" rows="3" placeholder="Write your genuine reason. Include only facts you have checked."></textarea>
          <div id="email-context-wrap" hidden><label for="email-context" id="email-context-label">Additional context</label><textarea id="email-context" maxlength="500" rows="3"></textarea></div>
        </fieldset>
        <fieldset><legend>2. Choose what to share</legend><p>Nothing below is sent automatically. Basics are selected initially; choose any other details yourself. Select up to three strengths. Check that dates, stats and links are current.</p><div id="email-detail-options"></div>
          <label class="email-check" id="email-child-confirm-wrap" hidden><input id="email-child-confirm" type="checkbox"><span id="email-child-confirm-label"></span></label>
        </fieldset>
        <button id="email-generate" type="submit">Generate email</button>
      </form>
      <section id="email-output" hidden aria-labelledby="email-review-title"><h3 id="email-review-title" tabindex="-1">3. Review before sharing</h3>
        <p>You control this text. Verify the recipient, every fact and every link. Removing a selected detail does not change an existing email until you generate it again. A published profile link opens the published version, not private draft edits.</p>
        <label for="email-subject">Subject</label><input id="email-subject" maxlength="250" autocomplete="off">
        <label for="email-body">Email body</label><textarea id="email-body" rows="15" maxlength="12000" spellcheck="true"></textarea>
        <p id="email-word-count"></p>
        <label class="email-check"><input id="email-reviewed" type="checkbox"><span>I have reviewed the recipient, athlete, facts and links, and I intend to share this information. For teen athletes, involve a parent or guardian.</span></label>
        <div class="email-actions"><button id="email-copy-subject" type="button" class="secondary">Copy subject</button><button id="email-copy-body" type="button" class="secondary">Copy email</button><button id="email-open-app" type="button">Open in email app</button></div>
        <p>Opening your email app does not send the message. You must review it there and press Send yourself. If the message is too long or no app opens, copy the subject and email separately.</p>
      </section>
      <p id="email-status" role="status" aria-live="polite" tabindex="-1"></p>
      <div class="email-actions"><button id="email-close" type="button" class="secondary">Back to profile — keep email in this tab</button><button id="email-clear" type="button" class="secondary">Clear this athlete’s email draft</button></div>
    </div>`;
  if (before) host.insertBefore(root, before); else host.prepend(root);
  const $ = id => root.querySelector('#' + id), book = new EmailDraftBook();
  let context = null, snapshot = null, version = 0, loading = false;
  const fields = ['coach','program','recipient','purpose','why','context','subject','body'];
  function status(text, error = false) { $('email-status').textContent = text; $('email-status').dataset.state = error ? 'error' : 'neutral'; }
  function model() {
    return {...Object.fromEntries(fields.map(key => [key, $('email-' + key).value])),
      include:[...$('email-detail-options').querySelectorAll('input:checked')].map(input => input.value)};
  }
  function remember(force = false) {
    if (!context || !snapshot) return;
    const value = model(), hasText = fields.some(key => key !== 'purpose' && value[key].trim());
    if (force || hasText || value.purpose !== 'introduction' || value.include.some(key => key !== 'basics') || book.read(context.profileId)) book.write(context.profileId, value);
  }
  function reviewReset() { $('email-reviewed').checked = false; }
  function controls() {
    const purpose = $('email-purpose').value;
    $('email-context-wrap').hidden = purpose === 'introduction';
    $('email-context').required = purpose === 'followup';
    $('email-context-label').textContent = purpose === 'event' ? 'Event details (or select a saved event below)' : 'What are you following up on? (required)';
    $('email-word-count').textContent = `${$('email-body').value.trim().split(/\s+/).filter(Boolean).length} words · Aim for a concise introduction, usually 120–180 words. Shorter is fine when fewer details are available.`;
    const chosen = [...$('email-detail-options').querySelectorAll('input[data-strength]:checked')].length;
    for (const input of $('email-detail-options').querySelectorAll('input[data-strength]')) input.disabled = chosen >= 3 && !input.checked;
  }
  function paintOptions(included = ['basics']) {
    const choices = new Set(included); $('email-detail-options').replaceChildren();
    for (const row of emailDetails(snapshot)) {
      const label = document.createElement('label'); label.className = 'email-check email-detail';
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = row.key; input.checked = choices.has(row.key);
      if (row.kind === 'strength') input.dataset.strength = 'true';
      const text = document.createElement('span'), title = document.createElement('strong'), preview = document.createElement('small');
      title.textContent = row.label; preview.textContent = row.text; text.append(title, preview); label.append(input, text); $('email-detail-options').append(label);
    }
    if (!$('email-detail-options').childElementCount) $('email-detail-options').textContent = 'Your saved draft is empty. Add any basic athlete detail in profile setup, then reopen this builder. No complete profile is required.';
    const hasLink = emailDetails(snapshot).some(row => row.key === 'profile');
    $('email-source-note').textContent = hasLink ? 'Using your last confirmed saved profile draft. Your published profile link is available as an optional inclusion below. Private edits may differ from the published page.'
      : 'Using your last confirmed saved profile draft. No published profile link is available, so none will be included. You can draft without one, or return to profile Review and publish a basic profile when ready.';
    controls();
  }
  function restore(value) {
    for (const key of fields) $('email-' + key).value = value?.[key] || (key === 'purpose' ? 'introduction' : '');
    paintOptions(value?.include || ['basics']);
    $('email-output').hidden = !value?.subject && !value?.body;
    $('email-generate').textContent = $('email-output').hidden ? 'Generate email' : 'Generate again — replaces subject and body';
    $('email-child-confirm').checked = false; reviewReset(); status(''); controls();
  }
  function resetVisible() {
    snapshot = null; $('email-workspace').hidden = true; $('email-output').hidden = true;
    $('email-open').setAttribute('aria-expanded', 'false'); $('email-detail-options').replaceChildren();
    for (const key of fields) $('email-' + key).value = key === 'purpose' ? 'introduction' : '';
    $('email-child-confirm').checked = false; reviewReset(); status(''); $('email-load-status').textContent = '';
  }
  function setContext(value) {
    const changed = context?.ownerId !== value?.ownerId || context?.profileId !== value?.profileId;
    if (changed) { remember(); version++; resetVisible(); }
    if (value?.ownerId) book.setOwner(value.ownerId);
    context = value; root.hidden = !value;
    $('email-selected-athlete').textContent = value ? `Selected athlete: ${cleanText(value.name, 60) || 'Untitled private draft'}${parent ? ' — confirm this child below before generating.' : ''}` : '';
  }
  async function open() {
    if (loading || !context) return;
    loading = true; $('email-open').disabled = true; root.setAttribute('aria-busy', 'true');
    const ticket = version; $('email-load-status').textContent = 'Checking your sign-in and saved athlete details…';
    try {
      const fresh = await getSnapshot();
      if (ticket !== version || !context) return;
      if (fresh.ownerId !== context.ownerId || fresh.profileId !== context.profileId || fresh.parent !== parent) throw Error('The selected athlete changed. Reopen the builder.');
      snapshot = fresh; restore(book.read(context.profileId));
      $('email-voice').textContent = parent ? 'Parent/guardian voice. This email identifies you as the adult writing about your child; it will not impersonate them.' : 'Athlete voice. This email introduces you. Parents managing a child should use the parent dashboard instead.';
      $('email-child-confirm-wrap').hidden = !parent; $('email-child-confirm').required = parent;
      $('email-child-confirm-label').textContent = 'I confirm I am writing about ' + (cleanText(snapshot.payload.display_name, 60) || 'this selected child') + ', not another child in my account.';
      $('email-workspace').hidden = false; $('email-open').setAttribute('aria-expanded', 'true'); $('email-load-status').textContent = '';
      $('email-coach').focus();
    } catch (error) { if (ticket === version) $('email-load-status').textContent = friendlyError(error) + ' Your email edits are kept in this tab. Retry “Write a recruiting email” after the profile save succeeds.'; }
    finally { loading = false; $('email-open').disabled = false; root.setAttribute('aria-busy', 'false'); }
  }
  $('email-open').onclick = () => { remember(); open(); };
  $('email-builder-form').addEventListener('input', () => { controls(); reviewReset(); remember(true); });
  $('email-builder-form').addEventListener('change', () => { controls(); reviewReset(); remember(true); });
  for (const key of ['subject','body']) $('email-' + key).addEventListener('input', () => { reviewReset(); controls(); remember(true); });
  $('email-builder-form').addEventListener('submit', async event => {
    event.preventDefault(); if (loading || !context || !snapshot || !event.currentTarget.reportValidity()) return;
    if (!$('email-output').hidden && !confirm('Replace this athlete’s current email subject and body with a newly generated version? Copy any text you want to keep first.')) return;
    remember(); const ticket = version; loading = true; $('email-generate').disabled = true; status('Checking the saved profile and current publishing status…');
    try {
      const fresh = await getSnapshot(); if (ticket !== version || !context) return;
      if (fresh.profileId !== context.profileId || fresh.ownerId !== context.ownerId || fresh.parent !== parent) throw Error('The selected athlete changed.');
      const options = {...model(), childConfirmed:$('email-child-confirm').checked};
      const generated = generateRecruitingEmail(fresh, options); snapshot = fresh;
      paintOptions(options.include); $('email-subject').value = generated.subject; $('email-body').value = generated.body;
      $('email-output').hidden = false; $('email-generate').textContent = 'Generate again — replaces subject and body'; reviewReset(); controls(); remember();
      status('Email generated in this tab—not saved online and not sent. Edit it and review every fact before sharing.'); $('email-review-title').focus();
    } catch (error) { if (ticket === version) { status(friendlyError(error) + ' Your existing email text has not been replaced.', true); $('email-status').focus(); } }
    finally { loading = false; $('email-generate').disabled = false; }
  });
  function approved() {
    if (!context || !snapshot || $('email-output').hidden) throw Error('Generate an email for the selected athlete first.');
    if (!$('email-reviewed').checked) throw Error('Review the email and check the review acknowledgment before sharing.');
  }
  async function copy(key) {
    try {
      approved(); const field = $('email-' + key); if (!field.value.trim()) throw Error('There is no text to copy yet.');
      const ticket = version; await navigator.clipboard.writeText(field.value);
      if (ticket === version) status((key === 'subject' ? 'Subject' : 'Email body') + ' copied. Nothing was sent. Email edits still exist only in this tab.');
    } catch (error) {
      status(friendlyError(error), true);
      if ($('email-reviewed').checked) { const field = $('email-' + key); field.focus(); field.select(); status('Automatic copying was unavailable. The text is selected; use your device’s Copy command.', true); }
      else $('email-reviewed').focus();
    }
  }
  $('email-copy-subject').onclick = () => copy('subject'); $('email-copy-body').onclick = () => copy('body');
  $('email-open-app').onclick = () => {
    try { approved(); const link = mailtoUrl(model()); status('Opening your email app—not sending. If nothing opens, copy the subject and email separately.'); window.location.assign(link); }
    catch (error) { status(friendlyError(error), true); $('email-status').focus(); }
  };
  $('email-close').onclick = () => { remember(); $('email-workspace').hidden = true; $('email-open').setAttribute('aria-expanded', 'false'); $('email-open').focus(); };
  $('email-clear').onclick = () => {
    if (!context || !confirm('Clear only this athlete’s email draft from this tab? This will not delete any athlete profile.')) return;
    book.delete(context.profileId); restore(null); status('This athlete’s email draft was cleared. Their profile and other athletes’ email drafts are unchanged.');
  };
  window.addEventListener('beforeunload', event => { if (book.hasEdits) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('scoutcard-before-signout', event => {
    if (book.hasEdits && !confirm('Email drafts are only in this tab and will be cleared when you sign out. Copy anything you want to keep first. Sign out now?')) event.detail.waitUntil(Promise.reject(Error('Sign-out cancelled. Copy your email before signing out.')));
  });
  return {setContext, forget(profileId) { book.delete(profileId); if (context?.profileId === profileId) { context = null; version++; root.hidden = true; resetVisible(); } }, clear() { version++; book.clear(); context = null; root.hidden = true; resetVisible(); }};
}
