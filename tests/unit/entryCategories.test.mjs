import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { entryDisplayTitle } from '../../src/utils/entryDisplayTitle.ts';
import { categoriesByType } from '../../src/theme/categories.ts';

const require = createRequire(import.meta.url);
const glyphMapPath = require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const ioniconsGlyphMap = JSON.parse(readFileSync(glyphMapPath, 'utf8'));

test('entryDisplayTitle uses a non-blank note, otherwise the category', () => {
  assert.equal(entryDisplayTitle({ description: '  Paid electricity  ', category: 'Bills' }), 'Paid electricity');
  assert.equal(entryDisplayTitle({ description: '   \n ', category: 'Bills' }), 'Bills');
  assert.equal(entryDisplayTitle({ description: '', category: 'Food' }), 'Food');
});

test('each transaction type has unique categories, icons, and Other', () => {
  for (const [type, categories] of Object.entries(categoriesByType)) {
    const names = categories.map(({ name }) => name);
    assert.equal(new Set(names).size, names.length, `${type} category names are unique`);
    assert.ok(names.includes('Other'), `${type} includes Other`);
    for (const item of categories) {
      assert.ok(item.name.length <= 60, `${type} category ${item.name} is within the database limit`);
      assert.ok(item.icon, `${type} category ${item.name} has an icon`);
      assert.ok(item.accessibilityLabel, `${type} category ${item.name} has an accessibility label`);
      assert.ok(Object.hasOwn(ioniconsGlyphMap, item.icon), `${type} category ${item.name} icon ${item.icon} exists in Ionicons`);
    }
  }
});
