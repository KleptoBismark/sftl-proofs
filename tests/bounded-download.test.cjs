const test = require('node:test');
const assert = require('node:assert/strict');
const read = require('../assets/js/bounded-download.js');
test('unknown-length responses stop and cancel when bytes exceed the budget', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({pull(c) {c.enqueue(new Uint8Array(8));},cancel() {cancelled=true;}}));
  await assert.rejects(read(response, 12), /too large/);
  assert.equal(cancelled,true);
});
test('a declared oversized response is rejected without buffering its body', async () => {
  let cancelled=false;
  const response = new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-length':'100'}});
  await assert.rejects(read(response,10), /too large/); assert.equal(cancelled,true);
});
test('a small download retains every byte; network errors fail the bundle', async () => {
  assert.equal(await (await read(new Response('photo'),10)).text(),'photo');
  await assert.rejects(read(new Response('no',{status:503}),10), /failed/);
});
