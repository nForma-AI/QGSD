const { test, assert } = require('node:test');
const fs = require('fs');

test('fs.existsSync returns true for existing files', () => {
  assert.ok(fs.existsSync(__filename));
});

test('fs.existsSync returns false for missing files', () => {
  assert.ok(!fs.existsSync('/nonexistent/bench/file'));
});