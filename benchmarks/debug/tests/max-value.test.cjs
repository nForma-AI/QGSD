'use strict';
const { findMax } = require('../../../bin/bench-buggy-max-value.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('all-negative', findMax([-3, -1, -2]) === -1, 'got ' + findMax([-3, -1, -2]));
assert('mixed', findMax([1, -5, 3]) === 3);
process.exit(failed > 0 ? 1 : 0);
