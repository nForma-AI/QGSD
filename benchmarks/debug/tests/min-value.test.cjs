'use strict';
const { findMin } = require('../../../bin/bench-buggy-min-value.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('basic min', findMin([3, 1, 4, 1, 5]) === 1, 'got ' + findMin([3, 1, 4, 1, 5]));
assert('negative min', findMin([-1, -5, -3]) === -5, 'got ' + findMin([-1, -5, -3]));
process.exit(failed > 0 ? 1 : 0);
