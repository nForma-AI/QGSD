'use strict';
const { deepClone } = require('../../../bin/bench-buggy-medium-deep-clone.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

assert('array clone is array', Array.isArray(deepClone([1,2,3])), true);
assert('array values preserved', JSON.stringify(deepClone([1,2,3])) === JSON.stringify([1,2,3]), true);

process.exit(failed > 0 ? 1 : 0);
