'use strict';
const { f } = require('../../../bin/bench-buggy-average.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('basic f', f([2, 4, 6]) === 4, 'got ' + f([2, 4, 6]));
assert('single element', f([10]) === 10, 'got ' + f([10]));
process.exit(failed > 0 ? 1 : 0);
