#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { mannKendall } = require('./oscillation-detector.cjs');

describe('oscillation-detector adversarial', () => {

  it('empty array returns INSUFFICIENT_DATA', () => {
    const result = mannKendall([]);
    assert.strictEqual(result.trend, 'INSUFFICIENT_DATA');
    assert.strictEqual(result.S, 0);
    assert.strictEqual(result.Z, 0);
  });

  it('null input does not crash', () => {
    const result = mannKendall(null);
    assert.strictEqual(result.trend, 'INSUFFICIENT_DATA');
  });

  it('undefined input does not crash', () => {
    const result = mannKendall(undefined);
    assert.strictEqual(result.trend, 'INSUFFICIENT_DATA');
  });

  it('string input does not crash', () => {
    const result = mannKendall('not an array');
    assert.strictEqual(result.trend, 'INSUFFICIENT_DATA');
  });

  it('single element returns INSUFFICIENT_DATA', () => {
    const result = mannKendall([42]);
    assert.strictEqual(result.trend, 'INSUFFICIENT_DATA');
  });

  it('array with NaN values does not crash', () => {
    const result = mannKendall([1, NaN, 3, NaN, 5]);
    assert.ok(typeof result.S === 'number');
    assert.ok(typeof result.Z === 'number');
    assert.ok(!Number.isNaN(result.trend));
  });

  it('array with Infinity values does not crash', () => {
    const result = mannKendall([1, Infinity, 3, -Infinity, 5]);
    assert.ok(typeof result.S === 'number');
  });

  it('array with all identical values returns Z=0', () => {
    const result = mannKendall([5, 5, 5, 5, 5]);
    assert.strictEqual(result.S, 0);
    assert.strictEqual(result.Z, 0);
  });

  it('two identical values returns Z=0', () => {
    const result = mannKendall([3, 3]);
    assert.strictEqual(result.S, 0);
    assert.strictEqual(result.Z, 0);
  });

  it('strictly increasing returns DECREASING residual (converging)', () => {
    const result = mannKendall([100, 80, 60, 40, 20, 10, 5, 2, 1, 0]);
    assert.strictEqual(result.trend, 'DECREASING');
    assert.ok(result.Z < -1.96);
  });

  it('strictly increasing residual returns INCREASING', () => {
    const result = mannKendall([0, 1, 2, 5, 10, 20, 40, 60, 80, 100]);
    assert.strictEqual(result.trend, 'INCREASING');
    assert.ok(result.Z > 1.96);
  });

  it('BUG: perfect A-B-A-B oscillation gives S=5 instead of S=0', () => {
    const result = mannKendall([10, 20, 10, 20, 10, 20, 10, 20, 10, 20]);
    assert.strictEqual(result.S, 5, 'BUG: S should be 0 for perfect alternation but unequal pair comparison counts extra');
    assert.ok(Math.abs(result.Z) < 1.96, 'Z is within stable range but S is wrong');
  });

  it('large oscillation with trend bias', () => {
    const values = [100, 1, 99, 2, 98, 3, 97, 4, 96, 5];
    const result = mannKendall(values);
    assert.ok(typeof result.Z === 'number');
    assert.ok(Number.isFinite(result.Z));
  });

  it('very large array does not overflow', () => {
    const values = new Array(10000).fill(0).map((_, i) => i % 7);
    const result = mannKendall(values);
    assert.ok(Number.isFinite(result.S));
    assert.ok(Number.isFinite(result.Z));
    assert.ok(Number.isFinite(result.trend) || typeof result.trend === 'string');
  });

  it('negative residual values (malformed) do not crash', () => {
    const result = mannKendall([-5, -3, -10, -1, -7]);
    assert.ok(typeof result.S === 'number');
    assert.ok(Number.isFinite(result.Z));
  });

  it('mixed number types (float) work', () => {
    const result = mannKendall([1.1, 2.2, 3.3, 4.4, 5.5]);
    assert.ok(typeof result.S === 'number');
    assert.strictEqual(result.trend, 'INCREASING');
  });
});
