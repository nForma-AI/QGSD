#!/usr/bin/env node
'use strict';
// bin/verifier-formal-context.test.cjs
// TDD tests for v0.23-02: formal context parsing in nf-verifier.md
// STRUCTURAL tests are RED until Plan 03 updates agents/nf-verifier.md
// and Plan 04 installs it to ~/.claude/agents/nf-verifier.md.
// UNIT tests are GREEN from the start (pure functions, no file reads).
// Requirements: WFI-04, ENF-01, ENF-02

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ----- UNIT TESTS (GREEN from the start) -----

// Inline status-determination logic — mirrors verifier Step 8.5 + Step 9 routing
function getFormalStatus(result) {
  if (result === null) return 'skip';
  if (result.failed > 0) return 'counterexample_found';
  if (result.passed === 0 && result.skipped > 0) return 'tooling_absent';
  return 'passed';
}

test('FORMAL_CHECK_RESULT with failed > 0 maps to counterexample_found', () => {
  assert.strictEqual(
    getFormalStatus({ passed: 0, failed: 1, skipped: 0 }),
    'counterexample_found'
  );
});

test('FORMAL_CHECK_RESULT with passed > 0 and failed == 0 maps to passed', () => {
  assert.strictEqual(
    getFormalStatus({ passed: 2, failed: 0, skipped: 0 }),
    'passed'
  );
});

test('FORMAL_CHECK_RESULT with all skipped does NOT map to counterexample_found', () => {
  const status = getFormalStatus({ passed: 0, failed: 0, skipped: 3 });
  assert.notStrictEqual(status, 'counterexample_found',
    'All-skipped (tooling absent) must not trigger counterexample_found — fail-open required');
  assert.strictEqual(status, 'tooling_absent');
});

test('null FORMAL_CHECK_RESULT maps to skip (no formal scope)', () => {
  assert.strictEqual(getFormalStatus(null), 'skip');
});

// ----- STRUCTURAL TESTS (RED until Plan 03 + Plan 04 install) -----
// These tests read the INSTALLED nf-verifier.md from ~/.claude/agents/nf-verifier.md
// Plan 04 runs the installer — until then, this file lacks counterexample_found.

const INSTALLED_VERIFIER = path.join(os.homedir(), '.claude', 'agents', 'nf-verifier.md');

let verifierContent = '';
try {
  verifierContent = fs.readFileSync(INSTALLED_VERIFIER, 'utf8');
} catch (e) {
  // File not found — structural tests will fail (RED — correct for TDD)
  verifierContent = '';
}

test('agents/nf-verifier.md contains counterexample_found status', () => {
  assert.match(
    verifierContent,
    /counterexample_found/,
    'Pattern not found: expected "counterexample_found" in ~/.claude/agents/nf-verifier.md'
  );
});

test('agents/nf-verifier.md contains FORMAL_CHECK_RESULT reference', () => {
  assert.match(
    verifierContent,
    /FORMAL_CHECK_RESULT/,
    'Pattern not found: expected "FORMAL_CHECK_RESULT" in ~/.claude/agents/nf-verifier.md'
  );
});
