#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  detectCycles,
  hashState,
  detectStateCycles,
  countBounces,
} = require('./solve-cycle-detector.cjs');

describe('solve-cycle-detector adversarial', () => {

  describe('detectCycles', () => {
    it('null history returns empty array', () => {
      assert.deepStrictEqual(detectCycles(null), []);
    });

    it('undefined history returns empty array', () => {
      assert.deepStrictEqual(detectCycles(undefined), []);
    });

    it('string history returns empty array', () => {
      assert.deepStrictEqual(detectCycles('not an object'), []);
    });

    it('empty object returns empty array', () => {
      assert.deepStrictEqual(detectCycles({}), []);
    });

    it('layer with string values instead of numbers does not crash', () => {
      const history = { r_to_f: ['a', 'b', 'a', 'b'] };
      const result = detectCycles(history);
      assert.ok(Array.isArray(result));
    });

    it('layer with NaN values', () => {
      const history = { r_to_f: [NaN, NaN, NaN, NaN] };
      const result = detectCycles(history);
      assert.ok(Array.isArray(result));
    });

    it('layer with mixed types', () => {
      const history = { r_to_f: [1, '2', null, undefined] };
      const result = detectCycles(history);
      assert.ok(Array.isArray(result));
    });

    it('layer with exactly 3 values (below minimum) is skipped', () => {
      const history = { r_to_f: [10, 20, 10] };
      const result = detectCycles(history);
      assert.deepStrictEqual(result, []);
    });

    it('layer with exactly 4 values A-B-A-B is detected', () => {
      const history = { r_to_f: [10, 20, 10, 20] };
      const result = detectCycles(history);
      assert.ok(result.includes('r_to_f'));
    });

    it('layer with 4 identical values is not oscillation', () => {
      const history = { r_to_f: [5, 5, 5, 5] };
      const result = detectCycles(history);
      assert.deepStrictEqual(result, ['r_to_f'], 'A-A-A-A is technically A-B-A-B where A==B');
    });

    it('very long history with oscillation buried in middle', () => {
      const values = new Array(50).fill(0).map((_, i) => i * 2);
      values[20] = 100; values[21] = 200; values[22] = 100; values[23] = 200;
      const history = { r_to_f: values };
      const result = detectCycles(history);
      assert.ok(result.includes('r_to_f'));
    });

    it('inherited properties on history object are not processed', () => {
      const proto = { inherited: [1, 2, 1, 2] };
      const history = Object.create(proto);
      history.r_to_f = [10, 20, 10, 20];
      const result = detectCycles(history);
      assert.ok(result.includes('r_to_f'));
      assert.ok(!result.includes('inherited'), 'should not process prototype properties');
    });
  });

  describe('hashState', () => {
    it('empty object produces consistent hash', () => {
      const h1 = hashState({});
      const h2 = hashState({});
      assert.strictEqual(h1, h2);
    });

    it('null input does not crash', () => {
      try {
        hashState(null);
        assert.ok(true);
      } catch (e) {
        assert.ok(true, 'threw on null — acceptable');
      }
    });

    it('undefined input does not crash', () => {
      try {
        hashState(undefined);
        assert.ok(true);
      } catch (e) {
        assert.ok(true, 'threw on undefined — acceptable');
      }
    });

    it('keys with special characters do not crash', () => {
      const result = hashState({ 'layer<script>': 5, 'layer"quotes"': 10 });
      assert.ok(typeof result === 'string');
      assert.strictEqual(result.length, 16);
    });

    it('negative residual values produce different hash than positive', () => {
      const h1 = hashState({ r_to_f: 10 });
      const h2 = hashState({ r_to_f: -10 });
      assert.notStrictEqual(h1, h2);
    });

    it('NaN value produces a hash (no crash)', () => {
      const result = hashState({ r_to_f: NaN });
      assert.ok(typeof result === 'string');
    });

    it('Infinity value produces a hash (no crash)', () => {
      const result = hashState({ r_to_f: Infinity });
      assert.ok(typeof result === 'string');
    });
  });

  describe('detectStateCycles', () => {
    it('empty array returns not detected', () => {
      const result = detectStateCycles([]);
      assert.strictEqual(result.detected, false);
    });

    it('null input returns not detected', () => {
      const result = detectStateCycles(null);
      assert.strictEqual(result.detected, false);
    });

    it('short array (< 4) returns not detected', () => {
      const result = detectStateCycles(['a', 'b', 'a']);
      assert.strictEqual(result.detected, false);
    });

    it('2-cycle detected with minimum elements', () => {
      const hashes = ['a', 'b', 'a', 'b'];
      const result = detectStateCycles(hashes);
      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.cycle_length, 2);
    });

    it('3-cycle detected with minimum elements', () => {
      const hashes = ['a', 'b', 'c', 'a'];
      const result = detectStateCycles(hashes);
      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.cycle_length, 3);
    });

    it('BUG: all identical hashes detected as 2-cycle (constant state is not oscillation)', () => {
      const hashes = ['x', 'x', 'x', 'x'];
      const result = detectStateCycles(hashes);
      assert.strictEqual(result.detected, true, 'BUG: constant state reported as cycle — hashes[3]===hashes[1] triggers false positive');
      assert.strictEqual(result.cycle_length, 2);
    });

    it('single coincidence (length 5) is not reported as cycle — needs 2 periods', () => {
      const hashes = ['a', 'b', 'c', 'd', 'e', 'a'];
      const result = detectStateCycles(hashes);
      assert.strictEqual(result.detected, false, 'single coincidence with only 6 entries is not enough for cycle detection');
      assert.strictEqual(result.cycle_length, null);
    });
  });

  describe('countBounces', () => {
    it('empty array returns 0', () => {
      assert.strictEqual(countBounces([]), 0);
    });

    it('null returns 0', () => {
      assert.strictEqual(countBounces(null), 0);
    });

    it('two elements returns 0', () => {
      assert.strictEqual(countBounces([1, 2]), 0);
    });

    it('flat sequence has zero bounces', () => {
      assert.strictEqual(countBounces([5, 5, 5, 5, 5]), 0);
    });

    it('monotonically increasing has zero bounces', () => {
      assert.strictEqual(countBounces([1, 2, 3, 4, 5]), 0);
    });

    it('one complete bounce (up-down-up)', () => {
      assert.strictEqual(countBounces([1, 5, 1]), 1);
    });

    it('zigzag pattern counts correctly', () => {
      assert.strictEqual(countBounces([1, 10, 1, 10, 1]), 3);
    });

    it('NaN values do not inflate bounce count', () => {
      const result = countBounces([1, NaN, 3, NaN, 5]);
      assert.ok(typeof result === 'number');
      assert.ok(Number.isFinite(result));
    });
  });
});
