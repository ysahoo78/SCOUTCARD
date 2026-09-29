(() => {
  if (document.getElementById('scoutcard-policy-links')) return;
  const main = document.querySelector('main');
  if (main) main.setAttribute('tabindex','-1');
  if (main && !document.querySelector('a.skip-link')) {
    if (!main.id) main.id = 'main';
    main.setAttribute('tabindex','-1');
    const skip = document.createElement('a'); skip.className = 'skip-link'; skip.href = '#' + main.id; skip.textContent = 'Skip to content';
    document.body.prepend(skip);
  }
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'site-notice.css'; document.head.append(style);
  const nav = document.createElement('nav');
  nav.id = 'scoutcard-policy-links'; nav.setAttribute('aria-label', 'Policies and social accounts');
  for (const [label, href] of [['Privacy','privacy.html'],['Terms','terms.html'],['Refunds','refunds.html'],['Cookies','cookies.html'],['Request data deletion','privacy.html#retention']]) {
    const link = document.createElement('a'); link.href = href; link.textContent = label; nav.append(link);
  }
  const socials = document.createElement('div'); socials.className = 'scoutcard-socials';
  const intro = document.createElement('div'); intro.className = 'scoutcard-social-intro';
  const kicker = document.createElement('span'); kicker.textContent = 'OFF THE FIELD. IN YOUR FEED.';
  const title = document.createElement('strong'); title.textContent = 'Follow the next chapter.';
  intro.append(kicker,title); socials.append(intro);
  for (const [platform, href, icon] of [
    ['Instagram','https://www.instagram.com/scoutcard26/','<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.25"/>'],
    ['TikTok','https://www.tiktok.com/@scoutcard26','<path d="M16.7 2H13v13.5a3.1 3.1 0 1 1-2.6-3.1V8.7a6.8 6.8 0 1 0 6.3 6.8V8.6a9.1 9.1 0 0 0 5.3 1.7V6.6A5.3 5.3 0 0 1 16.7 2Z"/>']
  ]) {
    const link = document.createElement('a'); link.href = href; link.className = 'scoutcard-social-card ' + platform.toLowerCase();
    const badge = document.createElement('span'); badge.className = 'scoutcard-social-icon';
    // Static decorative SVG; the link's accessible name supplies the platform and handle.
    badge.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true" focusable="false">' + icon + '</svg>';
    const copy = document.createElement('span'); copy.className = 'scoutcard-social-copy';
    const name = document.createElement('strong'); name.textContent = platform;
    const handle = document.createElement('span'); handle.textContent = '@scoutcard26'; copy.append(name,handle);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.className = 'scoutcard-social-arrow'; arrow.setAttribute('aria-hidden','true');
    link.append(badge,copy,arrow);
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', platform + ' @scoutcard26 (opens a new tab)'); socials.append(link);
  }
  nav.prepend(socials);
  const settings = document.createElement('button'); settings.type = 'button'; settings.textContent = 'Cookie settings';
  nav.append(settings); document.body.append(nav);
  for (const id of ['signin-form','order-form']) {
    const form = document.getElementById(id); if (!form) continue;
    const group = document.createElement('div'); group.className = 'scoutcard-form-disclosure';
    const label = document.createElement('label');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.required = true; checkbox.name = 'terms_acknowledgment';
    const words = document.createElement('span'); words.append('I agree to the ');
    const terms = document.createElement('a'); terms.href = 'terms.html'; terms.target = '_blank'; terms.rel = 'noopener'; terms.textContent = 'Terms of service (opens a new tab)';
    words.append(terms,'.'); label.append(checkbox,words); group.append(label);
    const note = document.createElement('p'); note.append('Read how we use your information in our ');
    const privacy = document.createElement('a'); privacy.href = 'privacy.html'; privacy.target = '_blank'; privacy.rel = 'noopener'; privacy.textContent = 'Privacy policy (opens a new tab)';
    note.append(privacy,'.'); group.append(note);
    if (id === 'order-form') {
      const refund = document.createElement('a'); refund.href = 'refunds.html'; refund.target = '_blank'; refund.rel = 'noopener'; refund.textContent = 'Read cancellation and refund rules (opens a new tab)';
      group.append(refund);
    }
    form.insertBefore(group,form.querySelector('button[type="submit"]') || form.querySelector('button'));
  }
  // The public profile form is rendered asynchronously; observe only until it appears.
  function explainMessage() {
    const form = document.getElementById('message-form'); if (!form) return false;
    if (!form.querySelector('.scoutcard-form-disclosure')) {
      const note = document.createElement('p'); note.className = 'scoutcard-form-disclosure';
      note.textContent = 'Sending shares your name, reply email, and message with this athlete. Do not include sensitive information. ';
      const link = document.createElement('a'); link.href = 'privacy.html'; link.textContent = 'Privacy policy'; note.append(link);
      form.insertBefore(note,form.querySelector('button'));
    }
    return true;
  }
  if (document.getElementById('profile-page') && !explainMessage()) {
    const observer = new MutationObserver(() => { if (explainMessage()) observer.disconnect(); });
    observer.observe(document.getElementById('profile-page'),{childList:true,subtree:true});
  }
  const notice = document.createElement('section'); notice.id = 'scoutcard-storage-notice';
  notice.setAttribute('aria-labelledby','scoutcard-storage-title');
  const heading = document.createElement('h2'); heading.id = 'scoutcard-storage-title'; heading.textContent = 'Your browser storage';
  const text = document.createElement('p'); text.textContent = 'We use essential browser storage for sign-in and checkout recovery. There are no optional advertising or analytics storage categories to enable.';
  const action = document.createElement('button'); action.type = 'button'; action.textContent = 'Use essential storage only';
  const details = document.createElement('a'); details.href = 'cookies.html'; details.textContent = 'Read cookie policy';
  notice.append(heading,text,action,details); document.body.append(notice);
  const key = 'scoutcard-storage-choice-v1';
  try { notice.hidden = localStorage.getItem(key) === 'essential'; } catch { notice.hidden = false; }
  settings.setAttribute('aria-controls',notice.id); settings.setAttribute('aria-expanded',String(!notice.hidden));
  let openedFromSettings = false;
  settings.addEventListener('click', () => { openedFromSettings = true; notice.hidden = false; settings.setAttribute('aria-expanded','true'); action.focus(); });
  action.addEventListener('click', () => {
    try { localStorage.setItem(key,'essential'); } catch { /* The choice still applies for this page view. */ }
    notice.hidden = true; settings.setAttribute('aria-expanded','false');
    if (openedFromSettings || document.activeElement === action) settings.focus();
  });
})();
