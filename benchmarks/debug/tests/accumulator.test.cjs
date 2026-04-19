'use strict';
// benchmarks/debug/tests/accumulator.test.cjs
// This test FAILS against the buggy stub. Fix: change + to *.
const { f } = require('../../../bin/bench-buggy-medium-accumulator.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('product [2,3,4]', f([2,3,4]), 24);
assert('product [1,5,2]', f([1,5,2]), 10);
assert('single [7]', f([7]), 7);
process.exit(failed > 0 ? 1 : 0);
