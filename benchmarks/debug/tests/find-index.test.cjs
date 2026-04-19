'use strict';
const { findIndex } = require('../../../bin/bench-buggy-find-index.cjs');
let failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}
assert('finds at 0', findIndex([5, 3, 1], 5) === 0, 'got ' + findIndex([5, 3, 1], 5));
assert('finds at 2', findIndex([1, 2, 3], 3) === 2, 'got ' + findIndex([1, 2, 3], 3));
process.exit(failed > 0 ? 1 : 0);
