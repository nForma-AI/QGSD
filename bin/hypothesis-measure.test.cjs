#!/usr/bin/env node
'use strict';
// bin/hypothesis-measure.test.cjs
// Unit tests for hypothesis-measure.cjs
// @req H2M-01

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { compareAssumption, extractFormalValue, loadActualData } = require('./hypothesis-measure.cjs')._pure;

// ── compareAssumption tests (@req H2M-01) ────────────────────────────────────

// @requirement H2M-01
test('@req H2M-01: compareAssumption returns CONFIRMED when actual matches formal value', () => {
  const metric = { assumption_name: 'MaxDeliberationRounds' };
  const formalValue = 10;
  const actualData = {
    conformance: { maxRounds: 9, maxIterations: 0, totalTransitions: 100 },
    scoreboard: null,
    telemetry: null,
    circuitBreaker: null,
  };

  const result = compareAssumption(metric, formalValue, actualData);

  assert.strictEqual(result.verdict, 'CONFIRMED');
  assert.strictEqual(result.actual_value, 9);
  assert.strictEqual(result.actual_source, 'conformance-events.jsonl');
});

// @requirement H2M-01
test('@req H2M-01: compareAssumption returns VIOLATED when actual exceeds formal value', () => {
  const metric = { assumption_name: 'MaxDeliberationRounds' };
  const formalValue = 5;
  const actualData = {
    conformance: { maxRounds: 15, maxIterations: 0, totalTransitions: 100 },
    scoreboard: null,
    telemetry: null,
    circuitBreaker: null,
  };

  const result = compareAssumption(metric, formalValue, actualData);

  assert.strictEqual(result.verdict, 'VIOLATED');
  assert.strictEqual(result.actual_value, 15);
  assert.ok(result.reason, 'VIOLATED should have a reason');
});

// @requirement H2M-01
test('@req H2M-01: compareAssumption returns UNMEASURABLE when no actual data matches', () => {
  const metric = { assumption_name: 'UnknownMetric' };
  const formalValue = 42;
  const actualData = {
    conformance: null,
    scoreboard: null,
    telemetry: null,
    circuitBreaker: null,
  };

  const result = compareAssumption(metric, formalValue, actualData);

  assert.strictEqual(result.verdict, 'UNMEASURABLE');
  assert.strictEqual(result.actual_value, null);
});

// @requirement H2M-01
test('@req H2M-01: compareAssumption returns UNMEASURABLE when formal value is null', () => {
  const metric = { assumption_name: 'MaxDeliberationRounds' };
  const actualData = {
    conformance: { maxRounds: 5, maxIterations: 0, totalTransitions: 100 },
    scoreboard: null,
    telemetry: null,
    circuitBreaker: null,
  };

  const result = compareAssumption(metric, null, actualData);

  assert.strictEqual(result.verdict, 'UNMEASURABLE');
  assert.ok(result.reason.includes('formal value'), 'reason should mention formal value');
});

// @requirement H2M-01
test('@req H2M-01: compareAssumption matches scoreboard TP rate assumptions', () => {
  const metric = { assumption_name: 'tp_codex-1_rate' };
  const formalValue = 0.8;
  const actualData = {
    conformance: null,
    scoreboard: {
      slotRates: {
        'codex-1': { tpRate: 0.85, unavailRate: 0.1 },
      },
    },
    telemetry: null,
    circuitBreaker: null,
  };

  const result = compareAssumption(metric, formalValue, actualData);

  assert.strictEqual(result.verdict, 'CONFIRMED');
  assert.strictEqual(result.actual_value, 0.85);
  assert.strictEqual(result.actual_source, 'quorum-scoreboard.json');
});

// ── extractFormalValue tests (@req H2M-01) ───────────────────────────────────

// @requirement H2M-01
test('@req H2M-01: extractFormalValue returns null for non-existent file', () => {
  const result = extractFormalValue('/tmp/does-not-exist-12345.tla', 'MaxRounds');
  assert.strictEqual(result, null);
});

// ── Output format tests (@req H2M-01) ────────────────────────────────────────

// @requirement H2M-01
test('@req H2M-01: measurement results have required schema fields', () => {
  const metric = { assumption_name: 'MaxDeliberationRounds' };
  const formalValue = 10;
  const actualData = {
    conformance: { maxRounds: 9, maxIterations: 0, totalTransitions: 100 },
    scoreboard: null,
    telemetry: null,
    circuitBreaker: null,
  };

  const result = compareAssumption(metric, formalValue, actualData);

  // Required fields per hypothesis-measurements.json schema
  assert.ok('actual_value' in result, 'must have actual_value');
  assert.ok('actual_source' in result, 'must have actual_source');
  assert.ok('verdict' in result, 'must have verdict');
  assert.ok('reason' in result, 'must have reason');

  // Verdict must be one of the valid values
  assert.ok(
    ['CONFIRMED', 'VIOLATED', 'UNMEASURABLE'].includes(result.verdict),
    'verdict must be CONFIRMED, VIOLATED, or UNMEASURABLE'
  );
});
