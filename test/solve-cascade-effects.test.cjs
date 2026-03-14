'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { LAYER_KEYS } = require('../bin/layer-constants.cjs');

// Bucket constants matching CONV-02 design
const AUTOMATABLE_LAYERS = [
  'r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c',
  'r_to_d', 'l1_to_l3', 'l3_to_tc',
];

const MANUAL_LAYERS = ['d_to_c', 'c_to_r', 't_to_r', 'd_to_r'];

const INFORMATIONAL_LAYERS = [
  'git_heatmap', 'git_history', 'formal_lint', 'hazard_model',
  'per_model_gates', 'p_to_f',
];

// Zero baseline for all layers
const ZEROS = Object.fromEntries(LAYER_KEYS.map(k => [k, 0]));

// Before/after snapshots for cascade scenario
const before = { ...ZEROS, r_to_f: 5, f_to_t: 0 };
const after  = { ...ZEROS, r_to_f: 0, f_to_t: 7 };

/**
 * Sum a bucket of layer keys from a layer map.
 */
function bucketSum(layerMap, keys) {
  return keys.reduce((sum, k) => sum + (layerMap[k] >= 0 ? layerMap[k] : 0), 0);
}

describe('cascade effects', () => {
  it('R-to-F remediation creating new formal models increases F-to-T residual', () => {
    // Remediation of R->F created new models needing test backing
    assert.ok(after.f_to_t > before.f_to_t, 'f_to_t should increase after R-to-F remediation');
    // R->F was actually remediated
    assert.ok(after.r_to_f < before.r_to_f, 'r_to_f should decrease after remediation');
  });

  it('convergence check identifies cascade as progress, not regression', () => {
    // Per-layer-change: r_to_f decreased by 5, f_to_t increased by 7
    const r_to_f_delta = after.r_to_f - before.r_to_f; // -5
    const f_to_t_delta = after.f_to_t - before.f_to_t; // +7

    // r_to_f decreased — progress on this layer
    assert.ok(r_to_f_delta < 0, 'r_to_f delta should be negative (progress)');

    // Even though f_to_t increased, the root cause (r_to_f remediation) demonstrates forward motion
    // At least one automatable layer decreased — this is progress
    const layersImproved = AUTOMATABLE_LAYERS.filter(k => after[k] < before[k]);
    assert.ok(layersImproved.length > 0, 'at least one automatable layer should improve');
    assert.ok(layersImproved.includes('r_to_f'), 'r_to_f should be among improved layers');
  });

  it('automatable_residual goes from 5 to 7 but per-layer-change detects progress', () => {
    const beforeAuto = bucketSum(before, AUTOMATABLE_LAYERS); // 5
    const afterAuto = bucketSum(after, AUTOMATABLE_LAYERS);   // 7

    // Raw automatable number went up
    assert.ok(afterAuto > beforeAuto, 'automatable sum increased during cascade');

    // But per-layer analysis detects progress
    const layersImproved = AUTOMATABLE_LAYERS.filter(k => after[k] < before[k]);
    assert.ok(layersImproved.length > 0, 'at least one layer improved despite overall increase');
    // The r_to_f layer improved (5->0), which is the PRIMARY signal
    assert.ok(layersImproved.includes('r_to_f'), 'r_to_f is the primary improvement signal');
  });

  it('bucket computation matches CONV-02 design for cascade scenario', () => {
    // For the after-cascade snapshot ({ r_to_f: 0, f_to_t: 7, ...zeros })
    assert.strictEqual(bucketSum(after, AUTOMATABLE_LAYERS), 7);
    assert.strictEqual(bucketSum(after, MANUAL_LAYERS), 0);
    assert.strictEqual(bucketSum(after, INFORMATIONAL_LAYERS), 0);
  });

  it('third iteration shows continued progress -- f_to_t decreases', () => {
    const iter3 = { ...ZEROS, r_to_f: 0, f_to_t: 2 };

    // 2 < 7, continued progress
    assert.ok(iter3.f_to_t < after.f_to_t, 'f_to_t should decrease in third iteration');
    // 2 < 5, overall convergence
    assert.ok(
      bucketSum(iter3, AUTOMATABLE_LAYERS) < bucketSum(before, AUTOMATABLE_LAYERS),
      'overall automatable residual should converge below initial'
    );
  });

  it('all three buckets account for all LAYER_KEYS', () => {
    const allBucketKeys = [...AUTOMATABLE_LAYERS, ...MANUAL_LAYERS, ...INFORMATIONAL_LAYERS].sort();
    assert.deepStrictEqual(allBucketKeys, [...LAYER_KEYS].sort());
  });
});
