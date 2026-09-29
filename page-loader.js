// Show a useful error if a network dependency cannot load, rather than leaving inert controls.
async function start(file, statusIds) {
  try { await import(file); }
  catch {
    for (const id of statusIds) {
      const note = document.getElementById(id);
      if (note) note.textContent = 'This page could not connect. Check your internet connection and refresh to try again.';
    }
  }
}
if (document.getElementById('athlete-form')) start('./athlete.js', ['profile-status']);
if (document.getElementById('athlete-form') || document.getElementById('activate-form')) {
  try {
    const { requireAccountEligibility } = await import('./age-gate.js');
    await requireAccountEligibility();
  } catch {
    document.querySelectorAll('#signin-form,#athlete-form,#activate-form,#order-form').forEach(form => { form.hidden = true; });
    const note = document.querySelector('#auth-note');
    if (note) note.textContent = 'Account setup could not load. Please refresh to try again.';
    throw new Error('Account eligibility check unavailable');
  }
}
if (document.getElementById('athlete-form')) {
  start('./athlete-backend.js', ['auth-note', 'profile-status']);
  start('./order-demo.js', ['order-note']);
} else if (document.getElementById('activate-form')) start('./activate.js', ['auth-note', 'note']);
else if (document.getElementById('profile-page')) start('./profile-public.js', ['profile-page']);
else if (document.getElementById('card-status')) start('./card.js', ['card-status']);
