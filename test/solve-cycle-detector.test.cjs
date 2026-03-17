'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CycleDetector, detectCycles } = require('../bin/solve-cycle-detector.cjs');

describe('detectCycles (standalone)', () => {
  it('returns empty for empty history', () => {
    assert.deepStrictEqual(detectCycles({}), []);
    assert.deepStrictEqual(detectCycles(null), []);
    assert.deepStrictEqual(detectCycles(undefined), []);
  });

  it('returns empty for 3 iterations (below threshold)', () => {
    const history = { r_to_f: [5, 3, 5] };
    assert.deepStrictEqual(detectCycles(history), []);
  });

  it('detects A-B-A-B over 4 points', () => {
    const history = { r_to_f: [5, 3, 5, 3] };
    assert.deepStrictEqual(detectCycles(history), ['r_to_f']);
  });

  it('detects A-B-A-B over 6 points', () => {
    const history = { r_to_f: [5, 3, 5, 3, 5, 3] };
    assert.deepStrictEqual(detectCycles(history), ['r_to_f']);
  });

  it('does NOT detect monotonically decreasing values', () => {
    const history = { r_to_f: [10, 8, 6, 4, 2, 0] };
    assert.deepStrictEqual(detectCycles(history), []);
  });

  it('detects single oscillating layer among many stable', () => {
    const history = {
      r_to_f: [5, 3, 5, 3],     // oscillating
      f_to_t: [10, 8, 6, 4],    // decreasing
      c_to_f: [3, 2, 1, 0],     // decreasing
    };
    assert.deepStrictEqual(detectCycles(history), ['r_to_f']);
  });

  it('detects multiple oscillating layers simultaneously', () => {
    const history = {
      r_to_f: [5, 3, 5, 3],
      f_to_t: [7, 2, 7, 2],
    };
    const result = detectCycles(history);
    assert.equal(result.length, 2);
    assert.ok(result.includes('r_to_f'));
    assert.ok(result.includes('f_to_t'));
  });

  it('does NOT detect A-B-A pattern (only 3 points)', () => {
    const history = { r_to_f: [5, 3, 5] };
    assert.deepStrictEqual(detectCycles(history), []);
  });
});

describe('CycleDetector class', () => {
  it('record() accumulates per-layer history', () => {
    const cd = new CycleDetector();
    cd.record(1, { r_to_f: 5, f_to_t: 10 });
    cd.record(2, { r_to_f: 3, f_to_t: 8 });
    const h = cd.getHistory();
    assert.deepStrictEqual(h.r_to_f, [5, 3]);
    assert.deepStrictEqual(h.f_to_t, [10, 8]);
  });

  it('detectOscillating() returns oscillating layers after 4+ records', () => {
    const cd = new CycleDetector();
    cd.record(1, { r_to_f: 5 });
    cd.record(2, { r_to_f: 3 });
    cd.record(3, { r_to_f: 5 });
    cd.record(4, { r_to_f: 3 });
    assert.deepStrictEqual(cd.detectOscillating(), ['r_to_f']);
  });

  it('detectOscillating() returns empty when no oscillation', () => {
    const cd = new CycleDetector();
    cd.record(1, { r_to_f: 10 });
    cd.record(2, { r_to_f: 8 });
    cd.record(3, { r_to_f: 6 });
    cd.record(4, { r_to_f: 4 });
    assert.deepStrictEqual(cd.detectOscillating(), []);
  });

  it('handles null/undefined input to record() gracefully', () => {
    const cd = new CycleDetector();
    cd.record(1, null);
    cd.record(2, undefined);
    assert.deepStrictEqual(cd.getHistory(), {});
    assert.deepStrictEqual(cd.detectOscillating(), []);
  });
});
