/* One ordered stream per image. Other images may save independently. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SFTLSaveQueue = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function SaveQueue(write, onChange) {
    this.write = write;
    this.onChange = onChange || function () {};
    this.entries = new Map();
    this.waiters = [];
  }
  SaveQueue.prototype.snapshot = function () {
    var items = Array.from(this.entries.values()).map(function (entry) {
      return { id: entry.id, value: entry.value, saving: entry.saving, error: entry.error };
    });
    return {
      unsaved: items.length,
      pending: items.filter(function (item) { return item.saving; }).length,
      failed: items.filter(function (item) { return item.error; }).length,
      items: items
    };
  };
  SaveQueue.prototype.notify = function () {
    var state = this.snapshot();
    this.onChange(state);
    if (!state.pending) {
      this.waiters.splice(0).forEach(function (waiter) {
        if (state.unsaved) waiter.reject(new Error('Some choices are not saved. Retry before continuing.'));
        else waiter.resolve();
      });
    }
  };
  SaveQueue.prototype.set = function (id, value, restoreOnly) {
    var entry = this.entries.get(id) || { id: id, revision: 0, saving: false };
    entry.value = value;
    entry.revision++;
    entry.error = !!restoreOnly;
    this.entries.set(id, entry);
    if (!restoreOnly) this.pump(entry);
    else this.notify();
  };
  SaveQueue.prototype.pump = function (entry) {
    if (entry.saving) { this.notify(); return; }
    var self = this, revision = entry.revision, value = entry.value;
    entry.saving = true;
    entry.error = false;
    this.notify();
    Promise.resolve().then(function () { return self.write(entry.id, value); }).then(function () {
      entry.saving = false;
      if (entry.revision === revision) self.entries.delete(entry.id);
      else { self.pump(entry); return; }
      self.notify();
    }, function () {
      entry.saving = false;
      if (entry.revision !== revision) { self.pump(entry); return; }
      entry.error = true;
      self.notify();
    });
  };
  SaveQueue.prototype.retry = function () {
    var self = this;
    this.entries.forEach(function (entry) { if (!entry.saving) self.pump(entry); });
  };
  SaveQueue.prototype.settled = function () {
    var self = this, state = this.snapshot();
    if (!state.unsaved) return Promise.resolve();
    if (!state.pending) return Promise.reject(new Error('Some choices are not saved. Retry before continuing.'));
    return new Promise(function (resolve, reject) { self.waiters.push({ resolve: resolve, reject: reject }); });
  };
  return SaveQueue;
});
