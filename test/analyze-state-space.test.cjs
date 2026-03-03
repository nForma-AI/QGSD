'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'bin', 'analyze-state-space.cjs');
const REPORT_PATH = path.join(__dirname, '..', '.formal', 'state-space-report.json');

/**
 * Run analyze-state-space.cjs with given args and return { stdout, stderr, status }.
 */
function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
    timeout: 30000,
  });
}

/**
 * Run with --json and parse the result.
 */
let _cachedReport = null;
function getReport() {
  if (_cachedReport) return _cachedReport;
  const result = run('--json');
  assert.strictEqual(result.status, 0, 'analyze-state-space.cjs should exit 0, stderr: ' + result.stderr);
  _cachedReport = JSON.parse(result.stdout);
  return _cachedReport;
}

// ── Basic Execution ─────────────────────────────────────────────────────────

describe('basic execution', () => {
  test('exits with code 0 and produces valid JSON', () => {
    const result = run('--json');
    assert.strictEqual(result.status, 0, 'Expected exit code 0, got ' + result.status + '. stderr: ' + result.stderr);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, 'stdout should be valid JSON');
    assert.ok(parsed, 'Parsed JSON should be truthy');
  });

  test('prints summary to stdout in default mode', () => {
    const result = run();
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('[analyze-state-space]'), 'stdout should include TAG prefix');
    assert.ok(result.stdout.includes('Analyzed'), 'stdout should include "Analyzed"');
    assert.ok(result.stdout.includes('MINIMAL:'), 'stdout should include risk breakdown');
  });
});

// ── Report Structure ────────────────────────────────────────────────────────

describe('report structure', () => {
  test('has top-level keys: metadata, models, summary', () => {
    const report = getReport();
    assert.ok(report.metadata, 'report should have metadata');
    assert.ok(report.models, 'report should have models');
    assert.ok(report.summary, 'report should have summary');
  });

  test('metadata has required fields', () => {
    const meta = getReport().metadata;
    assert.ok(meta.generated_at, 'metadata should have generated_at');
    assert.strictEqual(meta.generator, 'analyze-state-space', 'generator should be analyze-state-space');
    assert.strictEqual(meta.version, '1.0', 'version should be 1.0');
    assert.ok(meta.thresholds, 'metadata should have thresholds');
    assert.strictEqual(typeof meta.thresholds.MINIMAL, 'number');
    assert.strictEqual(typeof meta.thresholds.LOW, 'number');
    assert.strictEqual(typeof meta.thresholds.MODERATE, 'number');
  });

  test('summary has required fields', () => {
    const summary = getReport().summary;
    assert.strictEqual(typeof summary.total_models, 'number');
    assert.ok(summary.by_risk, 'summary should have by_risk');
    assert.strictEqual(typeof summary.unbounded_count, 'number');
    assert.strictEqual(typeof summary.models_without_cfg, 'number');
  });
});

// ── Risk Classification ─────────────────────────────────────────────────────

describe('risk classification', () => {
  test('QGSDQuorum_xstate.tla is HIGH risk', () => {
    const models = getReport().models;
    const xstate = models['.formal/tla/QGSDQuorum_xstate.tla'];
    assert.ok(xstate, 'QGSDQuorum_xstate.tla should be in models');
    assert.strictEqual(xstate.risk_level, 'HIGH', 'xstate should be HIGH risk');
    assert.strictEqual(xstate.has_unbounded, true, 'xstate should have unbounded domains');
    assert.ok(xstate.unbounded_domains.length > 0, 'xstate should have non-empty unbounded_domains');
    // Check that at least one unbounded domain mentions Nat
    const hasNat = xstate.unbounded_domains.some(function(d) { return d.includes('Nat'); });
    assert.ok(hasNat, 'xstate unbounded_domains should mention Nat');
  });

  test('all models have required fields', () => {
    const models = getReport().models;
    const validRisks = ['MINIMAL', 'LOW', 'MODERATE', 'HIGH'];
    for (const [file, model] of Object.entries(models)) {
      assert.strictEqual(typeof model.module_name, 'string', file + ' should have module_name string');
      assert.ok(Array.isArray(model.variables), file + ' should have variables array');
      assert.ok(validRisks.includes(model.risk_level), file + ' should have valid risk_level, got: ' + model.risk_level);
      assert.strictEqual(typeof model.has_unbounded, 'boolean', file + ' should have boolean has_unbounded');
    }
  });

  test('risk distribution sums to total_models', () => {
    const summary = getReport().summary;
    const sum = summary.by_risk.MINIMAL + summary.by_risk.LOW + summary.by_risk.MODERATE + summary.by_risk.HIGH;
    assert.strictEqual(sum, summary.total_models, 'Risk distribution should sum to total_models');
  });

  test('unbounded_count matches models with has_unbounded === true', () => {
    const report = getReport();
    let count = 0;
    for (const model of Object.values(report.models)) {
      if (model.has_unbounded) count++;
    }
    assert.strictEqual(count, report.summary.unbounded_count, 'unbounded_count should match actual count');
  });

  test('bounded models have positive estimated_states', () => {
    const models = getReport().models;
    for (const [file, model] of Object.entries(models)) {
      if (!model.has_unbounded && model.estimated_states !== null) {
        assert.ok(model.estimated_states > 0, file + ' should have positive estimated_states when bounded and resolvable');
      }
    }
  });
});

// ── Constant Parsing ────────────────────────────────────────────────────────

describe('constant parsing', () => {
  test('model with .cfg CONSTANTS has parsed constants', () => {
    const models = getReport().models;
    // QGSDQuorum.tla uses MCsafety.cfg which has MaxDeliberation=9, MaxSize=3
    const quorum = models['.formal/tla/QGSDQuorum.tla'];
    if (quorum && quorum.constants && quorum.constants.length > 0) {
      // At least one constant should have a numeric value
      const hasNumeric = quorum.constants.some(function(c) { return typeof c.value === 'number'; });
      assert.ok(hasNumeric, 'QGSDQuorum constants should include numeric values from .cfg');
    }
  });

  test('models with bounded ranges have finite estimated_states', () => {
    const models = getReport().models;
    // QGSDCircuitBreaker has 2 BOOLEAN vars = 4 states
    const breaker = models['.formal/tla/QGSDCircuitBreaker.tla'];
    if (breaker) {
      assert.strictEqual(breaker.risk_level, 'MINIMAL', 'QGSDCircuitBreaker should be MINIMAL risk');
      assert.ok(breaker.estimated_states !== null && breaker.estimated_states > 0,
        'QGSDCircuitBreaker should have computable states');
    }
  });
});

// ── CLI Modes ───────────────────────────────────────────────────────────────

describe('CLI modes', () => {
  test('--quiet mode suppresses stdout', () => {
    const result = run('--quiet');
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout.trim(), '', '--quiet should produce no stdout');
  });

  test('file write mode creates report file', () => {
    // Remove existing report if any
    if (fs.existsSync(REPORT_PATH)) {
      fs.unlinkSync(REPORT_PATH);
    }
    const result = run();
    assert.strictEqual(result.status, 0);
    assert.ok(fs.existsSync(REPORT_PATH), 'state-space-report.json should exist after default run');
    const content = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    assert.ok(content.models, 'Written report should have models');
    assert.ok(content.summary, 'Written report should have summary');
  });

  test('--json mode outputs to stdout only', () => {
    // Remove report file first
    if (fs.existsSync(REPORT_PATH)) {
      fs.unlinkSync(REPORT_PATH);
    }
    const result = run('--json');
    assert.strictEqual(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.models, '--json output should have models');
    // In --json mode, file should NOT be written
    assert.ok(!fs.existsSync(REPORT_PATH), '--json should not write report file');
  });
});
