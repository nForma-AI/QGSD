#!/usr/bin/env node
'use strict';
// bin/call-quorum-slot-infra.test.cjs
// Infrastructure tests for quick-367: findProjectRoot cwd param + exit-code-with-valid-output

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Import the function under test (guarded by require.main !== module)
const { findProjectRoot } = require('./call-quorum-slot.cjs');

// ─── findProjectRoot tests ──────────────────────────────────────────────────

test('findProjectRoot with valid cwd containing .planning/ returns that cwd', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpr-valid-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'));
  try {
    const result = findProjectRoot(tmpDir);
    assert.strictEqual(result, tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('findProjectRoot with cwd missing .planning/ falls through (does NOT return that cwd)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpr-missing-'));
  try {
    const result = findProjectRoot(tmpDir);
    // Should NOT return the tmpDir since it has no .planning/
    assert.notStrictEqual(result, tmpDir);
    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('findProjectRoot with undefined cwd returns a string (backward compat)', () => {
  const result = findProjectRoot(undefined);
  assert.strictEqual(typeof result, 'string');
  assert.ok(result.length > 0);
});

test('findProjectRoot with null cwd returns a string (backward compat)', () => {
  const result = findProjectRoot(null);
  assert.strictEqual(typeof result, 'string');
  assert.ok(result.length > 0);
});

// ─── Exit code verdict detection tests ──────────────────────────────────────

test('verdict regex matches output containing APPROVE with exit code suffix', () => {
  const output = '## Verdict: APPROVE\n\nLooks good.\n[exit code 1]';
  const hasValidVerdict = /\b(APPROVE|BLOCK|FLAG)\b/.test(output);
  const hasSubstantialOutput = output.length > 100;
  assert.strictEqual(hasValidVerdict, true, 'Should detect APPROVE verdict');
  // This output is short, but verdict alone is enough
  assert.strictEqual(hasSubstantialOutput, false, 'Short output is fine when verdict present');
});

test('short error output with no verdict is correctly classified as unavailable', () => {
  const output = 'Error: auth failed\n[exit code 1]';
  const hasValidVerdict = /\b(APPROVE|BLOCK|FLAG)\b/.test(output);
  const hasSubstantialOutput = output.length > 100;
  assert.strictEqual(hasValidVerdict, false, 'Should NOT detect a verdict in error output');
  assert.strictEqual(hasSubstantialOutput, false, 'Short error output is not substantial');
});
