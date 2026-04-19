'use strict';
// benchmarks/debug/tests/filter.test.cjs
// This test FAILS against the buggy stub. Fix: change > to >=.
const { buggyFilter } = require('../../../bin/bench-buggy-filter.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('includes threshold', buggyFilter([1,2,3,4,5], 3), [3,4,5]);
assert('all above', buggyFilter([10,20,30], 5), [10,20,30]);
assert('none above threshold-1', buggyFilter([1,2], 2), [2]);
process.exit(failed > 0 ? 1 : 0);
