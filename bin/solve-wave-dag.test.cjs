#!/usr/bin/env node
'use strict';
// bin/solve-wave-dag.test.cjs
// Tests for solve-wave-dag.cjs wave computation and priority weighting.
// Requirements: HTARGET-02

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

let mod;

describe('solve-wave-dag module', () => {
  before(() => {
    mod = require('./solve-wave-dag.cjs');
  });

  describe('Module exports', () => {
    it('exports computeWaves as a function', () => {
      assert.equal(typeof mod.computeWaves, 'function');
    });

    it('exports getLayerDeps as a function', () => {
      assert.equal(typeof mod.getLayerDeps, 'function');
    });

    it('exports LAYER_DEPS as an object', () => {
      assert.equal(typeof mod.LAYER_DEPS, 'object');
    });
  });

  describe('computeWaves — existing behavior (no priority weights)', () => {
    it('returns empty array for empty residual vector', () => {
      const result = mod.computeWaves({});
      assert.deepStrictEqual(result, []);
    });

    it('returns empty array when all residuals are 0', () => {
      const result = mod.computeWaves({ r_to_f: { residual: 0 }, r_to_d: { residual: 0 } });
      assert.deepStrictEqual(result, []);
    });

    it('root layers (no deps) appear in wave 1', () => {
      const result = mod.computeWaves({
        r_to_f: { residual: 1 },
        r_to_d: { residual: 1 },
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].wave, 1);
      assert.ok(result[0].layers.includes('r_to_f'));
      assert.ok(result[0].layers.includes('r_to_d'));
    });

    it('dependent layers appear after their dependencies (in wave or sequential order)', () => {
      // r_to_f and f_to_t may be compacted into a sequential wave
      // but f_to_t must appear AFTER r_to_f in the layers array
      const result = mod.computeWaves({
        r_to_f: { residual: 1 },
        r_to_d: { residual: 1 },  // another root to prevent compaction of wave 1
        f_to_t: { residual: 1 },  // depends on r_to_f
      });
      // r_to_f should be in a wave before f_to_t, or within a sequential wave
      // f_to_t should come after r_to_f in the layers array of its wave
      const r_to_f_wave = result.find(w => w.layers.includes('r_to_f'));
      const f_to_t_wave = result.find(w => w.layers.includes('f_to_t'));
      if (r_to_f_wave === f_to_t_wave) {
        // Compacted sequential wave — check order within layers array
        assert.ok(f_to_t_wave.sequential, 'must be sequential if in same wave');
        const rfIdx = f_to_t_wave.layers.indexOf('r_to_f');
        const ftIdx = f_to_t_wave.layers.indexOf('f_to_t');
        assert.ok(rfIdx < ftIdx, 'r_to_f must come before f_to_t in sequential wave');
      } else {
        assert.ok(r_to_f_wave.wave < f_to_t_wave.wave, 'r_to_f wave must be before f_to_t wave');
      }
    });

    it('MAX_PER_WAVE splits large wave groups', () => {
      // All root layers with residual > 0
      const residuals = {};
      for (const [key, deps] of Object.entries(mod.LAYER_DEPS)) {
        if (deps.length === 0) {
          residuals[key] = { residual: 1 };
        }
      }
      const result = mod.computeWaves(residuals);
      // Root layers: r_to_f, r_to_d, t_to_c, p_to_f, d_to_c, git_heatmap, h_to_m = 7 roots
      // With MAX_PER_WAVE=3, should split into 3 waves
      for (const w of result) {
        assert.ok(w.layers.length <= mod.MAX_PER_WAVE || w.sequential === true,
          `wave ${w.wave} has ${w.layers.length} layers without sequential flag`);
      }
    });

    it('sequential chain compaction merges consecutive single-layer waves', () => {
      // hazard_model -> l1_to_l3 -> l3_to_tc -> per_model_gates is a chain
      const result = mod.computeWaves({
        hazard_model: { residual: 1 },
        l1_to_l3: { residual: 1 },
        l3_to_tc: { residual: 1 },
        per_model_gates: { residual: 1 },
        // Need deps of hazard_model active too
        c_to_r: { residual: 1 },
        t_to_r: { residual: 1 },
        d_to_r: { residual: 1 },
        // And their deps
        r_to_f: { residual: 1 },
        r_to_d: { residual: 1 },
        f_to_t: { residual: 1 },
        t_to_c: { residual: 1 },
        c_to_f: { residual: 1 },
        f_to_c: { residual: 1 },
        d_to_c: { residual: 1 },
        git_heatmap: { residual: 1 },
        p_to_f: { residual: 1 },
      });
      // The trailing chain should be compacted into a sequential wave
      const seqWave = result.find(w => w.sequential === true);
      assert.ok(seqWave, 'should have at least one sequential wave');
    });
  });

  describe('computeWaves — priority weight behavior', () => {
    it('default (no priorityWeights param) produces same result as passing {}', () => {
      const residuals = { r_to_f: { residual: 1 }, r_to_d: { residual: 1 } };
      const defaultResult = mod.computeWaves(residuals);
      const emptyWeightResult = mod.computeWaves(residuals, {});
      assert.deepStrictEqual(defaultResult, emptyWeightResult);
    });

    it('layer with weight +1 appears before layer with weight 0 in same wave', () => {
      // r_to_f and r_to_d are both root layers (wave 1)
      const result = mod.computeWaves(
        { r_to_f: { residual: 1 }, r_to_d: { residual: 1 } },
        { r_to_d: 1 }  // boost r_to_d
      );
      assert.equal(result.length, 1);
      // r_to_d should come first (weight 1 > weight 0)
      assert.equal(result[0].layers[0], 'r_to_d');
      assert.equal(result[0].layers[1], 'r_to_f');
    });

    it('layer with weight +2 appears before layer with weight +1 in same wave', () => {
      const result = mod.computeWaves(
        { r_to_f: { residual: 1 }, r_to_d: { residual: 1 }, t_to_c: { residual: 1 } },
        { t_to_c: 2, r_to_f: 1 }  // t_to_c highest, r_to_f second, r_to_d default 0
      );
      const wave1 = result.find(w => w.layers.includes('t_to_c'));
      assert.ok(wave1);
      const tcIdx = wave1.layers.indexOf('t_to_c');
      const rfIdx = wave1.layers.indexOf('r_to_f');
      const rdIdx = wave1.layers.indexOf('r_to_d');
      assert.ok(tcIdx < rfIdx, 't_to_c (weight 2) should be before r_to_f (weight 1)');
      assert.ok(rfIdx < rdIdx, 'r_to_f (weight 1) should be before r_to_d (weight 0)');
    });

    it('priority weights do NOT change wave assignment (topology preserved)', () => {
      // f_to_t depends on r_to_f — must be in a later wave or after it in sequential order
      const result = mod.computeWaves(
        { r_to_f: { residual: 1 }, r_to_d: { residual: 1 }, f_to_t: { residual: 1 } },
        { f_to_t: 10 }  // high weight should not move f_to_t before r_to_f
      );
      const r_to_f_wave = result.find(w => w.layers.includes('r_to_f'));
      const f_to_t_wave = result.find(w => w.layers.includes('f_to_t'));
      if (r_to_f_wave === f_to_t_wave) {
        // Compacted sequential — f_to_t still after r_to_f
        const rfIdx = f_to_t_wave.layers.indexOf('r_to_f');
        const ftIdx = f_to_t_wave.layers.indexOf('f_to_t');
        assert.ok(rfIdx < ftIdx, 'f_to_t must still be after r_to_f in sequential wave');
      } else {
        assert.ok(r_to_f_wave.wave < f_to_t_wave.wave,
          'f_to_t must still be after r_to_f regardless of priority weight');
      }
    });

    it('priority weights only affect ordering within the same wave group', () => {
      const resultNoWeight = mod.computeWaves(
        { r_to_f: { residual: 1 }, f_to_t: { residual: 1 } }
      );
      const resultWithWeight = mod.computeWaves(
        { r_to_f: { residual: 1 }, f_to_t: { residual: 1 } },
        { f_to_t: 5 }
      );
      // Same number of waves
      assert.equal(resultNoWeight.length, resultWithWeight.length);
      // Same layers in each wave (just different order within)
      for (let i = 0; i < resultNoWeight.length; i++) {
        assert.deepStrictEqual(
          [...resultNoWeight[i].layers].sort(),
          [...resultWithWeight[i].layers].sort()
        );
      }
    });

    it('alphabetical tiebreaker preserved when weights are equal', () => {
      const result = mod.computeWaves(
        { r_to_f: { residual: 1 }, r_to_d: { residual: 1 }, p_to_f: { residual: 1 } },
        { r_to_f: 1, r_to_d: 1, p_to_f: 1 }  // all same weight
      );
      const wave1 = result.find(w => w.layers.includes('r_to_f'));
      assert.ok(wave1);
      // With equal weights, should be alphabetical: p_to_f, r_to_d, r_to_f
      assert.equal(wave1.layers[0], 'p_to_f');
      assert.equal(wave1.layers[1], 'r_to_d');
      assert.equal(wave1.layers[2], 'r_to_f');
    });
  });

  describe('Integration: 3 root layers with priority boost', () => {
    it('boosted middle layer appears first', () => {
      // d_to_c, git_heatmap, h_to_m are root layers
      const result = mod.computeWaves(
        { d_to_c: { residual: 1 }, git_heatmap: { residual: 1 }, h_to_m: { residual: 1 } },
        { git_heatmap: 1 }  // boost git_heatmap (middle alphabetically)
      );
      assert.equal(result.length, 1);
      assert.equal(result[0].layers[0], 'git_heatmap', 'boosted layer should be first');
    });
  });
});
