(() => {
  if (document.getElementById('scoutcard-policy-links')) return;
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'site-notice.css'; document.head.append(style);
  const nav = document.createElement('nav');
  nav.id = 'scoutcard-policy-links'; nav.setAttribute('aria-label', 'Policies and social accounts');
  for (const [label, href] of [['Privacy','privacy.html'],['Terms','terms.html'],['Refunds','refunds.html'],['Cookies','cookies.html'],['Request data deletion','privacy.html#retention']]) {
    const link = document.createElement('a'); link.href = href; link.textContent = label; nav.append(link);
  }
  for (const [label, href] of [['Instagram @scoutcard26','https://www.instagram.com/scoutcard26/'],['TikTok @scoutcard26','https://www.tiktok.com/@scoutcard26']]) {
    const link = document.createElement('a'); link.href = href; link.textContent = label;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', label + ' (opens a new tab)'); nav.append(link);
  }
  const settings = document.createElement('button'); settings.type = 'button'; settings.textContent = 'Cookie settings';
  nav.append(settings); document.body.append(nav);
  for (const id of ['signin-form','order-form','athlete-form']) {
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
