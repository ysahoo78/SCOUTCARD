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
if (document.getElementById('athlete-form')) {
  start('./athlete.js', ['profile-status']);
  start('./athlete-backend.js', ['auth-note', 'profile-status']);
  start('./order-demo.js', ['order-note']);
} else if (document.getElementById('activate-form')) start('./activate.js', ['auth-note', 'note']);
else if (document.getElementById('profile-page')) start('./profile-public.js', ['profile-page']);
else if (document.getElementById('card-status')) start('./card.js', ['card-status']);
