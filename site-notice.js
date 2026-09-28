(() => {
  if (document.getElementById('scoutcard-policy-links')) return;
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'site-notice.css'; document.head.append(style);
  const nav = document.createElement('nav');
  nav.id = 'scoutcard-policy-links'; nav.setAttribute('aria-label', 'Policies and privacy');
  for (const [label, href] of [['Privacy','privacy.html'],['Terms','terms.html'],['Refunds','refunds.html'],['Cookies','cookies.html'],['Request data deletion','privacy.html#retention']]) {
    const link = document.createElement('a'); link.href = href; link.textContent = label; nav.append(link);
  }
  const settings = document.createElement('button'); settings.type = 'button'; settings.textContent = 'Cookie settings';
  nav.append(settings); document.body.append(nav);
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
