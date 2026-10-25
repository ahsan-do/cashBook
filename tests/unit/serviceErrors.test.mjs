import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toServiceError } from '../../src/services/serviceErrors.ts';

test('maps authorization, duplicate, missing-row, and invalid-state database codes', () => {
  assert.match(toServiceError({ code: '42501' }, 'load').message, /permission|verified/i);
  assert.match(toServiceError({ code: '23505' }, 'create').message, /already exists|already been used/i);
  assert.match(toServiceError({ code: 'P0002' }, 'load').message, /not found|no longer available/i);
  assert.match(toServiceError({ code: '55000' }, 'accept').message, /expired|already been used/i);
});

test('preserves readable server messages for unmapped failures', () => {
  assert.equal(toServiceError({ code: '22023', message: 'Invalid page size' }, 'load').message, 'Invalid page size');
  assert.equal(toServiceError({}, 'load').message, 'load failed. Please try again.');
});
