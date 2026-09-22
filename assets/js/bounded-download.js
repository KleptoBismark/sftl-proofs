(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SFTLReadLimited = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return async function readLimited(response, limit) {
    if (!response.ok) throw new Error('Download failed');
    if (!response.body || !response.body.getReader) throw new Error('Please download photographs individually in this browser.');
    var reader = response.body.getReader(), chunks = [], total = 0;
    try {
      if (Number(response.headers.get('content-length')) > limit) throw new Error('Album is too large for a single web ZIP. Download photographs individually.');
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > limit) throw new Error('Album is too large for a single web ZIP. Download photographs individually.');
        chunks.push(chunk.value);
      }
      return new Blob(chunks);
    } finally { await reader.cancel().catch(function () {}); reader.releaseLock(); }
  };
});
