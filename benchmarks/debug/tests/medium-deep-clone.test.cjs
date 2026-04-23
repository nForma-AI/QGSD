'use strict';
const { f } = require('../../../bin/bench-buggy-medium-deep-clone.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('array clone is array', Array.isArray(f([1,2,3])), true);
assert('array values preserved', JSON.stringify(f([1,2,3])) === JSON.stringify([1,2,3]), true);

process.exit(failed > 0 ? 1 : 0);
