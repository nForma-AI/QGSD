'use strict';
const { f } = require('../../../bin/bench-buggy-range.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('f 0-3', JSON.stringify(f(0, 3)) === JSON.stringify([0, 1, 2]), 'got ' + JSON.stringify(f(0, 3)));
assert('f 1-4', JSON.stringify(f(1, 4)) === JSON.stringify([1, 2, 3]), 'got ' + JSON.stringify(f(1, 4)));
process.exit(failed > 0 ? 1 : 0);
