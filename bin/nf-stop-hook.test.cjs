#!/usr/bin/env node
'use strict';
// bin/nf-stop-hook.test.cjs
// Tests for the NFStopHook TLA+ specification — SPEC-01.
//
// Test 1: NFStopHook.tla and MCStopHook.cfg exist on disk
// Test 2: TLC verifies Stop hook — no safety or liveness violations (skips if Java unavailable)
// Test 3: model-registry.json has entry for .planning/formal/tla/NFStopHook.tla with update_source=manual

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT       = path.join(__dirname, '..');
const TLA_FILE   = path.join(ROOT, '.planning', 'formal', 'tla', 'NFStopHook.tla');
const CFG_FILE   = path.join(ROOT, '.planning', 'formal', 'tla', 'MCStopHook.cfg');
const RUNNER     = path.join(__dirname, 'run-stop-hook-tlc.cjs');
const REGISTRY   = path.join(ROOT, '.planning', 'formal', 'model-registry.json');
const JAR_PATH   = path.join(ROOT, '.planning', 'formal', 'tla', 'tla2tools.jar');

test('NFStopHook.tla and MCStopHook.cfg exist on disk', () => {
  assert.ok(fs.existsSync(TLA_FILE), '.planning/formal/tla/NFStopHook.tla must exist');
  assert.ok(fs.existsSync(CFG_FILE), '.planning/formal/tla/MCStopHook.cfg must exist');
});

test('NFStopHook.tla contains all 6 required properties', () => {
  const content = fs.readFileSync(TLA_FILE, 'utf8');
  assert.ok(content.includes('SafetyInvariant1'), 'SafetyInvariant1 must be defined');
  assert.ok(content.includes('SafetyInvariant2'), 'SafetyInvariant2 must be defined');
  assert.ok(content.includes('SafetyInvariant3'), 'SafetyInvariant3 must be defined');
  assert.ok(content.includes('LivenessProperty1'), 'LivenessProperty1 must be defined');
  assert.ok(content.includes('LivenessProperty2'), 'LivenessProperty2 must be defined');
  assert.ok(content.includes('LivenessProperty3'), 'LivenessProperty3 must be defined');
  assert.ok(content.includes('MakeDecision'), 'MakeDecision action must be defined');
});

test('MCStopHook.cfg has correct structure: SPECIFICATION, INVARIANTs, PROPERTYs, CHECK_DEADLOCK FALSE', () => {
  const content = fs.readFileSync(CFG_FILE, 'utf8');
  assert.ok(content.includes('SPECIFICATION Spec'), 'cfg must reference SPECIFICATION Spec');
  assert.ok(content.includes('INVARIANT SafetyInvariant1'), 'cfg must include SafetyInvariant1');
  assert.ok(content.includes('INVARIANT SafetyInvariant2'), 'cfg must include SafetyInvariant2');
  assert.ok(content.includes('INVARIANT SafetyInvariant3'), 'cfg must include SafetyInvariant3');
  assert.ok(content.includes('PROPERTY LivenessProperty1'), 'cfg must include LivenessProperty1');
  assert.ok(content.includes('PROPERTY LivenessProperty2'), 'cfg must include LivenessProperty2');
  assert.ok(content.includes('PROPERTY LivenessProperty3'), 'cfg must include LivenessProperty3');
  assert.ok(content.includes('CHECK_DEADLOCK FALSE'), 'cfg must have CHECK_DEADLOCK FALSE');
  // Verify no FAIRNESS line (fairness is in Spec formula in .tla file)
  assert.ok(!content.match(/^FAIRNESS/m), 'cfg must NOT have a top-level FAIRNESS line');
});

test('TLC verifies Stop hook: no safety or liveness violations', (t) => {
  // Skip if tla2tools.jar not available (e.g. CI without Java)
  if (!fs.existsSync(JAR_PATH)) {
    t.skip('tla2tools.jar not found — skipping TLC verification test');
    return;
  }

  // Also skip if Java is unavailable
  const javaCheck = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (javaCheck.error || javaCheck.status !== 0) {
    t.skip('Java not available — skipping TLC verification test');
    return;
  }

  const result = spawnSync(process.execPath, [RUNNER, 'MCStopHook'], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, CHECK_RESULTS_PATH: '/dev/null' },
    timeout: 300000, // 5 min max for TLC
  });

  assert.strictEqual(
    result.status,
    0,
    'TLC must exit 0 (no violations). stderr: ' + (result.stderr || '') + ' stdout: ' + (result.stdout || '')
  );
});

test('model-registry.json has entry for .planning/formal/tla/NFStopHook.tla with update_source=manual', () => {
  assert.ok(fs.existsSync(REGISTRY), '.planning/formal/model-registry.json must exist');
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const entry = (registry.models || {})['.planning/formal/tla/NFStopHook.tla'];
  assert.ok(entry, 'model-registry.json must have an entry for .planning/formal/tla/NFStopHook.tla');
  assert.strictEqual(entry.update_source, 'manual', 'update_source must be "manual"');
  assert.ok(entry.description && entry.description.includes('SPEC-01'), 'description must reference SPEC-01');
});
