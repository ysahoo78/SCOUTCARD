// Transport-independent autosave queue. Only acknowledged writes are called saved.
export class DraftSession {
  constructor({read, persist, changed = () => {}, delay = 900}) {
    Object.assign(this, {read, persist, changed, delay}); this.reset();
  }
  reset(record = null) {
    clearTimeout(this.timer); this.generation = (this.generation || 0) + 1;
    this.record = record; this.revision = 0; this.savedRevision = 0;
    this.pending = null; this.running = null; this.error = null;
  }
  get dirty() { return this.revision !== this.savedRevision || !!this.pending; }
  edit() {
    if (!this.record) return;
    this.revision++; this.error = null; clearTimeout(this.timer);
    this.changed('unsaved');
    this.timer = setTimeout(() => this.flush().catch(() => {}), this.delay);
  }
  async flush() {
    clearTimeout(this.timer);
    if (!this.record) throw Error('Sign in and load your draft before saving.');
    if (this.running) { await this.running; return this.dirty ? this.flush() : this.record; }
    if (!this.dirty) return this.record;
    const generation = this.generation;
    this.running = (async () => {
      while (this.dirty && this.generation === generation) {
        // Retain the identical operation ID after an ambiguous timeout. A newer
        // edit is sent only after that operation is safely acknowledged.
        if (!this.pending) {
          const revision = this.revision;
          const snapshot = structuredClone(await this.read());
          if (this.generation !== generation) return null;
          this.pending = {...snapshot, revision, expected_version:this.record.version,
            request_id:crypto.randomUUID()};
        }
        const operation = this.pending;
        this.changed('saving');
        const saved = await this.persist(operation, this.record);
        if (this.generation !== generation) return null;
        if (!saved || saved.profile_id !== this.record.profile_id ||
            !Number.isSafeInteger(saved.version) || saved.version <= operation.expected_version ||
            saved.last_request_id !== operation.request_id) throw Error('The server did not confirm this draft save. Please retry.');
        this.record = saved; this.savedRevision = operation.revision; this.pending = null;
        this.changed(this.dirty ? 'unsaved' : 'saved', saved);
      }
      return this.record;
    })();
    try { return await this.running; }
    catch (error) {
      if (this.generation === generation) { this.error = error; this.changed('error', error); }
      throw error;
    } finally { if (this.generation === generation) this.running = null; }
  }
}
