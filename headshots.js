import { initials, safeUrl, withTimeout } from './scoutcard-utils.js';

export const HEADSHOT_BUCKET = 'athlete-headshots';
export const MAX_PHOTO_INPUT = 5 * 1024 * 1024;
export const MAX_PHOTO_STORED = 512 * 1024;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const pathPattern = new RegExp(`^${uuid}/${uuid}\\.jpg$`, 'i');
export const validHeadshotPath = path => typeof path === 'string' && pathPattern.test(path);

export function validatePhotoFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP photo. HEIC, SVG, and GIF files are not supported.');
  }
  if (!file.size || file.size > MAX_PHOTO_INPUT) throw new Error('Choose a photo smaller than 5 MB.');
}

export async function compressHeadshot(file) {
  validatePhotoFile(file);
  let picture;
  try { picture = await withTimeout(createImageBitmap(file, { imageOrientation: 'from-image' })); }
  catch { throw new Error('This photo could not be read. Try a different JPG, PNG, or WebP image.'); }
  try {
    if (!picture.width || !picture.height || picture.width * picture.height > 40000000) {
      throw new Error('This photo is too large to process. Choose a smaller image.');
    }
    const scale = Math.min(1, 640 / Math.max(picture.width, picture.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.width * scale));
    canvas.height = Math.max(1, Math.round(picture.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser. Try another browser.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    // Re-encoding strips EXIF/location metadata and does not upload the original.
    const blob = await withTimeout(new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82)));
    if (!blob || blob.type !== 'image/jpeg' || blob.size > MAX_PHOTO_STORED) {
      throw new Error('This photo could not be reduced enough. Try a simpler or smaller headshot.');
    }
    return blob;
  } finally { picture.close(); }
}

export function renderAvatar(container, name, url = '') {
  if (!container) return;
  container.replaceChildren(document.createTextNode(initials(name)));
  container.classList.remove('has-headshot');
  if (!url) return;
  const image = document.createElement('img');
  image.alt = name?.trim() ? `${name.trim()} headshot` : 'Your headshot';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('load', () => {
    if (image.parentNode === container) container.classList.add('has-headshot');
  }, { once: true });
  image.addEventListener('error', () => {
    if (image.parentNode === container) { image.remove(); container.classList.remove('has-headshot'); }
  }, { once: true });
  image.src = url;
  container.append(image);
}

export async function signedHeadshotUrl(db, path) {
  if (!validHeadshotPath(path)) return '';
  const { data, error } = await withTimeout(db.storage.from(HEADSHOT_BUCKET).createSignedUrl(path, 300));
  if (error) throw error;
  const url = safeUrl(data?.signedUrl || '');
  if (!url) throw new Error('The saved headshot could not be loaded.');
  return url;
}

// The draft is separate from the saved profile. Uploads happen only on Save.
export class HeadshotDraft {
  constructor() { this.version = 0; this.savedPath = null; this.savedUrl = ''; this.pending = undefined; this.preview = ''; this.uploaded = null; }
  get changed() { return this.pending !== undefined; }
  get url() { return this.changed ? this.preview : this.savedUrl; }
  async choose(file) {
    const version = ++this.version;
    this.clearPreview(); this.uploaded = null;
    this.pending = compressHeadshot(file);
    const blob = await this.pending;
    if (version === this.version) this.preview = URL.createObjectURL(blob);
    return version === this.version;
  }
  clearPreview() { if (this.preview) URL.revokeObjectURL(this.preview); this.preview = ''; }
  remove() { this.version++; this.clearPreview(); this.pending = null; this.uploaded = null; }
  reset() { this.version++; this.clearPreview(); if (this.savedUrl.startsWith('blob:')) URL.revokeObjectURL(this.savedUrl); this.savedPath = null; this.savedUrl = ''; this.pending = undefined; this.uploaded = null; }
  async load(db, path) {
    this.savedPath = validHeadshotPath(path) ? path : null;
    const version = this.version;
    if (this.savedUrl.startsWith('blob:')) URL.revokeObjectURL(this.savedUrl);
    this.savedUrl = '';
    if (!this.savedPath) return;
    const url = await signedHeadshotUrl(db, this.savedPath);
    if (this.version === version && !this.changed) this.savedUrl = url;
  }
  async prepare(db, owner) {
    const snapshot = { version: this.version, changed: this.changed, path: this.savedPath, previousPath: this.savedPath };
    if (!snapshot.changed) return snapshot;
    if (this.pending === null) return { ...snapshot, path: null };
    const pending = this.pending;
    const blob = await pending;
    if (!this.uploaded || this.uploaded.version !== snapshot.version || this.uploaded.owner !== owner) {
      const path = `${owner}/${crypto.randomUUID()}.jpg`;
      if (!validHeadshotPath(path)) throw new Error('Sign in again before uploading a photo.');
      this.uploaded = { version: snapshot.version, owner, path, complete: false };
    }
    const upload = this.uploaded;
    if (!upload.complete) {
      const { error } = await withTimeout(db.storage.from(HEADSHOT_BUCKET).upload(upload.path, blob,
        { contentType: 'image/jpeg', cacheControl: '60', upsert: false }));
      // A retry can find the same immutable file after a timed-out successful upload.
      if (error && String(error.statusCode || error.status) !== '409') throw error;
      upload.complete = true;
    }
    return { ...snapshot, path: upload.path };
  }
  accept(snapshot) {
    if (!snapshot.changed) return;
    this.savedPath = snapshot.path;
    if (snapshot.version === this.version) {
      if (this.savedUrl.startsWith('blob:')) URL.revokeObjectURL(this.savedUrl);
      this.savedUrl = this.preview; // Keep the local preview until a reload signs the saved path.
      this.preview = ''; this.pending = undefined; this.uploaded = null;
    }
  }
}
