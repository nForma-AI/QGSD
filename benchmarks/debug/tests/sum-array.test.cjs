'use strict';
const { sumArray } = require('../../../bin/bench-buggy-sum-array.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('basic sum', sumArray([1, 2, 3]) === 6, 'got ' + sumArray([1, 2, 3]));
assert('empty', sumArray([]) === 0, 'got ' + sumArray([]));
process.exit(failed > 0 ? 1 : 0);
