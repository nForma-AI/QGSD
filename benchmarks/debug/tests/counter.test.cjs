'use strict';
// benchmarks/debug/tests/counter.test.cjs
// This test FAILS against the buggy stub. Fix: change < c to <= c.
const { f } = require('../../../bin/bench-buggy-counter.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('includes c boundary', f([1,2,3,4,5], 2, 4), 3);
assert('single element at c', f([5], 1, 5), 1);
assert('none in range', f([10,20], 1, 5), 0);
process.exit(failed > 0 ? 1 : 0);
