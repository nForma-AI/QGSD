'use strict';
const { f } = require('../../../bin/bench-buggy-sum-array.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('basic sum', f([1, 2, 3]) === 6, 'got ' + f([1, 2, 3]));
assert('empty', f([]) === 0, 'got ' + f([]));
process.exit(failed > 0 ? 1 : 0);
