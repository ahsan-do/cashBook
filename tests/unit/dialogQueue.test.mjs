import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDialogQueue } from '../../src/utils/dialogQueue.ts';

test('dialog queue keeps one active request and resolves requests in FIFO order', async () => {
  const queue = createDialogQueue();
  const firstPromise = queue.enqueue('first');
  const secondPromise = queue.enqueue('second');
  assert.equal(queue.current, 'first');
  queue.settle(true);
  assert.equal(await firstPromise, true);
  assert.equal(queue.current, 'second');
  queue.settle(false);
  assert.equal(await secondPromise, false);
  assert.equal(queue.current, null);
});

test('queued dialog requests can be canceled without skipping the next request', async () => {
  const queue = createDialogQueue();
  const results = [queue.enqueue('one'), queue.enqueue('two'), queue.enqueue('three')];
  queue.settle(false);
  queue.settle(true);
  queue.settle(false);
  assert.deepEqual(await Promise.all(results), [false, true, false]);
});
