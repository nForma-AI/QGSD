'use strict';
// benchmarks/debug/tests/accumulator.test.cjs
// This test FAILS against the buggy stub. Fix: change + to *.
const { buggyProduct } = require('../../../bin/bench-buggy-medium-accumulator.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (actual !== expected) { process.stderr.write('FAIL ' + label + ': got ' + actual + ', want ' + expected + '\n'); failed++; }
}
assert('product [2,3,4]', buggyProduct([2,3,4]), 24);
assert('product [1,5,2]', buggyProduct([1,5,2]), 10);
assert('single [7]', buggyProduct([7]), 7);
process.exit(failed > 0 ? 1 : 0);
