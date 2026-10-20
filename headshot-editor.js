import { HEADSHOT_BUCKET, HeadshotDraft, renderAvatar } from './headshots.js';
import { withTimeout } from './scoutcard-utils.js';

export const headshot = new HeadshotDraft();
const input = document.getElementById('headshot');
const remove = document.getElementById('remove-headshot');
const note = document.getElementById('headshot-status');
const form = document.getElementById('athlete-form');
const name = () => document.getElementById('name')?.value || '';

export function refreshHeadshotPreview() {
  renderAvatar(document.getElementById('initial'), name(), headshot.url);
  renderAvatar(document.getElementById('headshot-preview'), name(), headshot.url);
  remove.hidden = !headshot.changed && !headshot.savedPath;
}

input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  note.textContent = 'Preparing your photo…'; note.dataset.state = 'busy';
  const preparing = headshot.choose(file);
  const version = headshot.version;
  refreshHeadshotPreview();
  try {
    if (!await preparing) return;
    note.textContent = 'Photo ready. Select “Save my profile” to upload and save it.';
    note.dataset.state = 'success';
    refreshHeadshotPreview();
  } catch (error) {
    if (version !== headshot.version) return;
    note.textContent = error.message || 'That photo could not be read. Choose another or select “Use initials”.';
    note.dataset.state = 'error';
  }
});
remove.addEventListener('click', () => {
  headshot.remove(); input.value = '';
  note.textContent = 'Initials selected. Save your profile to remove the saved photo.';
  note.dataset.state = 'neutral';
  remove.dispatchEvent(new Event('input', { bubbles: true }));
  refreshHeadshotPreview();
});
form.addEventListener('input', event => { if (event.target.id === 'name') refreshHeadshotPreview(); });
document.addEventListener('profile-loaded', refreshHeadshotPreview);

export function resetHeadshot() {
  headshot.reset(); input.value = ''; note.textContent = '';
  refreshHeadshotPreview();
}

export async function loadHeadshot(db, path) {
  try { await headshot.load(db, path); }
  catch { if (!headshot.changed) note.textContent = 'Your saved photo could not load. Initials are shown for now; you can still save your profile.'; }
  refreshHeadshotPreview();
}

export async function acceptHeadshotSave(db, snapshot) {
  headshot.accept(snapshot);
  refreshHeadshotPreview();
  if (!snapshot.changed) return;
  if (snapshot.version === headshot.version) {
    input.value = '';
    note.textContent = snapshot.path ? 'Headshot saved.' : 'Profile saved with initials.';
    note.dataset.state = 'success';
  }
  if (snapshot.previousPath && snapshot.previousPath !== snapshot.path) {
    try {
      const { error } = await withTimeout(db.storage.from(HEADSHOT_BUCKET).remove([snapshot.previousPath]));
      if (error) throw error;
    } catch {
      if (snapshot.version === headshot.version) {
        note.textContent = 'Profile saved. The old photo is no longer linked, but storage cleanup needs a retry. Contact SCOUTCARD if you need it deleted.';
        note.dataset.state = 'error';
      }
    }
  }
}
