#!/usr/bin/env node
'use strict';
// bin/qgsd-solve.test.cjs
// TDD test suite for bin/qgsd-solve.cjs
// Uses node:test + node:assert/strict
//
// Test categories:
// - TC-HEALTH: healthIndicator() tests
// - TC-FORMAT: formatReport() tests
// - TC-JSON: formatJSON() tests
// - TC-INT: Integration tests (full script)
// - TC-CONV: Convergence logic tests

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

// Import functions from qgsd-solve.cjs
const {
  healthIndicator,
  formatReport,
  formatJSON,
} = require('./qgsd-solve.cjs');

const ROOT = path.resolve(__dirname, '..');

// ── TC-HEALTH: Health Indicator Tests ────────────────────────────────────────

test('TC-HEALTH-1: healthIndicator(-1) returns UNKNOWN', () => {
  const result = healthIndicator(-1);
  assert.ok(result.includes('UNKNOWN'));
});

test('TC-HEALTH-2: healthIndicator(0) returns GREEN', () => {
  const result = healthIndicator(0);
  assert.ok(result.includes('GREEN'));
});

test('TC-HEALTH-3: healthIndicator(2) returns YELLOW', () => {
  const result = healthIndicator(2);
  assert.ok(result.includes('YELLOW'));
});

test('TC-HEALTH-4: healthIndicator(5) returns RED', () => {
  const result = healthIndicator(5);
  assert.ok(result.includes('RED'));
});

// ── TC-FORMAT: Report Formatting Tests ───────────────────────────────────────

test('TC-FORMAT-1: formatReport with converged=true, total=0', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, true);

  assert.ok(result.includes('converged'));
  assert.ok(result.includes('GREEN'));
});

test('TC-FORMAT-2: formatReport with converged=false, total=5', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 2, detail: { uncovered_requirements: ['REQ-001', 'REQ-002'] } },
        f_to_t: { residual: 1, detail: { gaps: ['REQ-003'] } },
        c_to_f: { residual: 1, detail: { mismatches: [] } },
        t_to_c: { residual: 1, detail: { failed: 1, total_tests: 10 } },
        f_to_c: { residual: 0, detail: {} },
        total: 5,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, false);

  assert.ok(result.includes('RED') || result.includes('YELLOW'));
});

test('TC-FORMAT-3: formatReport includes layer transition table', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, true);

  assert.ok(result.includes('Layer Transition'));
  assert.ok(result.includes('R -> F'));
  assert.ok(result.includes('F -> T'));
  assert.ok(result.includes('C -> F'));
  assert.ok(result.includes('T -> C'));
  assert.ok(result.includes('F -> C'));
});

// ── TC-JSON: JSON Formatting Tests ───────────────────────────────────────────

test('TC-JSON-1: formatJSON returns object with required keys', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.ok(typeof result === 'object');
  assert.ok(result.solver_version);
  assert.ok(result.generated_at);
  assert.ok(typeof result.iteration_count === 'number');
  assert.ok(typeof result.converged === 'boolean');
  assert.ok(result.residual_vector);
  assert.ok(result.health);
});

test('TC-JSON-2: formatJSON with all zero residuals has GREEN health', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.equal(result.converged, true);
  assert.equal(result.health.r_to_f, 'GREEN');
  assert.equal(result.health.f_to_t, 'GREEN');
  assert.equal(result.health.c_to_f, 'GREEN');
  assert.equal(result.health.t_to_c, 'GREEN');
  assert.equal(result.health.f_to_c, 'GREEN');
});

test('TC-JSON-3: formatJSON includes iterations array', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: ['action 1'],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.ok(Array.isArray(result.iterations));
  assert.equal(result.iterations.length, 1);
  assert.equal(result.iterations[0].iteration, 1);
  assert.ok(Array.isArray(result.iterations[0].actions));
});

// ── TC-INT: Integration Tests ────────────────────────────────────────────────

test('TC-INT-1: node bin/qgsd-solve.cjs --json --report-only exits with valid JSON', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--json',
    '--report-only',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
  });

  // Either exit 0 or 1 is acceptable (depends on project state)
  assert.ok(result.status === 0 || result.status === 1);

  // stdout should be valid JSON
  const output = result.stdout.trim();
  assert.ok(output.length > 0);

  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (err) {
    assert.fail('stdout is not valid JSON: ' + err.message);
  }

  assert.ok(parsed.residual_vector);
  assert.ok(typeof parsed.converged === 'boolean');
  assert.ok(typeof parsed.iteration_count === 'number');
});

test('TC-INT-2: node bin/qgsd-solve.cjs --report-only produces human-readable output', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--report-only',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
  });

  // Either exit 0 or 1 is acceptable
  assert.ok(result.status === 0 || result.status === 1);

  const output = result.stdout;
  // Should contain markers of human-readable format
  assert.ok(
    output.includes('qgsd-solve') ||
    output.includes('Layer Transition') ||
    output.includes('Residual')
  );
});

test('TC-INT-3: node bin/qgsd-solve.cjs --report-only --max-iterations=1 iterations count', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--json',
    '--report-only',
    '--max-iterations=1',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
  });

  assert.ok(result.status === 0 || result.status === 1);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.iteration_count, 1);
  } catch (err) {
    assert.fail('Failed to parse JSON: ' + err.message);
  }
});

test('TC-INT-4: node bin/qgsd-solve.cjs --json --report-only --verbose exits without crash', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--json',
    '--report-only',
    '--verbose',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
  });

  // Should not crash
  assert.ok(result.status === 0 || result.status === 1);

  // stdout should still be valid JSON even with --verbose
  try {
    JSON.parse(result.stdout.trim());
  } catch (err) {
    assert.fail('stdout is not valid JSON with --verbose: ' + err.message);
  }
});

// ── TC-CONV: Convergence Logic Tests ─────────────────────────────────────────

test('TC-CONV-1: --report-only mode does single iteration (iteration_count === 1)', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--json',
    '--report-only',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
  });

  assert.ok(result.status === 0 || result.status === 1);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.iteration_count, 1, '--report-only should do exactly 1 iteration');
  } catch (err) {
    assert.fail('Failed to parse JSON: ' + err.message);
  }
});

test('TC-CONV-2: --max-iterations limits iterations', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'qgsd-solve.cjs'),
    '--json',
    '--report-only',
    '--max-iterations=2',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
  });

  assert.ok(result.status === 0 || result.status === 1);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    // --report-only stops after 1 iteration regardless, so this should still be 1
    assert.ok(parsed.iteration_count <= 2);
  } catch (err) {
    assert.fail('Failed to parse JSON: ' + err.message);
  }
});
