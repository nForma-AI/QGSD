'use strict';
const { f } = require('../../../bin/bench-buggy-max-value.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('all-negative', f([-3, -1, -2]) === -1, 'got ' + f([-3, -1, -2]));
assert('mixed', f([1, -5, 3]) === 3);
process.exit(failed > 0 ? 1 : 0);
