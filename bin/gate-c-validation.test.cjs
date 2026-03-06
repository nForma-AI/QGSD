#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { computeGateC } = require('./gate-c-validation.cjs');

// ── Fixtures ─────────────────────────────────────────────────────────────

const fm1 = { id: 'FM-A', state: 'IDLE', event: 'START', failure_mode: 'omission', severity_class: 'degraded' };
const fm2 = { id: 'FM-B', state: 'IDLE', event: 'STOP', failure_mode: 'commission', severity_class: 'model_gap' };
const fm3 = { id: 'FM-C', state: 'RUN', event: 'HALT', failure_mode: 'corruption', severity_class: 'critical' };

const recipe1 = { id: 'TR-FM-A', failure_mode_id: 'FM-A' };
const recipe2 = { id: 'TR-FM-B', failure_mode_id: 'FM-B' };
const recipe3 = { id: 'TR-FM-C', failure_mode_id: 'FM-C' };

// ── Tests ────────────────────────────────────────────────────────────────

describe('gate-c-validation', () => {

  describe('score computation', () => {
    it('computes score 1.0 when all failure modes have recipes', () => {
      const result = computeGateC([fm1, fm2, fm3], [recipe1, recipe2, recipe3]);
      assert.equal(result.gate_c_score, 1);
      assert.equal(result.validated_entries, 3);
      assert.equal(result.unvalidated_entries, 0);
      assert.equal(result.target_met, true);
    });

    it('computes partial score when some failure modes lack recipes', () => {
      const result = computeGateC([fm1, fm2, fm3], [recipe1]);
      assert.ok(result.gate_c_score < 1);
      assert.equal(result.gate_c_score, Math.round((1 / 3) * 10000) / 10000);
      assert.equal(result.validated_entries, 1);
      assert.equal(result.unvalidated_entries, 2);
    });
  });

  describe('gap detection', () => {
    it('identifies unmatched failure modes in gaps array', () => {
      const result = computeGateC([fm1, fm2, fm3], [recipe1]);
      assert.equal(result.gaps.length, 2);
      const gapIds = result.gaps.map(g => g.failure_mode_id);
      assert.ok(gapIds.includes('FM-B'));
      assert.ok(gapIds.includes('FM-C'));
    });

    it('includes state, event, failure_mode, severity_class in gap entries', () => {
      const result = computeGateC([fm1, fm2], [recipe1]);
      const gap = result.gaps[0];
      assert.equal(gap.failure_mode_id, 'FM-B');
      assert.equal(gap.state, 'IDLE');
      assert.equal(gap.event, 'STOP');
      assert.equal(gap.failure_mode, 'commission');
      assert.equal(gap.severity_class, 'model_gap');
    });
  });

  describe('target_met logic', () => {
    it('target_met true when score >= 0.8', () => {
      // 4 out of 5 = 0.8
      const fms = [fm1, fm2, fm3, { id: 'FM-D', state: 'X', event: 'Y', failure_mode: 'omission', severity_class: 'low' }, { id: 'FM-E', state: 'X', event: 'Z', failure_mode: 'omission', severity_class: 'low' }];
      const recipes = [recipe1, recipe2, recipe3, { id: 'TR-FM-D', failure_mode_id: 'FM-D' }];
      const result = computeGateC(fms, recipes);
      assert.equal(result.target_met, true);
      assert.equal(result.gate_c_score, 0.8);
    });

    it('target_met false when score < 0.8', () => {
      // 1 out of 3 = 0.3333
      const result = computeGateC([fm1, fm2, fm3], [recipe1]);
      assert.equal(result.target_met, false);
    });
  });

  describe('empty inputs', () => {
    it('0 failure modes returns score 0, target not met', () => {
      const result = computeGateC([], []);
      assert.equal(result.gate_c_score, 0);
      assert.equal(result.total_entries, 0);
      assert.equal(result.target_met, false);
      assert.deepEqual(result.gaps, []);
    });

    it('failure modes with 0 recipes returns score 0', () => {
      const result = computeGateC([fm1, fm2], []);
      assert.equal(result.gate_c_score, 0);
      assert.equal(result.unvalidated_entries, 2);
      assert.equal(result.target_met, false);
    });
  });

  describe('integration: real artifacts', () => {
    it('reads real test-recipes.json and failure-mode-catalog.json, verifies score = 1.0', () => {
      const ROOT = path.join(__dirname, '..');
      const fmPath = path.join(ROOT, '.planning', 'formal', 'reasoning', 'failure-mode-catalog.json');
      const trPath = path.join(ROOT, '.planning', 'formal', 'test-recipes', 'test-recipes.json');

      const fmData = JSON.parse(fs.readFileSync(fmPath, 'utf8'));
      const trData = JSON.parse(fs.readFileSync(trPath, 'utf8'));

      const result = computeGateC(fmData.failure_modes, trData.recipes);

      assert.equal(result.gate_c_score, 1);
      assert.equal(result.validated_entries, fmData.failure_modes.length);
      assert.equal(result.unvalidated_entries, 0);
      assert.equal(result.gaps.length, 0);
      assert.equal(result.target_met, true);
    });
  });

  describe('check-result emission', () => {
    it('computeGateC result includes formalism-compatible fields for gate-c', () => {
      // The computeGateC function returns data; check-result emission happens in main().
      // Verify the shape is correct for downstream consumption.
      const result = computeGateC([fm1], [recipe1]);
      assert.equal(result.schema_version, '1');
      assert.ok(result.generated);
      assert.equal(typeof result.gate_c_score, 'number');
      assert.equal(typeof result.target, 'number');
      assert.equal(typeof result.target_met, 'boolean');
    });
  });
});
