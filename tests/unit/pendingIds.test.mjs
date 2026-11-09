import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPendingIdGuard } from '../../src/utils/pendingIds.ts';

test('pending id guard blocks duplicate actions synchronously and releases after completion', () => {
  const guard = createPendingIdGuard();
  assert.equal(guard.begin('entry-1'), true);
  assert.equal(guard.has('entry-1'), true);
  assert.equal(guard.begin('entry-1'), false);
  assert.equal(guard.begin('entry-2'), true);
  guard.finish('entry-1');
  assert.equal(guard.has('entry-1'), false);
  assert.equal(guard.begin('entry-1'), true);
  assert.equal(guard.has('entry-2'), true);
});
