(() => {
  // Use the approved card-colored mark consistently on every page.
  const brandStyle = document.createElement('style');
  brandStyle.textContent = '.brand{display:inline-flex!important;align-items:center;gap:10px;white-space:nowrap}.brand .scoutcard-logo{display:block;width:34px;height:36px;object-fit:contain;flex:none}.brand .scoutcard-wordmark{color:inherit;font:inherit;letter-spacing:inherit}@media(max-width:600px){.brand .scoutcard-logo{width:28px;height:30px}.brand{gap:8px}}';
  document.head.append(brandStyle);
  document.querySelectorAll('a.brand').forEach(brand => {
    const logo = document.createElement('img');
    logo.src = 'assets/scoutcard-logo.svg'; logo.alt = ''; logo.width = 34; logo.height = 36; logo.className = 'scoutcard-logo';
    const wordmark = document.createElement('span'); wordmark.className = 'scoutcard-wordmark'; wordmark.textContent = 'SCOUTCARD';
    brand.replaceChildren(logo, wordmark);
    brand.setAttribute('aria-label', 'SCOUTCARD home');
  });
  const favicon = document.createElement('link'); favicon.rel = 'icon'; favicon.type = 'image/svg+xml'; favicon.href = 'assets/scoutcard-logo.svg'; document.head.append(favicon);
  if (document.getElementById('scoutcard-policy-links')) return;
  const main = document.querySelector('main');
  if (main) main.setAttribute('tabindex','-1');
  if (main && !document.querySelector('a.skip-link')) {
    if (!main.id) main.id = 'main';
    main.setAttribute('tabindex','-1');
    const skip = document.createElement('a'); skip.className = 'skip-link'; skip.href = '#' + main.id; skip.textContent = 'Skip to content';
    document.body.prepend(skip);
  }
  document.querySelector('a.skip-link')?.addEventListener('click', event => {
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView({block:'start'});
  });
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'site-notice.css'; document.head.append(style);
  // Keep secondary navigation in one shared footer, not beside the four actions.
  document.querySelectorAll('header .header-utility,header a[href="about.html"]').forEach(link => link.remove());
  const footer = document.createElement('footer'); footer.id = 'scoutcard-footer';
  footer.setAttribute('aria-label','SCOUTCARD footer');
  const inner = document.createElement('div'); inner.id = 'scoutcard-policy-links';
  const grid = document.createElement('div'); grid.className = 'footer-grid';
  const brandColumn = document.createElement('div'); brandColumn.className = 'footer-brand';
  const brand = document.createElement('a'); brand.className = 'brand'; brand.href = 'index.html#buy'; brand.setAttribute('aria-label','SCOUTCARD home');
  const onHome = location.pathname === '/' || location.pathname.endsWith('/index.html');
  if (onHome) brand.href = '#buy';
  const logo = document.createElement('img'); logo.src = 'assets/scoutcard-logo.svg'; logo.alt = ''; logo.width = 38; logo.height = 40;
  const wordmark = document.createElement('span'); wordmark.textContent = 'SCOUTCARD'; brand.append(logo,wordmark);
  const tagline = document.createElement('p'); tagline.className = 'footer-tagline'; tagline.textContent = 'Your game. One connection.';
  const description = document.createElement('p'); description.className = 'footer-description'; description.textContent = 'One athlete profile. Shared with a tap.';
  const socials = document.createElement('div'); socials.className = 'footer-socials';
  for (const [platform, href, icon] of [
    ['Instagram','https://www.instagram.com/scoutcard26/','<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.25"/>'],
    ['TikTok','https://www.tiktok.com/@scoutcard26','<path d="M16.7 2H13v13.5a3.1 3.1 0 1 1-2.6-3.1V8.7a6.8 6.8 0 1 0 6.3 6.8V8.6a9.1 9.1 0 0 0 5.3 1.7V6.6A5.3 5.3 0 0 1 16.7 2Z"/>']
  ]) {
    const link = document.createElement('a'); link.className = 'footer-social-link'; link.href = href;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label',platform + ' @scoutcard26 (opens a new tab)');
    const badge = document.createElement('span');
    badge.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true" focusable="false">' + icon + '</svg>';
    link.append(badge,platform); socials.append(link);
  }
  brandColumn.append(brand,tagline,description,socials); grid.append(brandColumn);
  const sections = [
    ['Company','footer-company',[['About Us','about.html'],['For Parents','index.html#parents'],['Parent Dashboard','family.html'],['Contact Us','mailto:scout.card26@gmail.com']]],
    ['Get Started','footer-start',[['Set Up Profile','index.html#setup'],['Buy The Card','index.html#order'],['Activate The Card','activate.html'],['Send An Email','index.html#email']]],
    ['Legal & Safety','footer-legal',[['Privacy Policy','privacy.html'],['Terms of Service','terms.html'],['Refund Policy','refunds.html'],['Cookie Policy','cookies.html'],['Parent Privacy Notice','parent-privacy.html'],['Request Data Deletion','data-request.html'],['Safety / Report a Concern','safety.html']]]
  ];
  for (const [title,id,links] of sections) {
    const column = document.createElement('div'); column.className = 'footer-column ' + id;
    const heading = document.createElement('h2'); heading.id = id + '-title'; heading.textContent = title;
    const nav = document.createElement('nav'); nav.setAttribute('aria-labelledby',heading.id);
    for (const [index,[label,href]] of links.entries()) {
      const link = document.createElement('a'); link.href = onHome && href.startsWith('index.html#') ? href.slice('index.html'.length) : href;
      // Reuse the contextual header destinations, especially for selected children.
      if (id === 'footer-start') {
        const primary = document.querySelectorAll('header .primary-actions a')[index];
        if (primary) link.href = primary.getAttribute('href');
      }
      link.textContent = label; nav.append(link);
    }
    column.append(heading,nav); grid.append(column);
  }
  const lower = document.createElement('div'); lower.className = 'footer-lower';
  const business = document.createElement('div'); business.className = 'footer-business';
  const copyright = document.createElement('p'); copyright.textContent = '© ' + new Date().getFullYear() + ' SCOUTCARD.';
  const operators = document.createElement('p'); operators.textContent = 'Operated by Yash Sahoo and Toryn Ibarra · Virginia, United States.';
  const contact = document.createElement('a'); contact.href = 'mailto:scout.card26@gmail.com'; contact.textContent = 'scout.card26@gmail.com';
  business.append(copyright,operators,contact);
  const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'footer-cookie-settings'; settings.textContent = 'Cookie Settings';
  lower.append(business,settings);
  const finePrint = document.createElement('p'); finePrint.className = 'footer-fine-print';
  finePrint.textContent = 'SCOUTCARD does not guarantee recruiting opportunities, offers or scholarships.';
  if (document.getElementById('profile-page')) finePrint.append(' Profile information is supplied by the athlete or their parent/guardian.');
  inner.append(grid,lower,finePrint); footer.append(inner);
  const existingFooter = document.querySelector('body > footer');
  if (existingFooter) existingFooter.replaceWith(footer); else document.body.append(footer);
  const footerStyle = document.createElement('link'); footerStyle.rel = 'stylesheet'; footerStyle.href = 'footer.css'; document.head.append(footerStyle);
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
      const adult = document.createElement('label');
      const adultCheck = document.createElement('input'); adultCheck.type = 'checkbox'; adultCheck.required = true; adultCheck.name = 'adult_purchaser';
      const adultText = document.createElement('span'); adultText.textContent = 'I am 18 or older and am purchasing for myself or an athlete with their parent or guardian’s permission.';
      adult.append(adultCheck,adultText); group.append(adult);
      const refund = document.createElement('a'); refund.href = 'refunds.html'; refund.target = '_blank'; refund.rel = 'noopener'; refund.textContent = 'Read cancellation and refund rules (opens a new tab)';
      group.append(refund);
    }
    form.insertBefore(group,form.querySelector('button[type="submit"]') || form.querySelector('button'));
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
