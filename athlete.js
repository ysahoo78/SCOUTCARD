import { safeUrl } from './scoutcard-utils.js';
import { getSportName } from './sport-presets.js';
import { refreshHeadshotPreview } from './headshot-editor.js';
const $ = id => document.getElementById(id);
function updatePreview() {
  const name = $('name').value.trim();
  $('live-name').textContent = name || 'Your name';
  refreshHeadshotPreview();
  $('live-sport').textContent = getSportName() || 'Sport';
  for (const id of ['grad', 'position', 'accolade']) {
    $('live-' + id).textContent = $(id).value.trim() || ({ grad: 'Year', position: 'Position / event', accolade: 'Your accolade' })[id];
  }
  const teams = [
    $('team').value.trim() && `School / primary: ${$('team').value.trim()}`,
    $('club_team').value.trim() && `Club / other: ${$('club_team').value.trim()}`
  ].filter(Boolean);
  $('live-teams').textContent = teams.join(' · ');
  $('live-teams').hidden = teams.length === 0;
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
  const preserveSetup = fragment === '#main' && document.body.classList.contains('setup-mode');
  const mode = preserveSetup || ['#setup', '#profile', '#account', '#athlete-workspace'].includes(fragment) || authReturn ? 'setup' : 'buy';
  document.body.classList.toggle('setup-mode', mode === 'setup');
  document.body.classList.toggle('buy-mode', mode === 'buy');
  document.querySelectorAll('[data-mode]').forEach(link => {
    const active = link.dataset.mode === mode;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (['#buy', '#setup'].includes(fragment)) window.scrollTo({ top: 0 });
  else if (['#profile', '#account'].includes(fragment)) {
    const target = $(fragment.slice(1));
    const visibleTarget = target?.hidden ? document.querySelector('.scoutcard-age-gate') : target;
    visibleTarget?.scrollIntoView({ block: 'start' });
  }
}
window.addEventListener('hashchange', setMode);
setMode();
