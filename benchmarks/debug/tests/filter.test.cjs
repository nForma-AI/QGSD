'use strict';
// benchmarks/debug/tests/filter.test.cjs
// This test FAILS against the buggy stub. Fix: change > to >=.
const { f } = require('../../../bin/bench-buggy-filter.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('includes b', f([1,2,3,4,5], 3), [3,4,5]);
assert('all above', f([10,20,30], 5), [10,20,30]);
assert('none above b-1', f([1,2], 2), [2]);
process.exit(failed > 0 ? 1 : 0);
