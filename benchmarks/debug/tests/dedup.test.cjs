'use strict';
// benchmarks/debug/tests/dedup.test.cjs
// This test FAILS against the buggy stub. Fix: use identity key (no string coercion).
const { buggyDedup } = require('../../../bin/bench-buggy-medium-dedup.cjs');
let failed = 0;
function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + '\n'); failed++; }
}
assert('preserves number and string 1', buggyDedup([1, "1", 2]), [1, "1", 2]);
assert('normal dedup still works', buggyDedup([1, 1, 2]), [1, 2]);
assert('empty array', buggyDedup([]), []);
process.exit(failed > 0 ? 1 : 0);
