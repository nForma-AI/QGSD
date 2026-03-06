#!/usr/bin/env node
'use strict';
// bin/plan-phase-fv-gate.test.cjs
// Wave 0 RED test scaffold for Phase v0.20-03: Planning Gate
// Tests 1-3: structural assertions on plan-phase.md — FAIL until step 8.3 is implemented
// Tests 4-6: unit tests of NDJSON extraction algorithm — PASS (algorithm correctness)
// Requirements: PLAN-01, PLAN-02, PLAN-03

const { test }  = require('node:test');
const assert    = require('node:assert');
const fs        = require('node:fs');
const path      = require('path');
const os        = require('os');

const PLAN_PHASE_MD = '/Users/jonathanborduas/.claude/nf/workflows/plan-phase.md';

// ── Structural tests (Tests 1-3): RED until Plan 02 implements step 8.3 ─────

test('PLAN-01: plan-phase.md contains formal verification step with --only=tla', () => {
  const src = fs.readFileSync(PLAN_PHASE_MD, 'utf8');
  assert.match(src, /run-formal-verify\.cjs --only=tla/,
    'plan-phase.md must contain a step that invokes run-formal-verify.cjs --only=tla');
});

test('PLAN-02: plan-phase.md surfaces TLC fail results as hypotheses before quorum', () => {
  const src = fs.readFileSync(PLAN_PHASE_MD, 'utf8');
  assert.match(src, /FV_HYPOTHESES|fv_hypotheses|hypothes/i,
    'plan-phase.md must reference hypothesis surfacing for TLC fail results');
  assert.match(src, /result.*fail|fail.*result/i,
    'plan-phase.md must filter for result=fail entries from check-results.ndjson');
});

test('PLAN-03: plan-phase.md documents fail-open behavior for FV gate', () => {
  const src = fs.readFileSync(PLAN_PHASE_MD, 'utf8');
  assert.match(src, /fail.?open|PLAN-03/i,
    'plan-phase.md must document that the FV gate is fail-open (PLAN-03)');
});

// ── Algorithm unit tests (Tests 4-6): PASS — test NDJSON extraction logic ───

test('PLAN-02 unit: NDJSON extraction identifies fail entries from check-results.ndjson', () => {
  // Simulate the inline node -e logic that will be in plan-phase.md step 8.3
  const tmpFile = path.join(os.tmpdir(), 'fv-gate-test-' + Date.now() + '.ndjson');
  const entries = [
    { tool: 'run-tlc', result: 'pass', check_id: 'tla:quorum-safety', surface: 'quorum', property: 'Safety', summary: 'pass: tla:quorum-safety in 100ms' },
    { tool: 'run-tlc', result: 'fail', check_id: 'tla:quorum-liveness', surface: 'quorum', property: 'Liveness', summary: 'fail: tla:quorum-liveness — counterexample found' },
    { tool: 'run-tlc', result: 'inconclusive', check_id: 'tla:oscillation', surface: 'oscillation', property: 'NoOscillation', summary: 'inconclusive: tla:oscillation' },
  ];
  fs.writeFileSync(tmpFile, entries.map(e => JSON.stringify(e)).join('\n'), 'utf8');

  try {
    const lines = fs.readFileSync(tmpFile, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const fails = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
      .filter(r => r && r.result === 'fail');
    assert.strictEqual(fails.length, 1, 'Should find exactly 1 fail entry');
    assert.strictEqual(fails[0].check_id, 'tla:quorum-liveness', 'Should identify correct fail entry');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('PLAN-02 unit: NDJSON extraction returns empty when all results are pass/inconclusive', () => {
  const tmpFile = path.join(os.tmpdir(), 'fv-gate-test-empty-' + Date.now() + '.ndjson');
  const entries = [
    { tool: 'run-tlc', result: 'pass', check_id: 'tla:quorum-safety', surface: 'quorum', property: 'Safety', summary: 'pass' },
    { tool: 'run-tlc', result: 'inconclusive', check_id: 'tla:oscillation', surface: 'oscillation', property: 'NoOsc', summary: 'inconclusive' },
  ];
  fs.writeFileSync(tmpFile, entries.map(e => JSON.stringify(e)).join('\n'), 'utf8');

  try {
    const lines = fs.readFileSync(tmpFile, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const fails = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
      .filter(r => r && r.result === 'fail');
    assert.strictEqual(fails.length, 0, 'Should find 0 fail entries when all pass/inconclusive');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('PLAN-03 unit: fail-open behavior — empty NDJSON does not throw', () => {
  const tmpFile = path.join(os.tmpdir(), 'fv-gate-test-missing-' + Date.now() + '.ndjson');
  // Write empty file (simulates TLC unavailability producing no output)
  fs.writeFileSync(tmpFile, '', 'utf8');

  try {
    const lines = fs.readFileSync(tmpFile, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const fails = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
      .filter(r => r && r.result === 'fail');
    // Must not throw — fail-open behavior
    assert.strictEqual(fails.length, 0, 'Empty NDJSON should produce 0 fail entries (fail-open)');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
