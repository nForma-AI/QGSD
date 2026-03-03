#!/usr/bin/env node
'use strict';
// bin/self-healing.test.cjs
// TDD RED test scaffolding for HEAL-01: Early escalation via consensus probability gate.
// Requirements: HEAL-01
//
// These tests define the behavioral contract for computeEarlyEscalation and
// readEarlyEscalationThreshold before implementation begins. All tests are
// RED initially (functions do not exist yet in quorum-consensus-gate.cjs).
//
// Run: node --test bin/self-healing.test.cjs

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Fail-open guard: if quorum-consensus-gate.cjs is temporarily unavailable, tests
// continue gracefully instead of crashing.
let mod = null;
try {
  mod = require('./quorum-consensus-gate.cjs');
} catch (e) {
  // Module not yet exported the HEAL-01 functions; that's ok for RED phase.
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-healing-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Group 1: computeEarlyEscalation tests ───────────────────────────────────

describe('computeEarlyEscalation(slotRates, minQuorum, remainingRounds, threshold)', () => {
  test('Module exports computeEarlyEscalation', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.computeEarlyEscalation === 'function', 'computeEarlyEscalation not exported');
  });

  test('returns { shouldEscalate: true, probability, threshold } when P(consensus | remainingRounds) < threshold (0.10)', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.computeEarlyEscalation === 'function', 'computeEarlyEscalation not exported');

    // Use known slot rates where P is very low (all rates = 0.1, minQuorum = 3, remainingRounds = 1)
    // P(X >= 3 | n=4, all p=0.1) ~ 0.0037 << 0.10 threshold → should escalate
    const slotRates = { slot1: 0.1, slot2: 0.1, slot3: 0.1, slot4: 0.1 };
    const result = mod.computeEarlyEscalation(slotRates, 3, 1, 0.10);

    assert.ok(result, 'Should return an object');
    assert.strictEqual(result.shouldEscalate, true, 'shouldEscalate should be true when P < threshold');
    assert.ok(typeof result.probability === 'number', 'probability should be a number');
    assert.ok(result.probability < 0.10, 'probability should be < 0.10 threshold');
    assert.ok(typeof result.threshold === 'number', 'threshold should be present in result');
  });

  test('returns { shouldEscalate: false, probability, threshold } when P(consensus | remainingRounds) >= threshold', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.computeEarlyEscalation === 'function', 'computeEarlyEscalation not exported');

    // Use known slot rates where P is high (all rates = 0.9, minQuorum = 2, remainingRounds = 5)
    // P(X >= 2 | n=4, all p=0.9) ~ 0.9963 >> 0.10 threshold → should NOT escalate
    const slotRates = { slot1: 0.9, slot2: 0.9, slot3: 0.9, slot4: 0.9 };
    const result = mod.computeEarlyEscalation(slotRates, 2, 5, 0.10);

    assert.ok(result, 'Should return an object');
    assert.strictEqual(result.shouldEscalate, false, 'shouldEscalate should be false when P >= threshold');
    assert.ok(typeof result.probability === 'number', 'probability should be a number');
    assert.ok(result.probability >= 0.10, 'probability should be >= 0.10 threshold');
    assert.ok(typeof result.threshold === 'number', 'threshold should be present in result');
  });

  test('remainingRounds correctly influences probability (more remaining = higher P)', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.computeEarlyEscalation === 'function', 'computeEarlyEscalation not exported');

    const slotRates = { slot1: 0.7, slot2: 0.7, slot3: 0.7, slot4: 0.7 };

    // With remainingRounds = 1: fewer chances to achieve consensus → lower P
    const result1 = mod.computeEarlyEscalation(slotRates, 2, 1, 0.10);
    const p1 = result1.probability;

    // With remainingRounds = 5: more chances to achieve consensus → higher P
    const result5 = mod.computeEarlyEscalation(slotRates, 2, 5, 0.10);
    const p5 = result5.probability;

    assert.ok(p5 > p1, 'P(consensus | 5 remaining) should be > P(consensus | 1 remaining)');
  });

  test('threshold parameter is respected (0.10 default, but accepts 0.50 for aggressive escalation)', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.computeEarlyEscalation === 'function', 'computeEarlyEscalation not exported');

    const slotRates = { slot1: 0.5, slot2: 0.5, slot3: 0.5, slot4: 0.5 };

    // With threshold = 0.50: aggressive escalation
    const result50 = mod.computeEarlyEscalation(slotRates, 2, 2, 0.50);

    // With threshold = 0.01: permissive escalation
    const result01 = mod.computeEarlyEscalation(slotRates, 2, 2, 0.01);

    // If probability is between 0.01 and 0.50, result50.shouldEscalate may differ from result01.shouldEscalate
    // At least one of them must differ in escalation decision, or both have same decision
    // but they should both respect their own thresholds
    assert.strictEqual(
      result50.shouldEscalate,
      result50.probability < 0.50,
      'threshold = 0.50 should be respected'
    );
    assert.strictEqual(
      result01.shouldEscalate,
      result01.probability < 0.01,
      'threshold = 0.01 should be respected'
    );
  });

  test('returns shouldEscalate: true when remainingRounds = 0 and no consensus achieved', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.computeEarlyEscalation === 'function', 'computeEarlyEscalation not exported');

    // With remainingRounds = 0, no more chances to achieve consensus
    const slotRates = { slot1: 0.8, slot2: 0.8, slot3: 0.8, slot4: 0.8 };
    const result = mod.computeEarlyEscalation(slotRates, 3, 0, 0.10);

    // P(X >= 3) with 0 remaining rounds should be 0.0 (no more chances)
    assert.strictEqual(result.shouldEscalate, true, 'Should escalate when no remaining rounds');
    assert.ok(result.probability === 0 || result.probability < 0.10, 'Probability should be 0 or very low');
  });
});

// ─── Group 2: readEarlyEscalationThreshold tests ──────────────────────────────

describe('readEarlyEscalationThreshold(configPaths)', () => {
  test('Module exports readEarlyEscalationThreshold', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.readEarlyEscalationThreshold === 'function', 'readEarlyEscalationThreshold not exported');
  });

  test('returns 0.10 when no config files exist (default)', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.readEarlyEscalationThreshold === 'function', 'readEarlyEscalationThreshold not exported');

    const configPaths = [
      path.join(tmpDir, 'config-nonexistent.json'),
      path.join(tmpDir, 'another-nonexistent.json'),
    ];
    const result = mod.readEarlyEscalationThreshold(configPaths);

    assert.strictEqual(result, 0.10, 'Should return default 0.10 when no configs exist');
  });

  test('reads workflow.early_escalation_threshold from .planning/config.json if present', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.readEarlyEscalationThreshold === 'function', 'readEarlyEscalationThreshold not exported');

    const confDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(confDir, { recursive: true });
    const configPath = path.join(confDir, 'config.json');

    fs.writeFileSync(configPath, JSON.stringify({
      workflow: { early_escalation_threshold: 0.25 },
    }), 'utf8');

    const configPaths = [configPath];
    const result = mod.readEarlyEscalationThreshold(configPaths);

    assert.strictEqual(result, 0.25, 'Should read 0.25 from config.json');
  });

  test('invalid threshold (negative, > 1.0) falls back to default 0.10', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.readEarlyEscalationThreshold === 'function', 'readEarlyEscalationThreshold not exported');

    const confDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(confDir, { recursive: true });

    // Test negative threshold
    let configPath = path.join(confDir, 'config1.json');
    fs.writeFileSync(configPath, JSON.stringify({
      workflow: { early_escalation_threshold: -0.5 },
    }), 'utf8');
    let result = mod.readEarlyEscalationThreshold([configPath]);
    assert.strictEqual(result, 0.10, 'Should fall back to 0.10 for negative threshold');

    // Test threshold > 1.0
    configPath = path.join(confDir, 'config2.json');
    fs.writeFileSync(configPath, JSON.stringify({
      workflow: { early_escalation_threshold: 1.5 },
    }), 'utf8');
    result = mod.readEarlyEscalationThreshold([configPath]);
    assert.strictEqual(result, 0.10, 'Should fall back to 0.10 for threshold > 1.0');
  });

  test('fail-open on JSON parse error returns 0.10', () => {
    assert.ok(mod, 'Module not loaded');
    assert.ok(typeof mod.readEarlyEscalationThreshold === 'function', 'readEarlyEscalationThreshold not exported');

    const confDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(confDir, { recursive: true });
    const configPath = path.join(confDir, 'config-malformed.json');

    // Write invalid JSON
    fs.writeFileSync(configPath, '{ invalid json content', 'utf8');

    const result = mod.readEarlyEscalationThreshold([configPath]);
    assert.strictEqual(result, 0.10, 'Should fall back to 0.10 on JSON parse error');
  });
});
