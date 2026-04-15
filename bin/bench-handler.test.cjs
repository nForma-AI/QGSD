const { test, assert } = require('node:test');

let mod;
try { mod = require('./bench-feature-handler.cjs'); } catch (e) { mod = null; }

test('processFeature returns processed object', () => {
  assert.ok(mod, 'module should load');
  const result = mod.processFeature({ name: 'test' });
  assert.ok(result.processed);
  assert.strictEqual(result.name, 'test');
});

test('validateFeature checks processed flag', () => {
  assert.ok(mod, 'module should load');
  assert.ok(mod.validateFeature({ processed: true, name: 'x' }));
  assert.ok(!mod.validateFeature({ processed: false, name: 'x' }));
});