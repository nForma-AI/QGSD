#!/usr/bin/env node
'use strict';
// bin/oscillation-audit.test.cjs
// Regression tests for SPEC-02: NFOscillation.tla vs nf-circuit-breaker.js audit.
//
// Tests verify:
//   1. NFOscillation.tla exists and contains OscillationFlaggedCorrectly invariant
//   2. SPEC-02 audit comment is present in spec header
//   3. Fixture tests via exported buildWarningNotice/buildBlockReason interface (or todo)
//   4. MCoscillation.cfg constants match expected values: Depth=3, CommitWindow=5

const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('fs');
const path     = require('path');

const ROOT   = path.join(__dirname, '..');
const TLA_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'NFOscillation.tla');
const CFG_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'MCoscillation.cfg');

// ── Test 1: NFOscillation.tla exists and contains OscillationFlaggedCorrectly ──

test('NFOscillation.tla exists and contains OscillationFlaggedCorrectly invariant', () => {
  assert.ok(fs.existsSync(TLA_FILE), '.planning/formal/tla/NFOscillation.tla must exist');
  const content = fs.readFileSync(TLA_FILE, 'utf8');
  assert.ok(
    content.includes('OscillationFlaggedCorrectly'),
    'NFOscillation.tla must define OscillationFlaggedCorrectly invariant'
  );
});

// ── Test 2: SPEC-02 audit comment exists in spec header ──────────────────────

test('NFOscillation.tla contains SPEC-02 audit comment', () => {
  const content = fs.readFileSync(TLA_FILE, 'utf8');
  assert.ok(
    content.includes('SPEC-02 audit'),
    'NFOscillation.tla header must include the SPEC-02 audit comment confirming correctness'
  );
  // Verify it specifically confirms correctness (no divergence found)
  assert.ok(
    content.includes('Confirmed correct') || content.includes('confirmed correct'),
    'SPEC-02 audit comment must confirm correctness (no divergence found)'
  );
});

// ── Test 3: Fixture test via exported interface (or todo) ─────────────────────
//
// NOTE: hasReversionInHashes and detectOscillation are NOT exported from
// hooks/nf-circuit-breaker.js. Only buildWarningNotice and buildBlockReason are exported.
//
// buildWarningNotice(state) and buildBlockReason(state) accept a state object
// with { file_set: [], commit_window_snapshot: [] } — they do NOT accept injectable
// commit arrays for algorithm testing.
//
// Therefore, direct fixture testing of the oscillation algorithm is not possible
// through the current exported interface. These tests are marked todo with documentation
// explaining what would be needed: exporting hasReversionInHashes from nf-circuit-breaker.js.

test.todo(
  'Fixture: A→B→A oscillation with net zero change flags as oscillation (requires injectable commit array; hasReversionInHashes not exported from nf-circuit-breaker.js)'
);

test.todo(
  'Fixture: TDD progression with net positive additions does NOT flag as oscillation (requires injectable commit array; hasReversionInHashes not exported)'
);

// ── Test 4: MCoscillation.cfg constants match expected values ─────────────────

test('MCoscillation.cfg constants match expected values: Depth=3, CommitWindow=5', () => {
  assert.ok(fs.existsSync(CFG_FILE), '.planning/formal/tla/MCoscillation.cfg must exist');
  const content = fs.readFileSync(CFG_FILE, 'utf8');
  assert.ok(
    content.includes('Depth = 3'),
    'MCoscillation.cfg must set Depth = 3 (matches JS oscillation_depth default)'
  );
  assert.ok(
    content.includes('CommitWindow = 5'),
    'MCoscillation.cfg must set CommitWindow = 5 (matches JS commit_window default)'
  );
});

// ── Test 5: suspects.md contains SPEC-02 audit findings ──────────────────────

test('.planning/formal/suspects.md contains SPEC-02 Oscillation Audit section', () => {
  const suspectsPath = path.join(ROOT, '.planning', 'formal', 'suspects.md');
  assert.ok(fs.existsSync(suspectsPath), '.planning/formal/suspects.md must exist');
  const content = fs.readFileSync(suspectsPath, 'utf8');
  assert.ok(
    content.includes('SPEC-02 Oscillation Audit'),
    '.planning/formal/suspects.md must contain SPEC-02 Oscillation Audit section'
  );
  // Verify all 4 comparison points are documented
  assert.ok(content.includes('Run-collapse algorithm'), 'suspects.md must document run-collapse comparison');
  assert.ok(content.includes('Depth threshold'), 'suspects.md must document depth threshold comparison');
  assert.ok(content.includes('hasReversionInHashes'), 'suspects.md must document net-diff comparison');
  assert.ok(content.includes('Flag condition'), 'suspects.md must document flag condition comparison');
});
