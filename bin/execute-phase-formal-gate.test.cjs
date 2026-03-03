#!/usr/bin/env node
'use strict';
// bin/execute-phase-formal-gate.test.cjs
// TDD tests for v0.23-02: formal gate integration in execute-phase.md
// STRUCTURAL tests are RED until Plan 02 updates qgsd-core/workflows/execute-phase.md
// and Plan 04 installs it to ~/.claude/qgsd/workflows/execute-phase.md.
// UNIT tests are GREEN from the start (pure functions, no file reads).
// Requirements: WFI-03, ENF-01, ENF-02, ENF-03

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ----- UNIT TESTS (GREEN from the start) -----

// Inline logic under test — mirrors the bash-equivalent extraction used in execute-phase
function extractModules(ctxArray) {
  return ctxArray.map(e => {
    const m = e.match(/"module":"([^"]+)"/);
    return m ? m[1] : null;
  }).filter(Boolean).join(',');
}

// Inline status-determination logic — mirrors verifier routing
function getFormalStatus(result) {
  if (result === null) return 'skip';
  if (result.failed > 0) return 'counterexample_found';
  if (result.passed === 0 && result.skipped > 0) return 'tooling_absent';
  return 'passed';
}

test('extractModules: single entry returns module name', () => {
  const input = ['{"module":"quorum","path":".formal/spec/quorum/invariants.md"}'];
  assert.strictEqual(extractModules(input), 'quorum');
});

test('extractModules: two entries returns comma-separated names', () => {
  const input = [
    '{"module":"quorum","path":".formal/spec/quorum/invariants.md"}',
    '{"module":"breaker","path":".formal/spec/breaker/invariants.md"}',
  ];
  assert.strictEqual(extractModules(input), 'quorum,breaker');
});

test('extractModules: empty array returns empty string (triggers skip)', () => {
  assert.strictEqual(extractModules([]), '');
});

test('getFormalStatus: null result returns skip', () => {
  assert.strictEqual(getFormalStatus(null), 'skip');
});

test('getFormalStatus: failed > 0 returns counterexample_found', () => {
  assert.strictEqual(getFormalStatus({ passed: 0, failed: 1, skipped: 0 }), 'counterexample_found');
});

test('getFormalStatus: all passed returns passed', () => {
  assert.strictEqual(getFormalStatus({ passed: 2, failed: 0, skipped: 0 }), 'passed');
});

test('getFormalStatus: all skipped returns tooling_absent (not counterexample_found)', () => {
  const status = getFormalStatus({ passed: 0, failed: 0, skipped: 3 });
  assert.strictEqual(status, 'tooling_absent');
  assert.notStrictEqual(status, 'counterexample_found');
});

// ----- STRUCTURAL TESTS (RED until Plan 02 + Plan 04 install) -----
// These tests read the INSTALLED execute-phase.md from ~/.claude/qgsd/workflows/execute-phase.md
// Plan 04 runs the installer — until then, this file lacks the formal gate content.

const INSTALLED_EXECUTE_PHASE = path.join(os.homedir(), '.claude', 'qgsd', 'workflows', 'execute-phase.md');

let executePhaseContent = '';
try {
  executePhaseContent = fs.readFileSync(INSTALLED_EXECUTE_PHASE, 'utf8');
} catch (e) {
  // File not found — all structural tests will fail (RED — correct for TDD)
  executePhaseContent = '';
}

test('execute-phase.md contains run-formal-check.cjs invocation', () => {
  assert.match(
    executePhaseContent,
    /run-formal-check\.cjs/,
    'Pattern not found: expected "run-formal-check.cjs" in ~/.claude/qgsd/workflows/execute-phase.md'
  );
});

test('execute-phase.md contains FORMAL_CHECK_RESULT extraction pattern', () => {
  assert.match(
    executePhaseContent,
    /FORMAL_CHECK_RESULT/,
    'Pattern not found: expected "FORMAL_CHECK_RESULT" in ~/.claude/qgsd/workflows/execute-phase.md'
  );
});

test('execute-phase.md contains counterexample_found status routing', () => {
  assert.match(
    executePhaseContent,
    /counterexample_found/,
    'Pattern not found: expected "counterexample_found" in ~/.claude/qgsd/workflows/execute-phase.md'
  );
});

test('execute-phase.md contains counterexample_override override path', () => {
  assert.match(
    executePhaseContent,
    /counterexample_override/,
    'Pattern not found: expected "counterexample_override" in ~/.claude/qgsd/workflows/execute-phase.md'
  );
});
