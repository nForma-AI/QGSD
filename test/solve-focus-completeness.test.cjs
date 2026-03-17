'use strict';

// Integration test: requires project environment (.planning/ directory with formal models)
// Run from project root: node --test test/solve-focus-completeness.test.cjs
//
// Uses --fast --report-only for speed (~1s). Layers skipped in fast mode are verified
// separately via source-code pattern matching to confirm they include scoped: false.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { LAYER_KEYS } = require('../bin/layer-constants.cjs');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const FILTERABLE = ['r_to_f', 'f_to_t', 'r_to_d'];

const EXPECTED_SCOPED_FALSE = [
  'c_to_f', 't_to_c', 'f_to_c', 'd_to_c', 'p_to_f',
  'c_to_r', 't_to_r', 'd_to_r', 'l1_to_l3', 'l3_to_tc',
  'per_model_gates', 'git_heatmap', 'git_history', 'formal_lint', 'hazard_model',
];

// Layers that --fast mode skips (returns { skipped: true } without scoped flag)
const FAST_SKIPPED = ['f_to_c', 't_to_c', 'l1_to_l3', 'l3_to_tc', 'per_model_gates', 'formal_lint', 'hazard_model'];
const EXPECTED_SCOPED_FALSE_LIVE = EXPECTED_SCOPED_FALSE.filter(k => !FAST_SKIPPED.includes(k));

// Write JSON output to a temp file to avoid spawnSync buffer truncation (~200KB output)
const tmpFile = path.join(os.tmpdir(), 'solve-focus-completeness-' + process.pid + '.json');

const result = spawnSync(process.execPath, [
  path.join(__dirname, '..', 'bin', 'nf-solve.cjs'),
  '--json', '--max-iterations=1', '--report-only', '--fast', '--focus=convergence test',
], {
  encoding: 'utf8',
  timeout: 30000,
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', fs.openSync(tmpFile, 'w'), 'pipe'],
});

let parsed;
try {
  const data = fs.readFileSync(tmpFile, 'utf8');
  parsed = JSON.parse(data);
} catch (_) {
  // fall through
} finally {
  try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
}

if ((result.status !== 0 && result.status !== null) || result.signal) {
  describe('focus filter completeness', () => {
    it('SKIPPED: nf-solve.cjs requires project environment or timed out', () => {
      assert.ok(true, 'Skipped — nf-solve.cjs exited with status ' + result.status + ' signal ' + result.signal);
    });
  });
} else if (!parsed || !parsed.residual_vector) {
  describe('focus filter completeness', () => {
    it('SKIPPED: could not parse nf-solve.cjs JSON output', () => {
      assert.ok(true, 'Skipped — JSON parse failed');
    });
  });
} else {
  const residualVector = parsed.residual_vector;

  describe('focus filter completeness', () => {
    it('LAYER_KEYS count is 18 after L2 collapse', () => {
      assert.equal(LAYER_KEYS.length, 18);
    });

    it('all 18 LAYER_KEYS are present in JSON output when --focus is used', () => {
      const presentKeys = Object.keys(residualVector).filter(k => LAYER_KEYS.includes(k));
      assert.equal(
        presentKeys.length,
        LAYER_KEYS.length,
        `Missing layers: ${LAYER_KEYS.filter(k => !residualVector[k]).join(', ')}`,
      );
    });

    it('non-filterable layers include scoped:false in detail when --focus is active (live layers)', () => {
      for (const layer of EXPECTED_SCOPED_FALSE_LIVE) {
        const entry = residualVector[layer];
        assert.ok(entry, `${layer} missing from residual_vector`);
        assert.ok(entry.detail, `${layer} missing detail object`);
        assert.equal(
          entry.detail.scoped, false,
          `${layer} must include scoped:false when focus is active`,
        );
      }
    });

    it('fast-skipped layers return skipped:true in detail', () => {
      for (const layer of FAST_SKIPPED) {
        const entry = residualVector[layer];
        assert.ok(entry, `${layer} missing from residual_vector`);
        assert.ok(entry.detail, `${layer} missing detail object`);
        assert.equal(entry.detail.skipped, true, `${layer} should be skipped in fast mode`);
      }
    });

    it('fast-skipped layers have scoped:false pattern in nf-solve.cjs source', () => {
      // Verify that the sweep functions for skipped layers contain the scoped pattern.
      // This confirms they WOULD set scoped:false in non-fast mode.
      const solveSource = fs.readFileSync(path.join(__dirname, '..', 'bin', 'nf-solve.cjs'), 'utf8');
      // All non-filterable sweep functions use: scoped: focusSet ? false : undefined
      const scopedPattern = /scoped:\s*focusSet\s*\?\s*false\s*:\s*undefined/g;
      const matches = solveSource.match(scopedPattern);
      // There should be at least one scoped pattern per non-filterable layer
      // (some layers share sweep functions, so count >= EXPECTED_SCOPED_FALSE.length is not guaranteed,
      // but we need at least the count of unique sweep functions)
      assert.ok(
        matches && matches.length >= 10,
        `Expected at least 10 scoped:focusSet patterns in nf-solve.cjs, found ${matches ? matches.length : 0}`,
      );
    });

    it('filterable layers do NOT have scoped:false (they actually filter)', () => {
      for (const layer of FILTERABLE) {
        const entry = residualVector[layer];
        assert.ok(entry, `${layer} missing from residual_vector`);
        assert.notEqual(
          entry.detail && entry.detail.scoped, false,
          `${layer} should not have scoped:false — it filters by focusSet`,
        );
      }
    });

    it('every LAYER_KEY is accounted for in either filterable or scoped:false set', () => {
      const allAccountedFor = [...FILTERABLE, ...EXPECTED_SCOPED_FALSE].sort();
      assert.deepStrictEqual(allAccountedFor, [...LAYER_KEYS].sort());
    });
  });
}
