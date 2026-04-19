'use strict';
// benchmarks/debug/tests/counter.test.cjs
// This test FAILS against the buggy stub. Fix: change < hi to <= hi.
const { buggyCounter } = require('../../../bin/bench-buggy-counter.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('includes hi boundary', buggyCounter([1,2,3,4,5], 2, 4), 3);
assert('single element at hi', buggyCounter([5], 1, 5), 1);
assert('none in range', buggyCounter([10,20], 1, 5), 0);
process.exit(failed > 0 ? 1 : 0);
