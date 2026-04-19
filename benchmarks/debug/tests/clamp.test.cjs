'use strict';
const { f } = require('../../../bin/bench-buggy-clamp.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('below min', f(-5, 0, 10) === 0, 'got ' + f(-5, 0, 10));
assert('above max', f(15, 0, 10) === 10, 'got ' + f(15, 0, 10));
assert('in range', f(5, 0, 10) === 5, 'got ' + f(5, 0, 10));
process.exit(failed > 0 ? 1 : 0);
