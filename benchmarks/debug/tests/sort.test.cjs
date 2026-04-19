'use strict';
// benchmarks/debug/tests/sort.test.cjs
// This test FAILS against the buggy stub. Fix: change < to > in comparator.
const { buggySort } = require('../../../bin/bench-buggy-sort.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('ascending [3,1,2]', buggySort([3,1,2]), [1,2,3]);
assert('ascending [5,4,3,2,1]', buggySort([5,4,3,2,1]), [1,2,3,4,5]);
assert('single element', buggySort([42]), [42]);
process.exit(failed > 0 ? 1 : 0);
