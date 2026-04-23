'use strict';
const { f } = require('../../../bin/bench-buggy-find-index.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}
assert('finds at 0', f([5, 3, 1], 5) === 0, 'got ' + f([5, 3, 1], 5));
assert('finds at 2', f([1, 2, 3], 3) === 2, 'got ' + f([1, 2, 3], 3));
process.exit(failed > 0 ? 1 : 0);
