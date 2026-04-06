#!/usr/bin/env node
'use strict';
// bin/coding-task-router.test.cjs
// Tests for coding-task-router.cjs — Mode C coding delegation
// Pattern: coding-task-router\.cjs|buildCodingPrompt|parseCodingResult|routeCodingTask|selectSlot

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// ── Load module ─────────────────────────────────────────────────────────────
let mod;
try {
  mod = require(path.resolve(__dirname, './coding-task-router.cjs'));
} catch (e) {
  mod = null;
}

// ── STRUCTURAL TESTS ────────────────────────────────────────────────────────

test('module exists: bin/coding-task-router.cjs can be required without error', () => {
  assert.ok(mod, 'bin/coding-task-router.cjs not found');
});

test('exports: buildCodingPrompt is exported as a function', () => {
  assert.ok(mod, 'module not loaded');
  assert.strictEqual(typeof mod.buildCodingPrompt, 'function');
});

test('exports: parseCodingResult is exported as a function', () => {
  assert.ok(mod, 'module not loaded');
  assert.strictEqual(typeof mod.parseCodingResult, 'function');
});

test('exports: routeCodingTask is exported as a function', () => {
  assert.ok(mod, 'module not loaded');
  assert.strictEqual(typeof mod.routeCodingTask, 'function');
});

test('exports: selectSlot is exported as a function', () => {
  assert.ok(mod, 'module not loaded');
  assert.strictEqual(typeof mod.selectSlot, 'function');
});

// ── buildCodingPrompt TESTS ─────────────────────────────────────────────────

test('buildCodingPrompt produces prompt with all sections', () => {
  assert.ok(mod, 'module not loaded');
  const prompt = mod.buildCodingPrompt({
    task: 'Add a login function',
    repoDir: '/tmp/test-repo',
    files: ['src/auth.js', 'src/utils.js'],
    constraints: ['use CommonJS', 'do not modify tests'],
    context: 'Previous attempt failed with TypeError',
  });

  assert.ok(prompt.includes('=== TASK ==='), 'missing TASK section');
  assert.ok(prompt.includes('Add a login function'), 'missing task text');
  assert.ok(prompt.includes('=== REPOSITORY ==='), 'missing REPOSITORY section');
  assert.ok(prompt.includes('/tmp/test-repo'), 'missing repo dir');
  assert.ok(prompt.includes('=== FILES ==='), 'missing FILES section');
  assert.ok(prompt.includes('src/auth.js'), 'missing file entry');
  assert.ok(prompt.includes('=== CONSTRAINTS ==='), 'missing CONSTRAINTS section');
  assert.ok(prompt.includes('use CommonJS'), 'missing constraint');
  assert.ok(prompt.includes('=== CONTEXT ==='), 'missing CONTEXT section');
  assert.ok(prompt.includes('TypeError'), 'missing context text');
  assert.ok(prompt.includes('=== OUTPUT FORMAT ==='), 'missing OUTPUT FORMAT section');
  assert.ok(prompt.includes('status: SUCCESS | PARTIAL | FAILED'), 'missing status instruction');
});

test('buildCodingPrompt with no optional fields produces valid prompt', () => {
  assert.ok(mod, 'module not loaded');
  const prompt = mod.buildCodingPrompt({
    task: 'Refactor the parser',
    repoDir: '/tmp/repo',
  });

  assert.ok(prompt.includes('=== TASK ==='), 'missing TASK section');
  assert.ok(prompt.includes('Refactor the parser'), 'missing task text');
  assert.ok(prompt.includes('=== REPOSITORY ==='), 'missing REPOSITORY section');
  assert.ok(!prompt.includes('=== FILES ==='), 'FILES section should be absent');
  assert.ok(!prompt.includes('=== CONSTRAINTS ==='), 'CONSTRAINTS section should be absent');
  assert.ok(!prompt.includes('=== CONTEXT ==='), 'CONTEXT section should be absent');
  assert.ok(prompt.includes('=== OUTPUT FORMAT ==='), 'missing OUTPUT FORMAT section');
});

// ── parseCodingResult TESTS ─────────────────────────────────────────────────

test('parseCodingResult extracts structured fields from well-formed output', () => {
  assert.ok(mod, 'module not loaded');
  const output = [
    'status: SUCCESS',
    'files_modified: [src/auth.js, src/utils.js]',
    'summary: Implemented the login function with JWT support',
    'diff_preview: |',
    '  +function login() { return jwt.sign({}); }',
  ].join('\n');

  const result = mod.parseCodingResult(output);
  assert.strictEqual(result.status, 'SUCCESS');
  assert.deepStrictEqual(result.filesModified, ['src/auth.js', 'src/utils.js']);
  assert.ok(result.summary.includes('login function'), 'summary missing expected content');
  assert.ok(result.rawOutput === output, 'rawOutput should match input');
});

test('parseCodingResult handles malformed output gracefully (fail-open)', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.parseCodingResult('Some random output with no structure');

  assert.strictEqual(result.status, 'UNKNOWN', 'should default to UNKNOWN');
  assert.deepStrictEqual(result.filesModified, [], 'should default to empty array');
  assert.ok(result.summary.length > 0, 'should have some summary');
  assert.ok(result.rawOutput.includes('Some random output'), 'rawOutput preserved');
});

test('parseCodingResult handles empty string (fail-open)', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.parseCodingResult('');

  assert.strictEqual(result.status, 'UNKNOWN');
  assert.deepStrictEqual(result.filesModified, []);
  assert.strictEqual(result.rawOutput, '');
});

test('parseCodingResult handles null/undefined input', () => {
  assert.ok(mod, 'module not loaded');
  const result = mod.parseCodingResult(null);

  assert.strictEqual(result.status, 'UNKNOWN');
  assert.deepStrictEqual(result.filesModified, []);
});

test('parseCodingResult extracts FAILED status', () => {
  assert.ok(mod, 'module not loaded');
  const output = 'status: FAILED\nsummary: compilation error in main.js';
  const result = mod.parseCodingResult(output);

  assert.strictEqual(result.status, 'FAILED');
  assert.ok(result.summary.includes('compilation error'), 'summary should contain error description');
});

test('parseCodingResult extracts PARTIAL status', () => {
  assert.ok(mod, 'module not loaded');
  const output = 'status: PARTIAL\nfiles_modified: [src/a.js]\nsummary: Partially implemented';
  const result = mod.parseCodingResult(output);

  assert.strictEqual(result.status, 'PARTIAL');
  assert.deepStrictEqual(result.filesModified, ['src/a.js']);
});

// ── selectSlot TESTS ────────────────────────────────────────────────────────

test('selectSlot returns first file-access subprocess provider', () => {
  assert.ok(mod, 'module not loaded');
  const providers = [
    { name: 'claude-1', type: 'http', has_file_access: false },
    { name: 'codex-1', type: 'subprocess', has_file_access: true },
    { name: 'gemini-1', type: 'subprocess', has_file_access: true },
  ];

  const result = mod.selectSlot('implement', providers);
  assert.strictEqual(result, 'codex-1');
});

test('selectSlot returns null when no suitable providers exist', () => {
  assert.ok(mod, 'module not loaded');
  const providers = [
    { name: 'claude-1', type: 'http', has_file_access: false },
    { name: 'claude-2', type: 'http', has_file_access: false },
  ];

  const result = mod.selectSlot('implement', providers);
  assert.strictEqual(result, null);
});

test('selectSlot returns null for empty array', () => {
  assert.ok(mod, 'module not loaded');
  assert.strictEqual(mod.selectSlot('fix', []), null);
});

test('selectSlot returns null for non-array input', () => {
  assert.ok(mod, 'module not loaded');
  assert.strictEqual(mod.selectSlot('fix', null), null);
  assert.strictEqual(mod.selectSlot('fix', undefined), null);
});
