// Self-reported eligibility, not identity or parental verification.
export function requireAccountEligibility() {
  const key = 'scoutcard-age-session-v1';
  let stored;
  try { stored = JSON.parse(sessionStorage.getItem(key)); } catch {}
  if (stored?.version === 1 && (stored.band === 'adult' || (stored.band === 'teen' && stored.permission === true))) return Promise.resolve();
  const targets = [...document.querySelectorAll('#account,#profile,#athlete-workspace,.auth-panel,#activate-form,#order-form')];
  const previous = targets.map(element => element.hidden);
  targets.forEach(element => { element.hidden = true; });
  const gate = document.createElement('section'); gate.className = 'scoutcard-age-gate wrap';
  gate.innerHTML = '<h2>Before you get started</h2><p>Tell us your age before entering account or athlete information. We use an age group for this browser session, not your date of birth.</p><form><label for="scoutcard-age">How old are you?</label><input id="scoutcard-age" type="number" min="1" max="120" step="1" required inputmode="numeric" autocomplete="off"><button type="submit">Continue</button></form><p class="age-status" role="status" aria-live="polite"></p>';
  const anchor = document.querySelector('#order') || document.querySelector('.auth-panel');
  anchor.before(gate);
  const form = gate.querySelector('form'), status = gate.querySelector('.age-status');
  if (stored?.band === 'blocked') { form.hidden = true; status.textContent = 'SCOUTCARD accounts are not available for children under 13. Please do not enter personal information.'; }
  return new Promise(resolve => {
    const finish = (band, permission = false) => {
      try { sessionStorage.setItem(key,JSON.stringify({version:1,band,permission})); } catch {}
      targets.forEach((element,index) => { element.hidden = previous[index]; });
      gate.remove(); resolve();
      const heading = document.querySelector('#signin-email'); heading?.focus();
    };
    form.addEventListener('submit', event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const age = Number(form.querySelector('input').value);
      form.reset(); form.hidden = true;
      if (age < 13) {
        try { sessionStorage.setItem(key,JSON.stringify({version:1,band:'blocked'})); } catch {}
        status.textContent = 'SCOUTCARD accounts are not available for children under 13. Please do not enter personal information.';
      } else if (age < 18) {
        status.textContent = 'You can use your own email. Please involve a parent or guardian before creating or publishing a profile. A parent or guardian must handle purchases.';
        const permission = document.createElement('form');
        permission.innerHTML = '<label class="age-permission"><input type="checkbox" required> <span>I have permission from my parent or guardian to create a SCOUTCARD profile. I will involve them before publishing it.</span></label><button type="submit">Continue to sign-in</button>';
        gate.append(permission);
        permission.addEventListener('submit', event => { event.preventDefault(); if(permission.reportValidity()) finish('teen',true); });
      } else finish('adult');
    });
  });
}
