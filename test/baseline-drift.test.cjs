'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectBaselineDrift } = require('../bin/baseline-drift.cjs');

describe('detectBaselineDrift', () => {
  it('returns no drift when baseline and current are identical', () => {
    const baseline = {
      r_to_f: { residual: 5 },
      f_to_t: { residual: 0 },
      t_to_c: { residual: 3 },
    };
    const current = {
      r_to_f: { residual: 5 },
      f_to_t: { residual: 0 },
      t_to_c: { residual: 3 },
    };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, false);
    assert.equal(result.layers.length, 0);
    assert.equal(result.warning, null);
  });

  it('detects drift when a layer changes >10%', () => {
    const baseline = { r_to_f: { residual: 10 } };
    const current = { r_to_f: { residual: 12 } };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, true);
    assert.equal(result.layers.length, 1);
    assert.equal(result.layers[0].layer, 'r_to_f');
    assert.equal(result.layers[0].baseline, 10);
    assert.equal(result.layers[0].current, 12);
    assert.equal(result.layers[0].pct_change, 20);
  });

  it('does not flag drift when change is exactly 10%', () => {
    const baseline = { r_to_f: { residual: 10 } };
    const current = { r_to_f: { residual: 11 } };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, false);
    assert.equal(result.layers.length, 0);
  });

  it('detects drift when baseline is 0 and current > 2', () => {
    const baseline = { r_to_f: { residual: 0 } };
    const current = { r_to_f: { residual: 5 } };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, true);
    assert.equal(result.layers.length, 1);
    assert.equal(result.layers[0].layer, 'r_to_f');
    assert.equal(result.layers[0].pct_change, null);
  });

  it('does not flag drift when baseline is 0 and current <= 2', () => {
    const baseline = { r_to_f: { residual: 0 } };
    const current = { r_to_f: { residual: 2 } };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, false);
    assert.equal(result.layers.length, 0);
  });

  it('skips missing layers (residual=-1)', () => {
    const baseline = { r_to_f: { residual: -1 }, f_to_t: { residual: 10 } };
    const current = { r_to_f: { residual: 50 }, f_to_t: { residual: -1 } };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, false);
    assert.equal(result.layers.length, 0);
  });

  it('skips layers missing from one snapshot', () => {
    const baseline = { r_to_f: { residual: 10 } };
    const current = {}; // r_to_f missing
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, false);
  });

  it('warning string includes layer names and percentages', () => {
    const baseline = { r_to_f: { residual: 10 } };
    const current = { r_to_f: { residual: 15 } };
    const result = detectBaselineDrift(baseline, current);
    assert.ok(result.warning);
    assert.ok(result.warning.includes('r_to_f'));
    assert.ok(result.warning.includes('50%'));
    assert.ok(result.warning.includes('Mid-session external edits'));
  });

  it('detects multiple layers drifting with correct count', () => {
    const baseline = {
      r_to_f: { residual: 10 },
      f_to_t: { residual: 20 },
      t_to_c: { residual: 5 },
    };
    const current = {
      r_to_f: { residual: 15 }, // 50% drift
      f_to_t: { residual: 25 }, // 25% drift
      t_to_c: { residual: 5 },  // no drift
    };
    const result = detectBaselineDrift(baseline, current);
    assert.equal(result.detected, true);
    assert.equal(result.layers.length, 2);
    assert.ok(result.warning.includes('2 layer(s)'));
  });

  it('detects requirement count change', () => {
    // Use a path that does not exist to test fail-open behavior for file read,
    // but test the logic by providing a baseline with requirement_count and a
    // valid (though non-existent) path. The fail-open means no change detected
    // when file is missing.
    const baseline = { requirement_count: 100 };
    const current = {};
    const result = detectBaselineDrift(baseline, current, {
      requirementsPath: '/tmp/nonexistent-requirements-test.json',
    });
    // File doesn't exist, so fail-open: no change detected
    assert.equal(result.requirement_count_changed, false);
  });

  it('detects requirement count change when file exists', () => {
    const fs = require('fs');
    const tmpPath = '/tmp/test-baseline-drift-reqs.json';
    fs.writeFileSync(tmpPath, JSON.stringify({ requirements: new Array(110) }));
    try {
      const baseline = { requirement_count: 100 };
      const current = {};
      const result = detectBaselineDrift(baseline, current, {
        requirementsPath: tmpPath,
      });
      assert.equal(result.requirement_count_changed, true);
      assert.equal(result.detected, true);
      assert.ok(result.warning.includes('Requirement count changed'));
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('uses custom threshold', () => {
    const baseline = { r_to_f: { residual: 10 } };
    const current = { r_to_f: { residual: 12 } }; // 20% change
    // With 25% threshold, this should NOT be flagged
    const result = detectBaselineDrift(baseline, current, { threshold: 0.25 });
    assert.equal(result.detected, false);
    assert.equal(result.layers.length, 0);
  });
});
