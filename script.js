import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://canyprcqtbvvrrvaoltu.supabase.co',
  'sb_publishable_0Qu4eJEl1jRtY6xZeW9Z1Q_dz6GsKYn',
);

const form = document.querySelector('#waitlist-form');
const note = document.querySelector('#form-note');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#email');
  const button = form.querySelector('button');
  const email = input.value.trim().toLowerCase();

  button.disabled = true;
  button.textContent = 'Joining…';
  note.textContent = 'Saving your spot…';

  const { error } = await supabase
    .from('waitlist_signups')
    .insert({ email, source: 'landing_page', marketing_consent: true });

  // A duplicate signup is still a successful outcome from the visitor's perspective.
  if (!error || error.code === '23505') {
    note.textContent = `You're on the list — we'll be in touch at ${email}.`;
    form.reset();
  } else {
    note.textContent = 'We couldn’t save your email just yet. Please try again in a moment.';
  }

  button.disabled = false;
  button.innerHTML = 'Join the waitlist <span>→</span>';
});

const profileFields = {
  name: document.querySelector('#profile-name'),
  contact: document.querySelector('#profile-contact'),
  medical: document.querySelector('#profile-medical'),
  returnInfo: document.querySelector('#profile-return'),
  emergency: document.querySelector('#emergency-toggle'),
};

const valueOr = (value, fallback) => value.trim() || fallback;

function updatePreview() {
  const name = valueOr(profileFields.name.value, 'Your name');
  const firstName = name.split(/\s+/)[0];
  const initial = firstName.charAt(0).toUpperCase() || '?';
  document.querySelector('#preview-initial').textContent = initial;
  document.querySelector('#preview-emergency-initial').textContent = initial;
  document.querySelector('#preview-found-name').textContent = `${firstName}'s`;
  document.querySelector('#preview-message-name').textContent = firstName;
  document.querySelector('#preview-emergency-name').textContent = name;
  document.querySelector('#preview-contact').textContent = valueOr(profileFields.contact.value, 'Not shared');
  document.querySelector('#preview-medical').textContent = valueOr(profileFields.medical.value, 'No medical note shared');
  document.querySelector('#preview-return').textContent = `“${valueOr(profileFields.returnInfo.value, 'Please message me to arrange a return.')}”`;
  document.querySelector('.info-contact').classList.toggle('muted', !profileFields.contact.value.trim());
  document.querySelector('.info-medical').classList.toggle('muted', !profileFields.medical.value.trim());
  document.querySelector('.emergency-view').classList.toggle('is-private', !profileFields.emergency.checked);
}

Object.values(profileFields).forEach((field) => field.addEventListener('input', updatePreview));
profileFields.emergency.addEventListener('change', updatePreview);

document.querySelectorAll('[data-preview]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-preview]').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.preview-view').forEach((view) => view.classList.toggle('active', view.classList.contains(`${button.dataset.preview}-view`)));
  });
});

const siteTabs = document.querySelectorAll('[data-site-tab]');
function setSiteMode(mode) {
  const selectedMode = mode === 'setup' ? 'setup' : 'buy';
  document.body.classList.remove('buy-mode', 'setup-mode');
  document.body.classList.add(`${selectedMode}-mode`);
  siteTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.siteTab === selectedMode));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

siteTabs.forEach((tab) => tab.addEventListener('click', () => setSiteMode(tab.dataset.siteTab)));
setSiteMode(window.location.hash === '#setup' ? 'setup' : 'buy');
