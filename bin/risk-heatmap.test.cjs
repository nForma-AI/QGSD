#!/usr/bin/env node
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { computeRiskScore, classifyRiskTier, generateRiskHeatmap } = require('./risk-heatmap.cjs');

// ── Unit tests: computeRiskScore ────────────────────────────────────────────

describe('computeRiskScore', () => {
  it('returns RPN * 1.0 when no coverage gap', () => {
    assert.strictEqual(computeRiskScore(120, false), 120);
  });

  it('returns RPN * 1.5 when coverage gap exists', () => {
    assert.strictEqual(computeRiskScore(120, true), 180);
  });

  it('returns 0 for zero RPN', () => {
    assert.strictEqual(computeRiskScore(0, false), 0);
    assert.strictEqual(computeRiskScore(0, true), 0);
  });
});

// ── Unit tests: classifyRiskTier ────────────────────────────────────────────

describe('classifyRiskTier', () => {
  it('returns critical for risk_score >= 200', () => {
    assert.strictEqual(classifyRiskTier(200), 'critical');
    assert.strictEqual(classifyRiskTier(500), 'critical');
  });

  it('returns high for 100 <= risk_score < 200', () => {
    assert.strictEqual(classifyRiskTier(100), 'high');
    assert.strictEqual(classifyRiskTier(199), 'high');
  });

  it('returns medium for 40 <= risk_score < 100', () => {
    assert.strictEqual(classifyRiskTier(40), 'medium');
    assert.strictEqual(classifyRiskTier(99), 'medium');
  });

  it('returns low for risk_score < 40', () => {
    assert.strictEqual(classifyRiskTier(0), 'low');
    assert.strictEqual(classifyRiskTier(39), 'low');
  });
});

// ── Integration tests with real data ────────────────────────────────────────

describe('integration: real data', () => {
  const ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
  const FORMAL = path.join(ROOT, '.planning', 'formal');

  let result;

  before(() => {
    const hazardPath = path.join(FORMAL, 'reasoning', 'hazard-model.json');
    const fsmPath = path.join(FORMAL, 'semantics', 'observed-fsm.json');

    const hazardModel = JSON.parse(fs.readFileSync(hazardPath, 'utf8'));
    const observedFsm = JSON.parse(fs.readFileSync(fsmPath, 'utf8'));

    result = generateRiskHeatmap(hazardModel, observedFsm);
  });

  it('produces 16 entries (one per hazard)', () => {
    assert.strictEqual(result.transitions.length, 16);
  });

  it('entries sorted by risk_score descending', () => {
    for (let i = 1; i < result.transitions.length; i++) {
      assert.ok(
        result.transitions[i - 1].risk_score >= result.transitions[i].risk_score,
        `${result.transitions[i - 1].state}-${result.transitions[i - 1].event} (${result.transitions[i - 1].risk_score}) should >= ${result.transitions[i].state}-${result.transitions[i].event} (${result.transitions[i].risk_score})`
      );
    }
  });

  it('transitions in missing_in_model have coverage_gap=true', () => {
    // Known missing_in_model transitions
    const missingKeys = new Set([
      'IDLE-DECIDE', 'IDLE-VOTES_COLLECTED',
      'COLLECTING_VOTES-QUORUM_START', 'COLLECTING_VOTES-CIRCUIT_BREAK', 'COLLECTING_VOTES-DECIDE',
      'DELIBERATING-QUORUM_START', 'DELIBERATING-CIRCUIT_BREAK',
      'DECIDED-DECIDE', 'DECIDED-CIRCUIT_BREAK', 'DECIDED-QUORUM_START', 'DECIDED-VOTES_COLLECTED',
    ]);

    for (const t of result.transitions) {
      const key = `${t.state}-${t.event}`;
      if (missingKeys.has(key)) {
        assert.strictEqual(t.coverage_gap, true, `${key} should have coverage_gap=true`);
        assert.strictEqual(t.coverage_gap_penalty, 0.5, `${key} should have penalty 0.5`);
      } else {
        assert.strictEqual(t.coverage_gap, false, `${key} should have coverage_gap=false`);
        assert.strictEqual(t.coverage_gap_penalty, 0.0, `${key} should have penalty 0.0`);
      }
    }
  });

  it('no risk_score exceeds 1500 (max RPN 1000 * 1.5)', () => {
    for (const t of result.transitions) {
      assert.ok(t.risk_score <= 1500, `${t.state}-${t.event} has risk_score ${t.risk_score} > 1500`);
    }
  });

  it('all entries have derived_from links', () => {
    for (const t of result.transitions) {
      assert.ok(Array.isArray(t.derived_from), `Missing derived_from`);
      assert.ok(t.derived_from.length > 0, `Empty derived_from`);
    }
  });

  it('has valid schema fields', () => {
    assert.strictEqual(result.schema_version, '1');
    assert.ok(result.generated);
    assert.ok(result.formula);
    assert.ok(result.summary);
    assert.strictEqual(typeof result.summary.total, 'number');
    assert.ok(result.summary.by_risk_tier);
    assert.strictEqual(typeof result.summary.coverage_gap_count, 'number');
  });
});
