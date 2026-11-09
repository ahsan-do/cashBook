import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePressableStyle } from '../../src/utils/resolvePressableStyle.ts';

test('resolves dynamic pressed styles without dropping layout properties', () => {
  const style = ({ pressed }) => ({ width: '30%', minHeight: 48, flex: 1, margin: 4, alignSelf: 'stretch', backgroundColor: pressed ? 'pressed' : 'idle' });
  assert.deepEqual(resolvePressableStyle(style, { pressed: false }), {
    width: '30%', minHeight: 48, flex: 1, margin: 4, alignSelf: 'stretch', backgroundColor: 'idle',
  });
  assert.deepEqual(resolvePressableStyle(style, { pressed: true }), {
    width: '30%', minHeight: 48, flex: 1, margin: 4, alignSelf: 'stretch', backgroundColor: 'pressed',
  });
});
