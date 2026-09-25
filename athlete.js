import { initials, safeUrl } from './scoutcard-utils.js';
const $ = id => document.getElementById(id);
function updatePreview() {
  const name = $('name').value.trim();
  $('live-name').textContent = name || 'Your name';
  $('initial').textContent = initials(name);
  for (const id of ['sport', 'grad', 'position', 'accolade']) {
    $('live-' + id).textContent = $(id).value.trim() || ({ sport: 'Sport', grad: 'Year', position: 'Position / event', accolade: 'Your accolade' })[id];
  }
  const url = safeUrl($('highlight').value);
  $('live-highlight').hidden = !url;
  if (url) $('live-highlight').href = url;
}
$('athlete-form').addEventListener('input', updatePreview);
document.addEventListener('profile-loaded', updatePreview);
updatePreview();
function setMode() {
  const fragment = location.hash;
  const authReturn = /access_token=|error_description=|refresh_token=/.test(fragment) || location.search.includes('code=');
  const mode = ['#setup', '#profile', '#account', '#athlete-workspace'].includes(fragment) || authReturn ? 'setup' : 'buy';
  document.body.classList.toggle('setup-mode', mode === 'setup');
  document.body.classList.toggle('buy-mode', mode === 'buy');
  document.querySelectorAll('[data-mode]').forEach(link => {
    const active = link.dataset.mode === mode;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (['#buy', '#setup'].includes(fragment)) window.scrollTo({ top: 0 });
  else if (fragment === '#profile') $('profile').scrollIntoView();
}
window.addEventListener('hashchange', setMode);
setMode();
