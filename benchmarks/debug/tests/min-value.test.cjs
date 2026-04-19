'use strict';
const { f } = require('../../../bin/bench-buggy-min-value.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('basic min', f([3, 1, 4, 1, 5]) === 1, 'got ' + f([3, 1, 4, 1, 5]));
assert('negative min', f([-1, -5, -3]) === -5, 'got ' + f([-1, -5, -3]));
process.exit(failed > 0 ? 1 : 0);
