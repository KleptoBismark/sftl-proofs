const test = require('node:test');
const assert = require('node:assert/strict');
const Queue = require('../assets/js/save-queue.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const requests = [], snapshots = [];
  const queue = new Queue((id, value) => new Promise((resolve, reject) => {
    requests.push({ id, value, resolve, reject });
  }), state => snapshots.push(state));
  return { queue, requests, snapshots };
}
test('rapid choices cannot overtake earlier writes; intermediate choices coalesce', async () => {
  const { queue, requests } = setup();
  queue.set('one', 4); queue.set('one', 2); queue.set('one', 5);
  await tick();
  assert.deepEqual(requests.map(r => r.value), [4]);
  requests[0].resolve(); await tick();
  assert.deepEqual(requests.map(r => r.value), [4, 5]);
  requests[1].resolve(); await queue.settled();
  assert.equal(queue.snapshot().unsaved, 0);
});
test('success on another image cannot hide an unsaved choice; retry preserves latest intent', async () => {
  const { queue, requests } = setup();
  queue.set('failed', 3); queue.set('other', 4); await tick();
  requests[0].reject(new Error('offline')); await tick();
  requests[1].resolve(); await tick();
  assert.equal(queue.snapshot().failed, 1);
  assert.equal(queue.snapshot().unsaved, 1);
  await assert.rejects(queue.settled(), /not saved/);
  queue.retry(); await tick();
  assert.deepEqual([requests[2].id, requests[2].value], ['failed', 3]);
  requests[2].resolve(); await queue.settled();
  assert.equal(queue.snapshot().unsaved, 0);
});
test('clearing a rating is serialized and sends null', async () => {
  const { queue, requests } = setup();
  queue.set('one', 5); queue.set('one', null); await tick();
  requests[0].resolve(); await tick();
  assert.equal(requests[1].value, null);
  requests[1].resolve(); await queue.settled();
});
test('restored drafts remain unsaved until deliberate retry', async () => {
  const { queue, requests } = setup();
  queue.set('one', 4, true); await tick();
  assert.equal(requests.length, 0);
  assert.equal(queue.snapshot().failed, 1);
  queue.retry(); await tick(); requests[0].resolve(); await queue.settled();
  assert.equal(queue.snapshot().unsaved, 0);
});
test('a failed older write still permits the newer intent to be saved', async () => {
  const { queue, requests } = setup();
  queue.set('one', 1); queue.set('one', 5); await tick();
  requests[0].reject(new Error('timeout')); await tick();
  assert.deepEqual(requests.map(r => r.value), [1, 5]);
  requests[1].resolve(); await queue.settled();
  assert.equal(queue.snapshot().failed, 0);
});
