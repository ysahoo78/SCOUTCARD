// Self-reported eligibility, not identity or parental verification.
const key = 'scoutcard-age-group-v2';
const legacyKey = 'scoutcard-age-session-v1';
const lifetime = 30 * 24 * 60 * 60 * 1000;

function readChoice() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.version === 2 && Number.isFinite(saved.expiresAt) &&
        saved.expiresAt > Date.now() && saved.expiresAt <= Date.now() + lifetime &&
        ['adult', 'teen', 'blocked'].includes(saved.band)) return saved;
    localStorage.removeItem(key);
  } catch { /* Browser storage may be unavailable. */ }
  // Carry over a choice already made in this tab without asking again.
  try {
    const previous = JSON.parse(sessionStorage.getItem(legacyKey));
    if (previous?.version === 1 && ['adult', 'teen', 'blocked'].includes(previous.band)) {
      const saved = { version: 2, band: previous.band, permission: previous.permission === true,
        expiresAt: Date.now() + lifetime };
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch {}
      sessionStorage.removeItem(legacyKey);
      return saved;
    }
  } catch {}
  return null;
}

function saveChoice(band, permission = false) {
  try { localStorage.setItem(key, JSON.stringify({ version: 2, band, permission,
    expiresAt: Date.now() + lifetime })); } catch { /* Ask again next visit if storage is disabled. */ }
}

export function requireAccountEligibility() {
  const stored = readChoice();
  document.querySelectorAll('[data-change-age]').forEach(button => {
    button.addEventListener('click', () => {
      try { localStorage.removeItem(key); sessionStorage.removeItem(legacyKey); } catch {}
      location.reload();
    });
  });
  if (stored?.band === 'adult' || (stored?.band === 'teen' && stored.permission === true)) return Promise.resolve();
  const targets = [...document.querySelectorAll('#account,#profile,#athlete-workspace,.auth-panel,#activate-form,#order-form')];
  const previous = targets.map(element => element.hidden);
  targets.forEach(element => { element.hidden = true; });
  const gate = document.createElement('section'); gate.className = 'scoutcard-age-gate wrap';
  gate.innerHTML = '<h2>Before you get started</h2><p>Choose your age group once on this device. We remember only the group for 30 days, not your birth date. On a shared device, use “Change age group” for the next person.</p><form><label for="scoutcard-age">Your age group</label><select id="scoutcard-age" required><option value="">Select an age group</option><option value="adult">18 or older</option><option value="teen">13–17</option><option value="blocked">Under 13</option></select><button type="submit">Continue</button></form><p class="age-status" role="status" aria-live="polite" tabindex="-1"></p><button class="secondary age-change" type="button" hidden>Change age group</button>';
  const anchor = document.querySelector('#order') || document.querySelector('.auth-panel');
  anchor.before(gate);
  const form = gate.querySelector('form'), status = gate.querySelector('.age-status');
  const change = gate.querySelector('.age-change');
  change.addEventListener('click', () => {
    form.hidden = false; change.hidden = true; status.textContent = '';
    gate.querySelector('.age-permission-form')?.remove();
    form.querySelector('select').focus();
  });
  if (stored?.band === 'blocked') {
    form.hidden = true; change.hidden = false;
    status.textContent = 'SCOUTCARD accounts are not available for children under 13. Please do not enter personal information.';
  }
  (stored?.band === 'blocked' ? change : form.querySelector('select')).focus();
  return new Promise(resolve => {
    const finish = (band, permission = false) => {
      saveChoice(band, permission);
      targets.forEach((element,index) => { element.hidden = previous[index]; });
      gate.remove(); resolve();
      const next = ['#order-email', '#signin-email', '#activation-code']
        .map(selector => document.querySelector(selector))
        .find(element => element && !element.disabled && element.getClientRects().length);
      next?.focus();
    };
    form.addEventListener('submit', event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const band = form.querySelector('select').value;
      form.hidden = true;
      if (band === 'blocked') {
        saveChoice('blocked');
        status.textContent = 'SCOUTCARD accounts are not available for children under 13. Please do not enter personal information.';
        change.hidden = false; status.focus();
      } else if (band === 'teen') {
        status.textContent = 'You can use your own email. Please involve a parent or guardian before creating or publishing a profile. A parent or guardian must handle purchases.';
        const permission = document.createElement('form');
        permission.className = 'age-permission-form';
        permission.innerHTML = '<label class="age-permission"><input type="checkbox" required> <span>I have permission from my parent or guardian to create a SCOUTCARD profile. I will involve them before publishing it.</span></label><button type="submit">Continue to sign-in</button>';
        gate.append(permission);
        change.hidden = false;
        permission.querySelector('input').focus();
        permission.addEventListener('submit', event => { event.preventDefault(); if (permission.reportValidity()) finish('teen', true); });
      } else if (band === 'adult') finish('adult');
    });
  });
}
