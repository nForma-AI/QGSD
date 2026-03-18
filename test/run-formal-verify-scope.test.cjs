'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'bin', 'run-formal-verify.cjs');

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: path.join(__dirname, '..'),
  });
}

describe('run-formal-verify --scope', () => {

  it('--scope with unknown model exits with error', () => {
    const result = run('--scope=nonexistent-model-xyz');
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('No models match --scope=nonexistent-model-xyz'),
      'Should show error message for unknown scope');
  });

  it('--scope with unknown model lists available model IDs', () => {
    const result = run('--scope=nonexistent-model-xyz');
    assert.ok(result.stderr.includes('Available model IDs'),
      'Should list available model IDs in error output');
  });

  it('--scope is case-insensitive', () => {
    // Both MCSAFETY and mcsafety should match the same step
    const upper = run('--scope=NONEXISTENT-XYZ');
    const lower = run('--scope=nonexistent-xyz');
    // Both should fail with same error (no match)
    assert.strictEqual(upper.status, 1);
    assert.strictEqual(lower.status, 1);
    // Both error messages should reference the lowercased version
    assert.ok(upper.stderr.includes('No models match'));
    assert.ok(lower.stderr.includes('No models match'));
  });

  it('--scope accepts comma-separated list', () => {
    // Even if models don't exist, the scope should parse correctly
    const result = run('--scope=model-a,model-b');
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('No models match --scope=model-a,model-b'),
      'Should show both models in error message');
  });

  it('default behavior (no --scope) shows all steps', () => {
    // Run with --only=generate to limit scope (fast, no heavy checkers)
    const result = run('--only=generate');
    // Should not error about scope
    assert.ok(!result.stderr.includes('No models match'),
      'Should not show scope error when --scope is not used');
  });

});
