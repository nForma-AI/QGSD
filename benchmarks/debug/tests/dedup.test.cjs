'use strict';
// benchmarks/debug/tests/dedup.test.cjs
// This test FAILS against the buggy stub. Fix: use identity key (no string coercion).
const { f } = require('../../../bin/bench-buggy-medium-dedup.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('preserves number and string 1', f([1, "1", 2]), [1, "1", 2]);
assert('normal dedup still works', f([1, 1, 2]), [1, 2]);
assert('empty array', f([]), []);
process.exit(failed > 0 ? 1 : 0);
